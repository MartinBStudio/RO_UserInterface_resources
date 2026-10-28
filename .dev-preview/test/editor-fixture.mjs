import fs from 'node:fs';
import path from 'node:path';
import { root } from '../server.mjs';

export function editorFixture() {
  const cache = path.join(root,'.dev-preview','.cache');
  fs.mkdirSync(cache,{recursive:true});
  const fixture = fs.mkdtempSync(path.join(cache,'editor-test-'));
  const resourceRoot = path.join(fixture,'themes'), theme = 'EditorTheme', dir = path.join(resourceRoot,theme);
  const window = '/data/ui/themes/rose/game/editor_test.html', css = '/data/ui/themes/rose/styles/editor_test.css';
  fs.mkdirSync(path.join(dir,'data/ui/themes/rose/game'),{recursive:true});
  fs.mkdirSync(path.join(dir,'data/ui/themes/rose/styles'),{recursive:true});
  fs.mkdirSync(path.join(dir,'.pack'));
  fs.writeFileSync(path.join(dir,'manifestUi.json'),JSON.stringify({name:theme}));
  fs.writeFileSync(path.join(dir,'.pack/FILE_LIST.txt'),'data\\ui\\themes\\rose\\game\\editor_test.html\r\n');
  const source = '<rml><head><title>Editor test</title><link type="text/rcss" href="../styles/editor_test.css" /></head><body><div id="message">Original preview text</div></body></rml>';
  const stylesheet = 'body { font-family: Nunito; font-size: 20dp; color: white; width: 300dp; height: 180dp; background-color: rgb(20, 40, 60); padding: 20dp; }';
  fs.writeFileSync(path.join(dir,window),source);
  fs.writeFileSync(path.join(dir,css),stylesheet);
  return {resourceRoot,theme,dir,window,css,source,stylesheet,fixture,cleanup() {
    if (path.dirname(fixture) !== cache) throw Error('Unexpected fixture path');
    fs.rmSync(fixture,{recursive:true,force:true});
  }};
}
