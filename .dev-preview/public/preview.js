import createRosePreview from './engine/rose-preview.js';
const canvas = document.getElementById('canvas');
const send = (type, values = {}) => parent.postMessage({type,...values},location.origin);
const params = new URLSearchParams(location.search);
let scale = Number(params.get('scale') || 1);
try {
  const engine = await createRosePreview({canvas,
    onDiagnostic: message => send('diagnostic',{message}),
    onAction: action => send('action',{action}),
    printErr: message => send('diagnostic',{message}),
    onAbort: message => send('error',{message:String(message)})
  });
  const call = (name, types, values) => engine.ccall(name,null,types,values);
  const resize = () => {
    const width = Math.floor(innerWidth), height = Math.floor(innerHeight);
    call('preview_resize',['number','number','number'],[width,height,scale]);
    canvas.dataset.viewport = `${width}x${height}`;
    canvas.dataset.uiScale = String(scale);
  };
  resize();
  const ok = engine.ccall('preview_load','number',['string'],[params.get('window')]);
  if (!ok) throw Error('Unable to load this window. Open diagnostics for missing resources.');
  send('ready',{width:innerWidth,height:innerHeight});
  window.addEventListener('resize',resize);
  window.addEventListener('message',e => {
    if (e.origin !== location.origin || e.source !== parent) return;
    if (e.data.type === 'debug') engine._preview_debug();
    if (e.data.type === 'display' && Number.isFinite(e.data.scale)) { scale = Math.max(0.25,Math.min(4,e.data.scale)); resize(); }
    if (e.data.type === 'reload' && typeof e.data.path === 'string') {
      const loaded = engine.ccall('preview_load','number',['string'],[e.data.path]);
      if (loaded) send('ready',{width:innerWidth,height:innerHeight});
      else send('error',{message:'The edited window could not be loaded. Check the code and renderer diagnostics.'});
    }
  });
  const mods = e => (e.ctrlKey?1:0)|(e.shiftKey?2:0)|(e.altKey?4:0)|(e.metaKey?8:0);
  canvas.addEventListener('pointermove',e => engine._preview_mouse(e.offsetX,e.offsetY,mods(e)));
  canvas.addEventListener('pointerdown',e => { canvas.focus(); canvas.setPointerCapture(e.pointerId); engine._preview_button(e.button === 1 ? 2 : e.button === 2 ? 1 : 0,1,mods(e)); });
  canvas.addEventListener('pointerup',e => engine._preview_button(e.button === 1 ? 2 : e.button === 2 ? 1 : 0,0,mods(e)));
  canvas.addEventListener('wheel',e => { e.preventDefault(); engine._preview_wheel(e.deltaY/60,mods(e)); },{passive:false});
  canvas.addEventListener('contextmenu',e => e.preventDefault());
  const keys = {Backspace:69,Tab:70,Enter:72,Escape:81,PageUp:86,PageDown:87,End:88,Home:89,ArrowLeft:90,ArrowUp:91,ArrowRight:92,ArrowDown:93,Insert:98,Delete:99,' ':1};
  function key(e, down) {
    const identifier = keys[e.key] || (/^[a-z]$/i.test(e.key) ? e.key.toUpperCase().charCodeAt(0)-65+12 : /^[0-9]$/.test(e.key) ? Number(e.key)+2 : 0);
    if (identifier) engine._preview_key(identifier,down,mods(e));
    if (down && e.key.length === 1 && !e.ctrlKey && !e.metaKey) call('preview_text',['string'],[e.key]);
    if (identifier) e.preventDefault();
  }
  canvas.addEventListener('keydown',e => key(e,1)); canvas.addEventListener('keyup',e => key(e,0));
} catch (error) { send('error',{message:error.message}); }
