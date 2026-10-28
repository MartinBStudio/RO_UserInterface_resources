import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindRml, expression } from '../bindings.mjs';
import { decodeDDS } from '../textures.mjs';
import { contained, createPreviewServer, findBase, listenAvailable, root } from '../server.mjs';
import http from 'node:http';
import { dimensions, fitScale } from '../public/display.mjs';
import { bundledBase } from '../base-assets.mjs';
import { gzipSync } from 'node:zlib';

test('portable installation extracts and reuses its included shared base assets',t => {
  const cache = path.join(root,'.dev-preview','.cache');
  fs.mkdirSync(cache,{recursive:true});
  const fixture = fs.mkdtempSync(path.join(cache,'portable-base-'));
  t.after(() => { assert.equal(path.dirname(fixture),cache); fs.rmSync(fixture,{recursive:true,force:true}); });
  const relative = 'data/ui/themes/rose/templates/window-box.html';
  fs.writeFileSync(path.join(fixture,'base-ui.json.gz'),gzipSync(JSON.stringify({files:{[relative]:Buffer.from('<template/>').toString('base64')}})));
  const base = bundledBase(fixture);
  assert.equal(fs.readFileSync(path.join(base,relative),'utf8'),'<template/>');
  const modified = fs.statSync(path.join(base,relative)).mtimeMs;
  assert.equal(bundledBase(fixture),base);
  assert.equal(fs.statSync(path.join(base,relative)).mtimeMs,modified);
  fs.writeFileSync(path.join(fixture,'base-ui.json.gz'),gzipSync(JSON.stringify({files:{'data/../../outside':'bad'}})));
  assert.throws(() => bundledBase(fixture),/Invalid bundled/);
});

test('finds neighboring downloaded repositories, renamed folders, and ZIP wrappers',t => {
  const cache = path.join(root,'.dev-preview','.cache');
  fs.mkdirSync(cache,{recursive:true});
  const fixture = fs.mkdtempSync(path.join(cache,'base-discovery-'));
  t.after(() => {
    assert.equal(path.dirname(fixture),cache);
    fs.rmSync(fixture,{recursive:true,force:true});
  });
  const repository = path.join(fixture,'RO_UserInterface_resources-main');
  fs.mkdirSync(repository);
  assert.equal(findBase(undefined,repository),null);
  function addBase(relative) {
    const base = path.join(fixture,relative);
    const templates = path.join(base,'data/ui/themes/rose/templates');
    fs.mkdirSync(templates,{recursive:true}); fs.writeFileSync(path.join(templates,'window-box.html'),'<template/>');
    return base;
  }
  const wrapped = addBase('download/rednim-rose-ui-public-main/assets');
  assert.equal(findBase(undefined,repository),wrapped);
  const renamed = addBase('my-base-files/assets');
  assert.equal(findBase(undefined,repository),renamed);
  const downloaded = addBase('rednim-rose-ui-public-main/assets');
  assert.equal(findBase(undefined,repository),downloaded);
  assert.equal(findBase(path.join(fixture,'download'),repository),wrapped);
});

test('startup skips an occupied port and reports the actual reachable address',async t => {
  const occupied = http.createServer();
  const preview = http.createServer((req,res) => res.end('preview'));
  t.after(() => Promise.all([occupied,preview].map(server => new Promise(resolve => server.close(resolve)))));
  const occupiedPort = await listenAvailable(occupied,0);
  const actualPort = await listenAvailable(preview,occupiedPort);
  assert.notEqual(actualPort,occupiedPort);
  assert.equal(await (await fetch(`http://127.0.0.1:${actualPort}`)).text(),'preview');
  await assert.rejects(listenAvailable(http.createServer(),-1),/Port must/);
});

test('simulated resolution is independent of fit zoom and UI scale',() => {
  assert.deepEqual(dimensions('1920x1080',0,0,1000,700),{width:1920,height:1080});
  assert.deepEqual(dimensions('auto',0,0,1000.5,700.5),{width:1000,height:700});
  assert.deepEqual(dimensions('custom',99999,-10,1000,700),{width:7680,height:240});
  assert.equal(fitScale(3840,2160,960,600),0.25);
  assert.equal(fitScale(640,480,960,600),1);
});

