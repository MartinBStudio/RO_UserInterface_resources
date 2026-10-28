import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// The portable bundle supplies shared files missing from individual theme packs.
export function bundledBase(previewDir) {
  const archive = path.join(previewDir,'base-ui.json.gz');
  if (!fs.existsSync(archive)) return null;
  const destination = path.join(previewDir,'.cache','base-ui');
  const marker = path.join(destination,'.bundle-version');
  const bytes = fs.readFileSync(archive);
  const version = createHash('sha256').update(bytes).digest('hex');
  const template = path.join(destination,'data/ui/themes/rose/templates/window-box.html');
  if (fs.existsSync(template) && fs.existsSync(marker) && fs.readFileSync(marker,'utf8') === version) return destination;
  const bundle = JSON.parse(gunzipSync(bytes,{maxOutputLength:256*1024*1024}));
  const entries = Object.entries(bundle.files).map(([relative,contents]) => {
    const file = path.resolve(destination,relative);
    const checked = path.relative(destination,file);
    if (!relative.startsWith('data/') || checked.startsWith('..') || path.isAbsolute(checked) || typeof contents !== 'string') throw Error('Invalid bundled base asset path');
    return [file,contents];
  });
  console.log('Preparing bundled base UI assets (first launch)...');
  for (const [file,contents] of entries) {
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,Buffer.from(contents,'base64'));
  }
  if (!fs.existsSync(template)) throw Error('Bundled base UI is missing window templates.');
  fs.writeFileSync(marker,version);
  return destination;
}
