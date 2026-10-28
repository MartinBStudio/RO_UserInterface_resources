#include <RmlUi/Core.h>
#include <RmlUi/Core/Elements/ElementProgress.h>
#include <RmlUi/Debugger.h>
#include "RmlUi_Renderer_GL3.h"
#include <emscripten.h>
#include <emscripten/html5.h>
#include <GLES3/gl3.h>
#include <algorithm>
#include <cstring>
#include <cstdlib>
#include <memory>
#include <unordered_map>
#include <vector>

// All paths go through the local server's theme-over-base virtual filesystem.
EM_JS(unsigned char*, fetch_bytes, (const char* path, int* size, int texture), {
  try {
    const url = (texture ? '/api/texture' : '/api/asset') + location.search +
      (location.search ? '&' : '?') + 'path=' + encodeURIComponent(UTF8ToString(path));
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.send();
    if (xhr.status !== 200) {
      Module.onDiagnostic?.('Missing resource: ' + UTF8ToString(path));
      return 0;
    }
    const text = xhr.responseText;
    const ptr = _malloc(text.length || 1);
    for (let i = 0; i < text.length; i++) HEAPU8[ptr+i] = text.charCodeAt(i) & 255;
    HEAP32[size>>2] = text.length;
    return ptr;
  } catch (e) { Module.onDiagnostic?.(String(e)); return 0; }
});

EM_JS(void, log_message, (const char* message), { Module.onDiagnostic?.(UTF8ToString(message)); });
EM_JS(void, set_cursor, (const char* name), {
  const nameString = UTF8ToString(name);
  Module.canvas.style.cursor = ({normal:'default', pointer:'pointer', move:'move', text:'text'})[nameString] || 'default';
});
EM_JS(void, report_document, (float width, float height), { Module.onDocument?.({width, height}); });

struct OpenFile { std::shared_ptr<std::vector<unsigned char>> bytes; size_t offset = 0; };
class Files : public Rml::FileInterface {
public:
  std::unordered_map<std::string, std::shared_ptr<std::vector<unsigned char>>> cache;
  Rml::FileHandle Open(const Rml::String& path) override {
    auto& bytes = cache[path];
    if (!bytes) {
      int size = 0;
      auto* data = fetch_bytes(path.c_str(), &size, 0);
      if (!data) return 0;
      bytes = std::make_shared<std::vector<unsigned char>>(data, data + size);
      free(data);
    }
    return reinterpret_cast<Rml::FileHandle>(new OpenFile{bytes});
  }
  void Close(Rml::FileHandle file) override { delete reinterpret_cast<OpenFile*>(file); }
  size_t Read(void* dest, size_t count, Rml::FileHandle file) override {
    auto* f = reinterpret_cast<OpenFile*>(file);
    count = std::min(count, f->bytes->size() - f->offset);
    memcpy(dest, f->bytes->data() + f->offset, count); f->offset += count; return count;
  }
  bool Seek(Rml::FileHandle file, long offset, int origin) override {
    auto* f = reinterpret_cast<OpenFile*>(file);
    long next = offset + (origin == SEEK_CUR ? long(f->offset) : origin == SEEK_END ? long(f->bytes->size()) : 0);
    if (next < 0 || size_t(next) > f->bytes->size()) return false;
    f->offset = size_t(next); return true;
  }
  size_t Tell(Rml::FileHandle file) override { return reinterpret_cast<OpenFile*>(file)->offset; }
};
class System : public Rml::SystemInterface {
public:
  double GetElapsedTime() override { return emscripten_get_now() / 1000.; }
  bool LogMessage(Rml::Log::Type, const Rml::String& message) override { log_message(message.c_str()); return true; }
  void SetMouseCursor(const Rml::String& name) override { set_cursor(name.c_str()); }
};
class Renderer : public RenderInterface_GL3 {
public:
  Rml::TextureHandle LoadTexture(Rml::Vector2i& dimensions, const Rml::String& source) override {
    int size = 0; auto* bytes = fetch_bytes(source.c_str(), &size, 1);
    if (!bytes || size < 8) { free(bytes); return 0; }
    uint32_t w, h; memcpy(&w, bytes, 4); memcpy(&h, bytes + 4, 4);
    if (!w || !h || size_t(size) != 8 + size_t(w) * h * 4) { free(bytes); return 0; }
    dimensions = {int(w), int(h)};
    // RmlUi's renderer expects premultiplied RGBA.
    for (int i = 8; i < size; i += 4) {
      unsigned a = bytes[i+3];
      bytes[i] = bytes[i]*a/255; bytes[i+1] = bytes[i+1]*a/255; bytes[i+2] = bytes[i+2]*a/255;
    }
    auto texture = GenerateTexture({bytes+8, size_t(size-8)}, dimensions);
    free(bytes); return texture;
  }
};

