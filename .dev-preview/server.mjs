import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { bindRml } from './bindings.mjs';
import { decodeTexture } from './textures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.dirname(here);
const args = process.argv.slice(2);
const argument = name => args.includes(name) ? args[args.indexOf(name)+1] : undefined;
const exists = file => fs.existsSync(file);
const hasBase = dir => exists(path.join(dir, 'data/ui/themes/rose/templates/window-box.html'));
export function findBase(explicit) {
  if (explicit) {
    const dir = path.resolve(explicit);
    for (const candidate of [dir, path.join(dir,'assets')]) if (hasBase(candidate)) return candidate;
    throw Error(`Base UI templates not found under ${dir}. Pass the folder containing data/ui/themes/rose.`);
  }
  const parent = path.dirname(root);
  for (const name of ['rednim-rose-ui-public','rose-public','rose-public2']) {
    const candidate = path.join(parent,name,'assets');
    if (hasBase(candidate)) return candidate;
  }
  return null;
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
function themes() {
  return fs.readdirSync(root, {withFileTypes:true}).filter(d => d.isDirectory() && exists(path.join(root,d.name,'manifestUi.json')))
    .map(d => {
      try { return {...JSON.parse(fs.readFileSync(path.join(root,d.name,'manifestUi.json'),'utf8')), id:d.name}; }
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
export function createPreviewServer({base = findBase(argument('--base') || process.env.ROSE_UI_BASE), assets = argument('--assets') || process.env.ROSE_UI_ASSETS, watch = true} = {}) {
  const extraAssets = assets ? path.resolve(assets) : null;
  const clients = new Set(), watchers = [], textureCache = new Map();
  let revision = 0, debounce;
  const notify = filename => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      textureCache.clear(); revision++;
      for (const client of clients) client.write(`data: ${JSON.stringify({revision, file:filename})}\n\n`);
    }, 180);
  };
  if (watch) for (const dir of [root, base, extraAssets].filter(Boolean)) {
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
    if (!id || !themes().some(t => t.id === id)) throw Error('Unknown theme');
    return path.join(root,id);
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
    if (req.method !== 'GET') { res.writeHead(405).end('Read-only preview server'); return; }
    try {
      const url = new URL(req.url,'http://localhost'), p = url.searchParams;
      const json = value => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
      if (url.pathname === '/api/catalog') {
        json({themes:themes(), base, engine:exists(path.join(here,'public/engine/rose-preview.wasm')), revision}); return;
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, {'Content-Type':'text/event-stream','Connection':'keep-alive'});
        res.write(': connected\n\n'); clients.add(res);
        req.on('close',() => clients.delete(res)); return;
      }
      if (url.pathname === '/api/windows') {
        const dir = themeRoot(p.get('theme')), prefix = 'data/ui/themes/rose/';
        const custom = walk(path.join(dir,prefix));
        const all = [...new Set([...custom,...(base ? walk(path.join(base,prefix)) : [])])];
        json(all.filter(f => /^(game|external|common)\/.*\.html$/i.test(f)).sort().map(f => ({path:'/'+prefix+f, name:f.replace('.html',''), overridden:custom.includes(f)}))); return;
      }
      if (['/api/asset','/api/texture','/api/source'].includes(url.pathname)) {
        const requested = p.get('path') || '', asset = resolveAsset(p.get('theme'),requested);
        if (!asset) { res.writeHead(404).end(`Missing asset: ${requested}`); return; }
        const raw = fs.readFileSync(asset.file), extension = path.extname(asset.file).toLowerCase();
        if (url.pathname === '/api/source') { json({...asset, source:raw.toString('utf8')}); return; }
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
