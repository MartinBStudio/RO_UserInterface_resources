import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isEditorSource, isPreviewableWindow } from '../previewability.mjs';
const fixtures = JSON.parse(fs.readFileSync(new URL('../mock-data.json',import.meta.url)));

test('source lists exclude unsupported, empty, binary, and unresolved LFS files',() => {
  assert.equal(isEditorSource('script.lua','return true'),false);
  assert.equal(isEditorSource('sprite.dds','DDS '),false);
  assert.equal(isEditorSource('empty.css','/* nothing here */'),false);
  assert.equal(isEditorSource('sheet.css','version https://git-lfs.github.com/spec/v1\noid sha256:123'),false);
  assert.equal(isEditorSource('bad.html','\0<rml/>'),false);
  assert.equal(isEditorSource('window.html','<rml><body>Window</body></rml>'),true);
  assert.equal(isEditorSource('style.rcss','body { color: red; }'),true);
});
test('window list hides blank game layers while preserving visible windows and controls',() => {
  const visible = body => isPreviewableWindow('game/test.html',`<rml><head/><body>${body}</body></rml>`,fixtures);
  assert.equal(visible('<!-- empty -->'),false);
  assert.equal(visible('<character-nameplates/>'),false);
  assert.equal(visible('<div data-for="plate : nameplates">{{plate.name}}</div>'),false);
  assert.equal(visible('<img data-attr-src="missing_image"/><button class="window-title-close"/>'),false);
  assert.equal(visible('<div style="display:none">Hidden text</div>'),false);
  assert.equal(visible('<span>{{name}}</span>'),true);
  assert.equal(visible('<img sprite="itemicon-1"/>'),true);
  assert.equal(visible('<button class="default"/>'),true);
});
