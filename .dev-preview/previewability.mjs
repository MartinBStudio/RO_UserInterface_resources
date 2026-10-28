import { load } from 'cheerio';
import { bindRml } from './bindings.mjs';

export function isEditorSource(filename, source) {
  if (!/\.(html|rml|css|rcss)$/i.test(filename) || source.includes('\0')) return false;
  const text = source.trim();
  if (!text || text.startsWith('version https://git-lfs.github.com/spec/')) return false;
  if (/\.(html|rml)$/i.test(filename)) return /<(rml|html|body|template)\b/i.test(text.replace(/<!--[\s\S]*?-->/g,''));
  return Boolean(text.replace(/\/\*[\s\S]*?\*\//g,'').trim());
}

export function isPreviewableWindow(filename, source, fixtures) {
  if (!/\.(html|rml)$/i.test(filename) || !isEditorSource(filename,source)) return false;
  const $ = load(bindRml(source,fixtures),{xmlMode:true});
  const body = $('body').first();
  if (!body.length) return false;
  body.find('script,style,head').remove();
  body.find('[style]').each((_,element) => {
    if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/i.test($(element).attr('style'))) $(element).remove();
  });
  // Close buttons and empty handles alone do not make a useful preview.
  body.find('.window-title-close,[preview-action="close"]').remove();
  if (body.text().trim()) return true;
  return body.find('img').toArray().some(el => Boolean($(el).attr('src')?.trim() || $(el).attr('sprite')?.trim())) ||
    body.find('button,input:not([type="hidden"]),select,textarea,gauge,progress').length > 0;
}
