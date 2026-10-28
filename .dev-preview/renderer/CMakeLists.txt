cmake_minimum_required(VERSION 3.20)
project(RosePreview LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(RMLUI_SAMPLES OFF CACHE BOOL "" FORCE)
set(RMLUI_PRECOMPILED_HEADERS OFF CACHE BOOL "" FORCE)
list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../.cache/RmlUi/CMake/Modules/Emscripten")
add_subdirectory(../.cache/RmlUi rmlui)
add_executable(rose-preview main.cpp ../.cache/RmlUi/Backends/RmlUi_Renderer_GL3.cpp)
target_include_directories(rose-preview PRIVATE ../.cache/RmlUi/Backends)
target_link_libraries(rose-preview PRIVATE RmlUi::Core RmlUi::Debugger)
target_compile_options(rose-preview PRIVATE -O2)
target_link_options(rose-preview PRIVATE
  -O2 -sUSE_WEBGL2=1 -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createRosePreview
  -sENVIRONMENT=web -sFILESYSTEM=0
  "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
  "-sEXPORTED_FUNCTIONS=['_main','_malloc','_free','_preview_load','_preview_resize','_preview_debug','_preview_mouse','_preview_button','_preview_wheel','_preview_text','_preview_key']"
)
set_target_properties(rose-preview PROPERTIES SUFFIX .js RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../public/engine")
