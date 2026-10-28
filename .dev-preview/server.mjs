import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { bindRml } from './bindings.mjs';
import { decodeTexture } from './textures.mjs';
import { bundledBase } from './base-assets.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { isEditorSource, isPreviewableWindow } from './previewability.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.dirname(here);
const args = process.argv.slice(2);
const argument = name => args.includes(name) ? args[args.indexOf(name)+1] : undefined;
const exists = file => fs.existsSync(file);
const hasBase = dir => exists(path.join(dir, 'data/ui/themes/rose/templates/window-box.html'));
export function findBase(explicit, repositoryRoot = root) {
  const assetRoot = dir => [dir, path.join(dir,'assets')].find(hasBase);
  const directories = dir => {
    try { return fs.readdirSync(dir,{withFileTypes:true}).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => path.join(dir,d.name)); }
    catch { return []; }
  };
  if (explicit) {
    const dir = path.resolve(explicit);
    const found = assetRoot(dir) || directories(dir).map(assetRoot).find(Boolean);
    if (found) return found;
    throw Error(`Base UI templates not found under ${dir}. Pass the folder containing data/ui/themes/rose.`);
  }
  const parent = path.dirname(repositoryRoot);
  const names = ['rednim-rose-ui-public','rose-public','rose-public2'];
  const rank = dir => {
    const name = path.basename(dir).toLowerCase();
    const index = names.findIndex(base => name === base || name.startsWith(base+'-'));
    return index === -1 ? names.length : index;
  };
  const neighbors = directories(parent).filter(dir => dir !== repositoryRoot)
    .sort((a,b) => rank(a)-rank(b) || a.localeCompare(b));
  // ZIP downloads often add '-main'/'-master' or an extra wrapper directory.
  // Validate actual templates rather than requiring an exact repository name.
  for (const dir of [repositoryRoot,...neighbors]) {
    const found = assetRoot(dir);
    if (found) return found;
  }
  for (const dir of neighbors) {
    const found = directories(dir).map(assetRoot).find(Boolean);
    if (found) return found;
  }
  return bundledBase(path.join(repositoryRoot,'.dev-preview'));
}
export function contained(base, requested) {
  if (requested.includes('\0')) throw Error('Invalid path');
  const result = path.resolve(base, requested.replaceAll('\\','/').replace(/^\/+/, ''));
  const relative = path.relative(base, result);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Path outside asset root');
  if (exists(result)) {
    const physical = fs.realpathSync(result), physicalBase = fs.realpathSync(base);
    const rel = path.relative(physicalBase, physical);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Asset symlink outside root');
  }
  return result;
}
function themes(directory = root) {
  return fs.readdirSync(directory, {withFileTypes:true}).filter(d => d.isDirectory() && exists(path.join(directory,d.name,'manifestUi.json')))
    .map(d => {
      try { return {...JSON.parse(fs.readFileSync(path.join(directory,d.name,'manifestUi.json'),'utf8')), id:d.name}; }
      catch { return {id:d.name, name:d.name}; }
    }).sort((a,b) => a.id.localeCompare(b.id));
}
function walk(dir, prefix = '') {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(d => {
    const relative = path.posix.join(prefix,d.name);
    return d.isDirectory() ? walk(path.join(dir,d.name),relative) : [relative];
  });
}
export function createPreviewServer({base = findBase(argument('--base') || process.env.ROSE_UI_BASE), assets = argument('--assets') || process.env.ROSE_UI_ASSETS, watch = true, resourceRoot = root} = {}) {
  const extraAssets = assets ? path.resolve(assets) : null;
  const clients = new Set(), watchers = [], textureCache = new Map();
  const editToken = randomBytes(24).toString('hex'), drafts = new Map();
  const windowVisibility = new Map();
  const version = bytes => createHash('sha256').update(bytes).digest('hex');
  const editable = requested => /^\/data\/ui\/themes\/rose\/(?!.*(?:\.\.|\\|:))[\w./ -]+\.(html|rml|css|rcss)$/i.test(requested);
  const draftKey = (theme,requested) => `${theme}:${requested.toLowerCase()}`;
  const draftSource = (id,theme,requested) => drafts.get(id)?.get(draftKey(theme,requested));
  let revision = 0, debounce;
  const notify = filename => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      textureCache.clear(); revision++;
      for (const client of clients) client.write(`data: ${JSON.stringify({revision, file:filename})}\n\n`);
    }, 180);
  };
  if (watch) for (const dir of [resourceRoot, base, extraAssets].filter(Boolean)) {
    try {
      watchers.push(fs.watch(dir, {recursive:true}, (_, filename) => {
        const file = String(filename || '').replaceAll('\\','/');
        if (/(^|\/)(\.git|\.idea|node_modules|\.cache|test-results)(\/|$)/.test(file)) return;
        if (file.startsWith('.dev-preview/public/engine/')) return;
        notify(file);
      }));
    } catch (error) { console.warn(`Live reload unavailable for ${dir}: ${error.message}`); }
  }
  const themeRoot = id => {
    if (!id || !themes(resourceRoot).some(t => t.id === id)) throw Error('Unknown theme');
    return path.join(resourceRoot,id);
  };
  const resolveAsset = (theme, requested) => {
    const custom = contained(themeRoot(theme),requested);
    if (exists(custom) && fs.statSync(custom).isFile()) return {file:custom, layer:'theme'};
    if (base) {
      const fallback = contained(base,requested);
      if (exists(fallback) && fs.statSync(fallback).isFile()) return {file:fallback, layer:'base'};
    }
    if (extraAssets) {
      const fallback = contained(extraAssets,requested);
      if (exists(fallback) && fs.statSync(fallback).isFile()) return {file:fallback, layer:'assets'};
    }
    return null;
  };
  const server = http.createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const url = new URL(req.url,'http://localhost'), p = url.searchParams;
      const json = value => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
      if (req.method === 'POST' && ['/api/editor/draft','/api/editor/save'].includes(url.pathname)) {
        const origin = `http://${req.headers.host}`;
        if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) || req.headers.origin !== origin || req.headers['x-preview-token'] !== editToken) {
          res.writeHead(403).end('Editor request must come from this workshop.'); return;
        }
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2*1024*1024) { res.writeHead(413).end('Editor file is too large.'); return; }
          chunks.push(chunk);
        }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const {theme,path:requested,draft,source} = input;
        const dir = themeRoot(theme);
        if (typeof requested !== 'string' || !editable(requested) || typeof draft !== 'string' || !/^[\w-]{8,80}$/.test(draft)) { res.writeHead(400).end('Invalid editor path or draft.'); return; }
        const asset = resolveAsset(theme,requested);
        if (!asset) { res.writeHead(404).end('Choose an existing UI source file.'); return; }
        const key = draftKey(theme,requested);
        if (url.pathname === '/api/editor/draft') {
          if (source === null) drafts.get(draft)?.delete(key);
          else if (typeof source === 'string') {
            if (!drafts.has(draft)) { if (drafts.size >= 50) drafts.delete(drafts.keys().next().value); drafts.set(draft,new Map()); }
            const files = drafts.get(draft);
            if (!files.has(key) && files.size >= 128) { res.writeHead(413).end('Too many draft files. Save or discard some changes first.'); return; }
            files.set(key,source);
          } else { res.writeHead(400).end('Source must be text.'); return; }
          json({ok:true}); return;
        }
        if (typeof source !== 'string') { res.writeHead(400).end('Source must be text.'); return; }
        if (input.version !== version(fs.readFileSync(asset.file))) { res.writeHead(409).end('This file changed on disk. Reload its disk version before saving. Your draft is still available.'); return; }
        const target = contained(dir,requested);
        const newOverride = !exists(target);
        // Check the nearest existing ancestor too, before creating missing folders.
        let ancestor = path.dirname(target);
        while (!exists(ancestor)) ancestor = path.dirname(ancestor);
        contained(dir,path.relative(dir,ancestor));
        fs.mkdirSync(path.dirname(target),{recursive:true});
        fs.writeFileSync(target,source,'utf8');
        if (newOverride) for (const indexName of ['.pack/FILE_LIST.txt','FILE_LIST.txt']) {
          const index = contained(dir,indexName);
          if (!exists(index)) continue;
          const list = fs.readFileSync(index,'utf8');
          const relative = requested.slice(1).replaceAll('/','\\');
          if (!list.split(/\r?\n/).some(line => line.trim().replaceAll('/','\\').toLowerCase() === relative.toLowerCase())) {
            fs.writeFileSync(index,list.replace(/\s*$/,'')+'\r\n'+relative+'\r\n','utf8');
          }
        }
        drafts.get(draft)?.delete(key);
        notify(path.relative(resourceRoot,target));
        json({ok:true,file:target,layer:'theme',version:version(Buffer.from(source))}); return;
      }
      if (req.method !== 'GET') { res.writeHead(405).end('Unsupported request method'); return; }
      if (url.pathname === '/api/catalog') {
        json({themes:themes(resourceRoot), base, engine:exists(path.join(here,'public/engine/rose-preview.wasm')), revision,editToken}); return;
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, {'Content-Type':'text/event-stream','Connection':'keep-alive'});
        res.write(': connected\n\n'); clients.add(res);
        req.on('close',() => clients.delete(res)); return;
      }
      if (url.pathname === '/api/windows') {
        const theme = p.get('theme'), dir = themeRoot(theme), prefix = 'data/ui/themes/rose/';
        const custom = walk(path.join(dir,prefix));
        const all = [...new Set([...custom,...(base ? walk(path.join(base,prefix)) : [])])];
        const fixtureFile = path.join(here,'mock-data.json'), fixtureTime = fs.statSync(fixtureFile).mtimeMs;
        const fixtures = JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
        const visible = all.filter(f => /^(game|external|common)\/.*\.(html|rml)$/i.test(f)).filter(f => {
          const requested = '/'+prefix+f, asset = resolveAsset(theme,requested);
          if (!asset) return false;
          const stat = fs.statSync(asset.file), key = `${asset.file}:${stat.mtimeMs}:${stat.size}:${fixtureTime}`;
          if (!windowVisibility.has(key)) {
            if (windowVisibility.size > 3000) windowVisibility.clear();
            windowVisibility.set(key,isPreviewableWindow(requested,fs.readFileSync(asset.file,'utf8'),fixtures));
          }
          return windowVisibility.get(key);
        });
        json(visible.sort().map(f => ({path:'/'+prefix+f, name:f.replace(/\.(html|rml)$/i,''), overridden:custom.includes(f)}))); return;
      }
      if (url.pathname === '/api/editor/files') {
        const theme = p.get('theme'), start = p.get('path');
        themeRoot(theme);
        if (!start || !editable(start)) { res.writeHead(400).end('Invalid editor path'); return; }
        const files = [], seen = new Set(), queue = [start];
        while (queue.length && files.length < 150) {
          const requested = queue.shift();
          if (seen.has(requested) || !editable(requested)) continue;
          seen.add(requested);
          const asset = resolveAsset(theme,requested);
          if (!asset) continue;
          const source = draftSource(p.get('draft'),theme,requested) ?? fs.readFileSync(asset.file,'utf8');
          if (!isEditorSource(requested,source)) continue;
          files.push({path:requested,layer:asset.layer});
          const links = requested.endsWith('.html') || requested.endsWith('.rml') ? /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi : /@import\s+(?:url\(\s*)?["']([^"']+)["']/gi;
          for (const match of source.matchAll(links)) {
            const linked = new URL(match[1],'http://assets'+requested);
            if (linked.origin === 'http://assets') queue.push(decodeURIComponent(linked.pathname));
          }
        }
        json(files); return;
      }
      if (['/api/asset','/api/texture','/api/source'].includes(url.pathname)) {
        const requested = p.get('path') || '', asset = resolveAsset(p.get('theme'),requested);
        if (!asset) { res.writeHead(404).end(`Missing asset: ${requested}`); return; }
        const disk = fs.readFileSync(asset.file), extension = path.extname(asset.file).toLowerCase();
        if (url.pathname === '/api/source') { json({...asset, source:disk.toString('utf8'),version:version(disk)}); return; }
        const draft = draftSource(p.get('draft'),p.get('theme'),'/'+requested.replaceAll('\\','/').replace(/^\/+/,''));
        const raw = draft === undefined ? disk : Buffer.from(draft);
        if (url.pathname === '/api/texture') {
          const stat = fs.statSync(asset.file), key = `${asset.file}:${stat.mtimeMs}`;
          let bytes = textureCache.get(key);
          if (!bytes) { bytes = decodeTexture(raw,extension); if (textureCache.size > 180) textureCache.clear(); textureCache.set(key,bytes); }
          res.setHeader('Content-Type','application/octet-stream'); res.end(bytes); return;
        }
        if (extension === '.html' || extension === '.rml') {
          const fixtures = JSON.parse(fs.readFileSync(path.join(here,'mock-data.json'),'utf8'));
          const options = {preset:p.get('preset') || 'normal'};
          if (p.has('mode')) options.mode = p.get('mode');
          if (p.has('tab')) options.tab = p.get('tab');
          res.setHeader('Content-Type','text/plain; charset=utf-8');
          res.end(bindRml(raw.toString('utf8'),fixtures,options)); return;
        }
        res.setHeader('Content-Type','application/octet-stream'); res.end(raw); return;
      }
      const filename = contained(path.join(here,'public'), decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!exists(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end('Not found'); return; }
      const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};
      res.setHeader('Content-Type',mime[path.extname(filename)] || 'application/octet-stream');
      fs.createReadStream(filename).pipe(res);
    } catch (error) {
      console.error(error.message);
      res.writeHead(/path|theme/i.test(error.message) ? 400 : 500, {'Content-Type':'text/plain; charset=utf-8'}).end(error.message);
    }
  });
  server.on('close', () => { clearTimeout(debounce); watchers.forEach(w => w.close()); clients.forEach(c => c.end()); });
  return server;
}
export function listenAvailable(server, port = 4173) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) return Promise.reject(Error('Port must be an integer between 0 and 65535.'));
  return new Promise((resolve, reject) => {
    const attempt = candidate => {
      const cleanup = () => { server.removeListener('error', failed); server.removeListener('listening', ready); };
      const ready = () => { cleanup(); resolve(server.address().port); };
      const failed = error => {
        cleanup();
        if (error.code === 'EADDRINUSE' && candidate !== 0) attempt(candidate === 65535 ? 0 : candidate + 1);
        else if (error.code === 'EACCES' && candidate !== 0) attempt(0);
        else reject(error);
      };
      server.once('error', failed); server.once('listening', ready);
      server.listen(candidate, '127.0.0.1');
    };
    attempt(port);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(argument('--port') || process.env.PORT || 4173);
  try {
    const base = findBase(argument('--base') || process.env.ROSE_UI_BASE);
    const server = createPreviewServer({base});
    // Windows sends SIGHUP when this console is closed. Exit promptly so open
    // browser connections and filesystem watchers cannot keep the server alive.
    for (const signal of ['SIGINT','SIGTERM','SIGHUP']) process.once(signal, () => {
      console.log('\nStopping ROSE UI Workshop.');
      server.closeAllConnections();
      process.exit(0);
    });
    listenAvailable(server, port).then(actualPort => {
      const url = `http://127.0.0.1:${actualPort}`;
      console.log(`\nROSE UI development preview: ${url}\nBase assets: ${base || 'Not found — pass --base <assets-folder>'}\nSave HTML, RCSS, textures, or mock-data.json to reload. Ctrl+C stops the server.\n`);
      if (args.includes('--open')) {
        if (process.platform === 'win32') spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}).unref();
        else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open',[url],{stdio:'ignore'}).unref();
      }
    }).catch(error => { console.error(error.message); process.exit(1); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
