export function createEditor({getContext, getToken, onPreview, onSaved}) {
  const $ = id => document.getElementById(id);
  const draftId = crypto.randomUUID();
  const documents = new Map();
  let active, contextKey = '', request = 0, timer, scheduled;
  const dirty = doc => doc && doc.text !== doc.disk;
  const status = (message, failed = false) => { $('editor-status').textContent = message; $('editor-status').classList.toggle('failed',failed); };
  const params = (theme,path) => new URLSearchParams({theme,path,draft:draftId});
  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) throw Error(await response.text());
    return response.json();
  }
  async function post(endpoint, doc, values) {
    const response = await fetch('/api/editor/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Token':getToken()},body:JSON.stringify({theme:doc.theme,path:doc.path,draft:draftId,...values})});
    if (!response.ok) throw Error(await response.text());
    return response.json();
  }
  function buttons() {
    $('editor-save').disabled = !dirty(active) || active.saving;
    $('editor-discard').disabled = !dirty(active) || active.saving;
    const count = [...documents.values()].filter(dirty).length;
    $('editor-dirty').textContent = count ? `${count} unsaved file${count === 1 ? '' : 's'}` : 'All changes saved';
  }
  function lines() {
    $('editor-lines').textContent = Array.from({length:$('code-editor').value.split('\n').length},(_,i) => i+1).join('\n');
    $('editor-lines').scrollTop = $('code-editor').scrollTop;
  }
  function show(doc) {
    active = doc; $('code-editor').value = doc.text; $('code-editor').disabled = false;
    $('editor-path').textContent = doc.path.replace('/data/ui/themes/rose/','');
    $('editor-path').title = doc.file;
    $('editor-layer').textContent = doc.layer === 'theme' ? 'Theme file' : 'Base file · Save creates a theme override';
    status(dirty(doc) ? 'Unsaved changes · preview uses your draft' : 'Edit code to update the preview');
    lines(); buttons();
  }
  async function selectFile(path) {
    flushScheduled();
    const sequence = ++request, {theme} = getContext(), key = theme+'|'+path;
    let doc = documents.get(key);
    if (!doc) {
      $('code-editor').disabled = true; status('Loading source…');
      const disk = await read('/api/source?'+params(theme,path));
      doc = {theme,path,text:disk.source,disk:disk.source,version:disk.version,file:disk.file,layer:disk.layer,pending:Promise.resolve()};
      documents.set(key,doc);
    }
    if (sequence !== request || theme !== getContext().theme) return;
    show(doc);
  }
  function report(error) { status(error.message,true); buttons(); }
  function flushScheduled() {
    clearTimeout(timer);
    if (scheduled) { const doc = scheduled; scheduled = undefined; apply(doc); }
  }
  function apply(doc) {
    const source = doc.text;
    doc.pending = doc.pending.catch(() => {}).then(async () => {
      await post('draft',doc,{source:source === doc.disk ? null : source});
      if (source === doc.text && doc.theme === getContext().theme) {
        onPreview();
        if (active === doc) status(dirty(doc) ? 'Preview updated · unsaved changes' : 'Preview restored to saved code');
      }
    });
    doc.pending.catch(report);
    return doc.pending;
  }
  $('editor-file').addEventListener('change',() => selectFile($('editor-file').value).catch(report));
  $('code-editor').addEventListener('input',() => {
    if (!active) return;
    active.text = $('code-editor').value; lines(); buttons();
    status('Updating preview…'); clearTimeout(timer);
    const doc = active;
    scheduled = doc;
    timer = setTimeout(flushScheduled,250);
  });
  $('code-editor').addEventListener('scroll',() => { $('editor-lines').scrollTop = $('code-editor').scrollTop; });
  $('code-editor').addEventListener('keydown',event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      // Native insertion preserves the browser's textarea undo history.
      document.execCommand('insertText',false,'    ');
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('editor-save').click(); }
  });
  $('editor-save').addEventListener('click',async () => {
    if (!dirty(active)) return;
    const doc = active, source = doc.text;
    clearTimeout(timer); scheduled = undefined; doc.saving = true; $('code-editor').disabled = true; buttons(); status('Saving theme file…');
    try {
      await apply(doc);
      const saved = await post('save',doc,{source,version:doc.version});
      doc.disk = source; doc.version = saved.version; doc.file = saved.file; doc.layer = 'theme';
      if (doc.text !== source) await apply(doc);
      if (active === doc) { $('editor-layer').textContent = 'Theme file'; $('editor-path').title = saved.file; status('Saved to '+saved.file); }
      onSaved();
    } catch (error) { report(error); }
    finally { doc.saving = false; if (active === doc) $('code-editor').disabled = false; buttons(); }
  });
  $('editor-discard').addEventListener('click',async () => {
    if (!active) return;
    const doc = active; clearTimeout(timer); scheduled = undefined;
    try {
      await doc.pending.catch(() => {});
      const disk = await read('/api/source?'+params(doc.theme,doc.path));
      await post('draft',doc,{source:null});
      Object.assign(doc,{disk:disk.source,text:disk.source,version:disk.version,file:disk.file,layer:disk.layer});
      if (active === doc) show(doc);
      onPreview();
    } catch (error) { report(error); }
  });
  window.addEventListener('beforeunload',event => {
    if ([...documents.values()].some(dirty)) { event.preventDefault(); event.returnValue = ''; }
  });
  return {
    draftId,
    async openContext() {
      const {theme,path} = getContext(), key = theme+'|'+path;
      if (key === contextKey) return;
      flushScheduled();
      contextKey = key; active = undefined; request++; $('code-editor').disabled = true; buttons();
      try {
        const files = await read('/api/editor/files?'+params(theme,path));
        if (key !== contextKey) return;
        $('editor-file').replaceChildren(...files.map(f => new Option(`${f.layer === 'theme' ? '●' : '○'} ${f.path.replace('/data/ui/themes/rose/','')}`,f.path)));
        await selectFile(path);
      } catch (error) { report(error); }
    },
    async refreshDisk() {
      const doc = active;
      if (!doc || doc.saving) return;
      try {
        const disk = await read('/api/source?'+params(doc.theme,doc.path));
        if (doc !== active || disk.version === doc.version) return;
        if (dirty(doc)) { status('File changed on disk. Your draft is preserved; discard to reload, or copy your edits before resolving.',true); return; }
        Object.assign(doc,{disk:disk.source,text:disk.source,version:disk.version,file:disk.file,layer:disk.layer}); show(doc);
      } catch (error) { report(error); }
    }
  };
}
