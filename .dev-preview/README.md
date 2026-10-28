# ROSE UI Workshop

Local browser development environment for the theme folders in this repository.
It runs the actual RmlUi 6.1 layout engine and OpenGL renderer as WebAssembly / WebGL 2.
The compiled engine is included, so everyday use does not need a C++ compiler,
Emscripten, a ROSE server, or the running game.

## Start

Install Node.js 22 or newer, then double-click **Start-UI-Preview.cmd** inside `.dev-preview`.
It installs the locked npm dependencies on first use and opens **http://127.0.0.1:4173**.
Subsequent launches work offline with the dependencies already installed.
The launcher displays quick instructions and keeps its console open while the server runs.
**Close that console window or press Ctrl+C to stop the server.** Closing the browser tab
alone does not stop it. Each launch runs the server directly in its console, without a
background server process. If the starting port is occupied, the launcher automatically
tries the next available port and opens the browser at the selected address.

Alternatively:

```powershell
cd .dev-preview
npm.cmd ci
npm.cmd start
```

Select a theme, select a window, and edit the original HTML/RCSS/DDS files in your IDE.
Saving refreshes the preview. The theme files and game installation are never modified by the viewer.
The filled dot in the window selector means that the selected theme overrides that window;
the empty dot means it comes from the base UI.

**Inspect UI** opens RmlUi's built-in inspector for element/layout/style inspection.
**View source & diagnostics** shows the original document's actual disk path and renderer messages.
The canvas accepts mouse input, window dragging, scrolling, and keyboard input.
Inventory mode buttons switch sample equipment modes; other game commands appear in the status line.
Choose sample states to inspect normal, full, low-health/fuel, and empty data.

### Resolutions and UI scale

Use **Resolution** to simulate common displays from 1024 × 768 through Full HD, QHD,
ultrawide, and 4K, or choose **Custom** for your own dimensions. **Available space** follows
the workshop viewport. Custom sizes support widths 320–7680 and heights 240–4320.

**UI scale** changes the renderer's density-independent pixel ratio, with presets from
50% to 300% and custom values from 25% to 400%. Resolution and scale update the running
preview without reloading its document. Your display settings are remembered locally.

**Fit to screen** shrinks only the displayed preview so a large simulated screen fits in
the workshop. The engine still renders at the selected full resolution and UI scale.
**Actual pixels (scroll)** displays one rendered pixel per browser CSS pixel and lets you
scroll across larger screens. The view percentage beside the controls is separate from UI scale.
Browser zoom and operating system display scaling still affect the physical size on your monitor.

## Base assets

Theme folders are partial overrides. Missing files fall back to the base UI.
The server automatically checks these neighboring repositories in order:

1. `../rednim-rose-ui-public/assets`
2. `../rose-public/assets`
3. `../rose-public2/assets`

To choose a different extracted base directory, pass its path (containing `data/ui/themes/rose`):

```powershell
node server.mjs --base "C:\path\to\assets" --open
```

Or set `ROSE_UI_BASE` before launching. Add `--port 4174` to change the port.

Some shared textures (for example `3ddata/control/res/icon01.dds` and `glassui_01.dds`)
are **not included in the neighboring public UI repositories**. These produce missing-resource
messages and can appear as empty or white sprites. Supply an extracted game asset directory:

```powershell
node server.mjs --assets "C:\path\to\extracted-game-assets" --open
```

`ROSE_UI_ASSETS` is the equivalent environment variable. Lookup order is theme → base → extra assets.
Use a folder preserving paths such as `3ddata/control/res/icon01.dds`.
The viewer reads loose files; it does not extract `rose.vfs` or `data.idx` archives.
No game assets are downloaded or copied into this repository.

## Sample data and limits

Edit **mock-data.json** to change player values, party members, chat tabs, and per-model overrides.
The file is watched too. `defaults` supplies shared fields, `models` provides model-specific fields,
and `presets` supplies the states exposed by the dropdown.

The server resolves a safe subset of RmlUi expressions into sample document content before
passing the RML to the real engine: interpolation, `data-if`, bounded `data-for` arrays,
class/style/attribute bindings, and numeric formatting. It never executes embedded scripts or game code.
Unknown fields become empty values. Add the fields/arrays a window needs to mock-data.json.
For inventory, the viewer inserts example item sprites rather than implementing item rules.

This is a **visual UI development preview**, with the following limits:

- Game C++/Lua callbacks, trading, combat, network actions, and item behavior are not simulated.
- Character/scene/minimap rendering, localization database lookups, and game-specific widgets
  need adapters and/or data; a custom element may remain empty. Existing text labels are preserved.
- Gauges use RmlUi's progress implementation under the original `gauge` tag so the theme's
  RCSS selectors still apply. This is an approximation of the game's custom gauge.
- DDS BC1/DXT1, BC2/DXT3, BC3/DXT5, uncompressed RGB(A), selected DX10 formats, and PNG
  are supported. Unsupported formats are reported in diagnostics.
- The game can use a modified/different RmlUi version. Properties outside stock 6.1
  (such as `text-overflow`) are reported, and exact layout parity is not guaranteed.
- This is a localhost-only development server, with read-only access to the configured asset folders.

## Rebuild the engine

Only needed when changing `renderer/main.cpp` or the renderer build configuration:

```powershell
powershell -ExecutionPolicy Bypass -File .dev-preview/build.ps1
```

Run from the repository root. Requires Git and CMake + Ninja on PATH, or Visual Studio's
C++ CMake tools. The script downloads the pinned Emscripten **4.0.23** toolchain and
RmlUi **6.1** into ignored `.dev-preview/.cache`, then builds `public/engine/rose-preview.js`
and `rose-preview.wasm`. Initial setup downloads a large compiler SDK; it changes no
system-wide toolchain settings. The compiled files are deliberately included in the repository.

## Verify

```powershell
cd .dev-preview
npm.cmd test
npm.cmd run test:browser
```

The browser check uses an installed Google Chrome, starts its own temporary server,
and checks rendering, theme/window/state switching, the inspector, and live reload.
Screenshots go to ignored `test-results/`.

The engine includes RmlUi (MIT), FreeType, zlib, and Emscripten runtime code.
Portions of this software are copyright © The FreeType Project (www.freetype.org).
See `licenses/` for notices. Theme assets and base game assets retain their respective licenses.