static Files files;
static System system_interface;
static std::unique_ptr<Renderer> renderer;
static Rml::Context* context = nullptr;
static Rml::ElementDocument* document = nullptr;
static int view_width = 1100, view_height = 800;
static bool debug_visible = false;

class Events : public Rml::EventListener {
  void ProcessEvent(Rml::Event& event) override {
    if (event.GetType() != "click") return;
    auto* element = event.GetTargetElement();
    while (element && element != document) {
      auto action = element->GetAttribute<Rml::String>("preview-action", "");
      if (!action.empty()) {
        EM_ASM({ Module.onAction?.(UTF8ToString($0)); }, action.c_str());
        break;
      }
      element = element->GetParentNode();
    }
  }
} events;

static void frame() {
  context->Update();
  glBindFramebuffer(GL_FRAMEBUFFER, 0); glDisable(GL_SCISSOR_TEST);
  glClearColor(0, 0, 0, 0); glClear(GL_COLOR_BUFFER_BIT);
  renderer->BeginFrame(); context->Render(); renderer->EndFrame();
}

extern "C" {
EMSCRIPTEN_KEEPALIVE void preview_resize(int width, int height, float scale) {
  view_width = width; view_height = height;
  emscripten_set_canvas_element_size("#canvas", width, height);
  renderer->SetViewport(width, height); context->SetDimensions({width, height});
  context->SetDensityIndependentPixelRatio(scale);
}
EMSCRIPTEN_KEEPALIVE int preview_load(const char* path) {
  if (document) { document->RemoveEventListener("click", &events); document->Close(); document = nullptr; context->Update(); }
  files.cache.clear(); Rml::ReleaseTextures(); Rml::Factory::ClearStyleSheetCache(); Rml::Factory::ClearTemplateCache();
  document = context->LoadDocument(path);
  if (!document) return 0;
  document->SetProperty("left", "32dp"); document->SetProperty("top", "32dp");
  if (auto* title = document->GetElementById("window-title-text")) {
    if (title->GetInnerRML().empty()) title->SetInnerRML(document->GetTitle());
  }
  document->AddEventListener("click", &events);
  document->Show(); context->Update();
  auto size = document->GetBox().GetSize(); report_document(size.x, size.y);
  return 1;
}
EMSCRIPTEN_KEEPALIVE void preview_debug() { debug_visible = !debug_visible; Rml::Debugger::SetVisible(debug_visible); }
EMSCRIPTEN_KEEPALIVE void preview_mouse(int x, int y, int modifiers) { context->ProcessMouseMove(x, y, modifiers); }
EMSCRIPTEN_KEEPALIVE void preview_button(int button, int down, int modifiers) {
  if (down) context->ProcessMouseButtonDown(button, modifiers); else context->ProcessMouseButtonUp(button, modifiers);
}
EMSCRIPTEN_KEEPALIVE void preview_wheel(float delta, int modifiers) { context->ProcessMouseWheel(delta, modifiers); }
EMSCRIPTEN_KEEPALIVE void preview_text(const char* text) { context->ProcessTextInput(text); }
EMSCRIPTEN_KEEPALIVE void preview_key(int key, int down, int modifiers) {
  if (down) context->ProcessKeyDown(Rml::Input::KeyIdentifier(key), modifiers);
  else context->ProcessKeyUp(Rml::Input::KeyIdentifier(key), modifiers);
}
}

int main() {
  EmscriptenWebGLContextAttributes attrs; emscripten_webgl_init_context_attributes(&attrs);
  attrs.majorVersion = 2; attrs.alpha = true; attrs.depth = false; attrs.stencil = true; attrs.antialias = true;
  auto gl_context = emscripten_webgl_create_context("#canvas", &attrs);
  if (gl_context <= 0) { log_message("WebGL 2 is required. Enable hardware acceleration in your browser."); return 1; }
  emscripten_webgl_make_context_current(gl_context);
  renderer = std::make_unique<Renderer>();
  if (!*renderer) { log_message("Unable to initialise the RmlUi renderer."); return 1; }
  Rml::SetSystemInterface(&system_interface); Rml::SetFileInterface(&files); Rml::SetRenderInterface(renderer.get());
  Rml::Initialise();
  // Keep the original gauge tag so existing RCSS selectors match it.
  static Rml::ElementInstancerGeneric<Rml::ElementProgress> gauge_instancer;
  Rml::Factory::RegisterElementInstancer("gauge", &gauge_instancer);
  Rml::LoadFontFace("/data/ui/themes/rose/font/nunito/static/Nunito-Regular.ttf");
  Rml::LoadFontFace("/data/ui/themes/rose/font/nunito/static/Nunito-SemiBold.ttf");
  Rml::LoadFontFace("/data/ui/themes/rose/font/nunito/static/Nunito-Bold.ttf");
  context = Rml::CreateContext("preview", {view_width, view_height});
  Rml::Debugger::Initialise(context);
  renderer->SetViewport(view_width, view_height);
  emscripten_set_main_loop(frame, 0, false);
  return 0;
}
