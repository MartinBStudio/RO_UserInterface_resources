import { dimensions, fitScale } from './display.mjs';
import { createEditor } from './editor.js';
const $ = id => document.getElementById(id);
let catalog, windows = [], currentTheme = localStorage.getItem('rose-theme') || 'Arua';
let diagnostics = [], revision = 0, sourceRequest = 0;
let sampleControls = {};
const frame = $('preview');
const themeSelect = $('theme'), windowSelect = $('window');
const editor = createEditor({
  getContext:() => ({theme:currentTheme,path:windowSelect.value}),
  getToken:() => catalog?.editToken,
  onPreview:() => {
    if (previewReady) {
      diagnostics = []; $('diagnostics').textContent = 'No messages.'; $('resource-warning').hidden = true;
      frame.contentWindow.postMessage({type:'reload',path:windowSelect.value},location.origin);
    } else if (catalog && windowSelect.value) reload();
  },
  onSaved:() => loadSource().catch(e => error(e.message))
});
const split = $('workspace-split'), splitter = $('splitter');
let panePercent = Math.max(25,Math.min(75,Number(localStorage.getItem('rose-pane-percent')) || 55));
function resizePanes(percent) {
  panePercent = Math.max(25,Math.min(75,percent));
  split.style.setProperty('--preview-share',panePercent+'%');
  splitter.setAttribute('aria-valuenow',String(Math.round(panePercent)));
  localStorage.setItem('rose-pane-percent',String(panePercent));
}
resizePanes(panePercent);
splitter.addEventListener('pointerdown',event => { splitter.setPointerCapture(event.pointerId); split.classList.add('resizing'); });
splitter.addEventListener('pointermove',event => {
  if (!splitter.hasPointerCapture(event.pointerId)) return;
  const bounds = split.getBoundingClientRect(); resizePanes(100*(event.clientX-bounds.left)/bounds.width);
});
const endResize = () => split.classList.remove('resizing');
splitter.addEventListener('pointerup',endResize); splitter.addEventListener('lostpointercapture',endResize);
splitter.addEventListener('keydown',event => {
  if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); resizePanes(panePercent+(event.key === 'ArrowLeft' ? -2 : 2)); }
});
$('editor-toggle').addEventListener('click',() => {
  const hidden = split.classList.toggle('editor-hidden');
  $('editor-toggle').textContent = hidden ? 'Show code' : 'Hide code'; $('editor-toggle').setAttribute('aria-expanded',String(!hidden));
});
const displayKeys = ['resolution','viewport-width','viewport-height','scale','scale-percent','view'];
for (const id of displayKeys) {
  const saved = localStorage.getItem('rose-display-'+id);
  if (saved !== null) {
    const control = $(id);
    if (control.tagName !== 'SELECT' || [...control.options].some(o => o.value === saved)) control.value = saved;
  }
}
let displaySize, displayZoom = 1, previewReady = false;
function uiScale() {
  return $('scale').value === 'custom' ? Math.max(25,Math.min(400,Number($('scale-percent').value) || 100))/100 : Number($('scale').value);
}
function readyStatus() {
  if (previewReady && displaySize) $('status').textContent = `Ready · ${displaySize.width} × ${displaySize.height} viewport · UI ${Math.round(uiScale()*100)}% · save files to refresh`;
}
function updateDisplay() {
  $('custom-resolution').hidden = $('resolution').value !== 'custom';
  $('custom-scale').hidden = $('scale').value !== 'custom';
  const stage = $('viewport-scroll');
  displaySize = dimensions($('resolution').value,$('viewport-width').value,$('viewport-height').value,stage.clientWidth,stage.clientHeight);
  if ($('resolution').value === 'custom') {
    $('viewport-width').value = displaySize.width; $('viewport-height').value = displaySize.height;
  }
  if ($('scale').value === 'custom') $('scale-percent').value = Math.round(uiScale()*100);
  displayZoom = $('view').value === 'fit' ? fitScale(displaySize.width,displaySize.height,stage.clientWidth,stage.clientHeight) : 1;
  const screen = $('screen');
  screen.style.width = `${displaySize.width*displayZoom}px`; screen.style.height = `${displaySize.height*displayZoom}px`;
  frame.style.width = `${displaySize.width}px`; frame.style.height = `${displaySize.height}px`;
  frame.style.transform = `scale(${displayZoom})`;
  $('display-summary').textContent = `${displaySize.width} × ${displaySize.height} · view ${Math.round(displayZoom*100)}%`;
  $('display-summary').title = 'View zoom fits the simulated screen into the workshop. UI scale controls the size of UI elements inside that screen.';
  for (const id of displayKeys) localStorage.setItem('rose-display-'+id,$(id).value);
  if (previewReady) frame.contentWindow.postMessage({type:'display',scale:uiScale()},location.origin);
  readyStatus();
}
for (const id of displayKeys) $(id).addEventListener('change',updateDisplay);
new ResizeObserver(updateDisplay).observe($('viewport-scroll'));
updateDisplay();
const error = message => { $('loading').hidden = false; $('loading').textContent = message; $('status').textContent = message; };
async function json(url) { const response = await fetch(url); if (!response.ok) throw Error(await response.text()); return response.json(); }
function renderThemes() {
  const term = $('theme-search').value.toLowerCase();
  const filtered = catalog.themes.filter(t => `${t.name} ${t.id} ${(t.tags || []).join(' ')}`.toLowerCase().includes(term));
  themeSelect.replaceChildren(...filtered.map(t => new Option(t.name || t.id,t.id,false,t.id === currentTheme)));
  $('theme-count').textContent = filtered.length;
}
async function chooseTheme() {
  currentTheme = themeSelect.value || currentTheme;
  localStorage.setItem('rose-theme', currentTheme);
  $('description').textContent = catalog.themes.find(t => t.id === currentTheme)?.description || '';
  const selected = windowSelect.value || localStorage.getItem('rose-window') || '/data/ui/themes/rose/game/inventory.html';
  const requestedTheme = currentTheme;
  const result = await json('/api/windows?theme='+encodeURIComponent(requestedTheme));
  if (requestedTheme !== currentTheme) return;
  windows = result;
  windowSelect.replaceChildren(...windows.map(w => new Option(`${w.overridden ? '●' : '○'} ${w.name}`,w.path,false,w.path === selected)));
  if (!windowSelect.value && windows.length) windowSelect.selectedIndex = 0;
  reload();
}
function reload(extra = {}) {
  if (!windowSelect.value) { error(catalog.base ? 'No previewable windows were found. Windows that require live game content are hidden.' : 'This theme has no UI windows and no base assets were found. See .dev-preview/README.md.'); return; }
  if (!catalog.engine) { error('The renderer is missing. Run .dev-preview/build.ps1 once; see .dev-preview/README.md.'); return; }
  sampleControls = {...sampleControls,...extra};
  const params = new URLSearchParams({theme:currentTheme,window:windowSelect.value,preset:$('preset').value,scale:uiScale(),draft:editor.draftId,...sampleControls});
  localStorage.setItem('rose-window',windowSelect.value);
  $('heading').textContent = `${currentTheme} / ${windowSelect.selectedOptions[0]?.textContent.replace(/^[●○] /,'')}`;
  diagnostics = []; $('diagnostics').textContent = 'No messages.';
  $('resource-warning').hidden = true;
  $('loading').hidden = false; $('loading').textContent = 'Loading window…';
  previewReady = false;
  $('status').textContent = 'Loading…'; frame.src = '/preview.html?'+params;
  loadSource().catch(e => { $('source').textContent = e.message; });
  editor.openContext();
}
async function loadSource() {
  const request = ++sourceRequest;
  const params = new URLSearchParams({theme:currentTheme,path:windowSelect.value});
  const source = await json('/api/source?'+params);
  if (request !== sourceRequest) return;
  $('source-path').textContent = `${source.layer === 'theme' ? 'Theme override' : 'Base fallback'} · ${source.file}`;
  $('copy-path').dataset.path = source.file;
  $('source').textContent = source.source;
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  const {type, ...data} = event.data;
  if (type === 'ready') { previewReady = true; $('loading').hidden = true; updateDisplay(); }
  if (type === 'error') error(data.message);
  if (type === 'diagnostic') {
    if (!diagnostics.includes(data.message)) diagnostics.push(data.message);
    if (/Missing resource:|Could not load texture/.test(data.message)) $('resource-warning').hidden = false;
    $('diagnostics').textContent = diagnostics.slice(-100).join('\n\n');
  }
  if (type === 'action') {
    const match = data.action.match(/^mode:(\d+)$/);
    if (match) reload({mode:match[1]});
    else $('status').textContent = `Sample control: ${data.action} · game commands are recorded here`;
  }
});
$('theme-search').addEventListener('input',renderThemes);
themeSelect.addEventListener('change',() => chooseTheme().catch(e => error(e.message)));
windowSelect.addEventListener('change',() => { sampleControls = {}; reload(); });
$('preset').addEventListener('change',() => reload());
$('reload').addEventListener('click',() => reload());
$('debug').addEventListener('click',() => frame.contentWindow.postMessage({type:'debug'},location.origin));
$('source-toggle').addEventListener('click',() => { $('details').hidden = !$('details').hidden; });
$('copy-path').addEventListener('click',() => navigator.clipboard.writeText($('copy-path').dataset.path || ''));
const events = new EventSource('/api/events');
events.onmessage = event => {
  const update = JSON.parse(event.data);
  if (revision === update.revision) return;
  revision = update.revision;
  editor.refreshDisk();
  if ($('live').checked) { reload(); $('status').textContent = `Reloading after change: ${update.file}`; }
};
events.onerror = () => { $('status').textContent = 'Server connection interrupted — reconnecting…'; };
try {
  catalog = await json('/api/catalog');
  if (!catalog.themes.some(t => t.id === currentTheme)) currentTheme = catalog.themes[0]?.id;
  renderThemes();
  $('base-status').textContent = catalog.base ? 'Base UI connected' : 'Base UI not found';
  $('base-status').title = catalog.base || 'Use --base <assets-folder> when starting the server';
  await chooseTheme();
} catch (e) { error(e.message); }