const fixtures = JSON.parse(fs.readFileSync(new URL('../mock-data.json',import.meta.url)));
test('binds conditional rows, model scopes, classes, and literal text without executing calls',() => {
  const result = bindRml('<rml><body data-model="party"><p>{{level}}</p><div data-for="m : members" data-if="m.available" data-class-leader="m.leader">{{m.name}}<gauge data-attr-gvalue="m.hp_percent" gmax="100"/></div><script>bad()</script></body></rml>',fixtures);
  assert.match(result,/<p>24<\/p>/); assert.match(result,/class="leader"/);
  assert.match(result,/value="85"/); assert.match(result,/LunaCleric/);
  assert.doesNotMatch(result,/data-|\{\{|<script/);
  assert.equal(expression('constructor.constructor("return process")()',{}),'');
  assert.equal(expression('members.size > 0 && level == 120',fixtures.defaults),true);
  assert.equal(expression('health * 100 / max_health | format(0)',fixtures.defaults),'75');
});
test('empty and low-health states alter the actual document',() => {
  const source = '<rml><body><p>{{health}}</p><div data-for="member : members">{{member.name}}</div></body></rml>';
  assert.match(bindRml(source,fixtures,{preset:'low-health'}),/<p>560<\/p>/);
  assert.doesNotMatch(bindRml(source,fixtures,{preset:'empty'}),/LunaCleric/);
});
test('decodes BC1 transparency, BC2 and BC3 alpha, and RGBA masks',() => {
  function block(format, bytes) {
    const b = Buffer.alloc(128+bytes); b.write('DDS '); b.writeUInt32LE(124,4); b.writeUInt32LE(4,12); b.writeUInt32LE(4,16); b.write(format,84);
    return b;
  }
  const bc1 = block('DXT1',8); bc1.writeUInt16LE(0xf800,128); bc1.writeUInt16LE(0x07e0,130);
  assert.deepEqual([...decodeDDS(bc1).data.subarray(0,4)],[255,0,0,255]);
  bc1.writeUInt16LE(0,128); bc1.writeUInt16LE(65535,130); bc1.writeUInt32LE(0xffffffff,132);
  assert.equal(decodeDDS(bc1).data[3],0);
  const bc2 = block('DXT3',16); bc2.fill(0x88,128,136); bc2.writeUInt16LE(0xf800,136);
  assert.equal(decodeDDS(bc2).data[3],136);
  const bc3 = block('DXT5',16); bc3[128] = 192; bc3[129] = 20; bc3.writeUInt16LE(0x001f,136);
  assert.deepEqual([...decodeDDS(bc3).data.subarray(0,4)],[0,0,255,192]);
  const rgba = block('',64); rgba.writeUInt32LE(32,88); rgba.writeUInt32LE(255,92); rgba.writeUInt32LE(65280,96); rgba.writeUInt32LE(16711680,100); rgba.writeUInt32LE(4278190080,104); rgba.set([10,20,30,40],128);
  assert.deepEqual([...decodeDDS(rgba).data.subarray(0,4)],[10,20,30,40]);
  assert.throws(() => decodeDDS(Buffer.from('bad')),/header/);
});
test('asset roots reject traversal',() => {
  assert.throws(() => contained(root,'../../secret'),/outside/);
  assert.throws(() => contained(root,'C:/Windows/win.ini'),/outside/);
  assert.match(contained(root,'/Arua/manifestUi.json'),/manifestUi.json$/);
});
test('server lists themes and windows, overlays base assets, and serves decoded textures',async t => {
  const base = findBase(); assert.ok(base,'Set ROSE_UI_BASE or place the base UI repository alongside this repository');
  const server = createPreviewServer({base,watch:false});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const catalog = await (await fetch(origin+'/api/catalog')).json();
  assert.ok(catalog.themes.some(theme => theme.id === 'Arua'));
  const windows = await (await fetch(origin+'/api/windows?theme=Arua')).json();
  assert.ok(windows.some(w => w.name === 'game/inventory' && w.overridden));
  const source = await (await fetch(origin+'/api/source?theme=Arua&path=/data/ui/themes/rose/templates/window-box.html')).json();
  assert.equal(source.layer,'base');
  const rendered = await (await fetch(origin+'/api/asset?theme=Arua&path=/data/ui/themes/rose/game/hud.html&preset=low-health')).text();
  assert.match(rendered,/value="560"/); assert.doesNotMatch(rendered,/\{\{/);
  const texture = await fetch(origin+'/api/texture?theme=Arua&path=/data/ui/themes/rose/imgs/iceinv.dds');
  assert.equal(texture.status,200); assert.ok((await texture.arrayBuffer()).byteLength > 8);
  assert.equal((await fetch(origin+'/api/asset?theme=Arua&path=../../README.md')).status,400);
  assert.equal((await fetch(origin+'/api/windows?theme=../rose-public')).status,400);
});
