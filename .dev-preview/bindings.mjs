import { load } from 'cheerio';
import jsep from 'jsep';

const forbidden = new Set(['__proto__','prototype','constructor']);
function evaluate(node, scope) {
  if (!node) return '';
  switch (node.type) {
    case 'Literal': return node.value;
    case 'Identifier': return forbidden.has(node.name) ? '' : scope[node.name] ?? '';
    case 'ArrayExpression': return node.elements.map(n => evaluate(n, scope));
    case 'MemberExpression': {
      const object = evaluate(node.object, scope), key = node.computed ? evaluate(node.property, scope) : node.property.name;
      if (forbidden.has(String(key))) return '';
      if (key === 'size' && (Array.isArray(object) || typeof object === 'string')) return object.length;
      return object?.[key] ?? '';
    }
    case 'UnaryExpression': {
      const value = evaluate(node.argument, scope);
      return ({'!':() => !value, '-':() => -value, '+':() => +value, '~':() => ~value})[node.operator]?.() ?? '';
    }
    case 'ConditionalExpression': return evaluate(node.test, scope) ? evaluate(node.consequent, scope) : evaluate(node.alternate, scope);
    case 'BinaryExpression': {
      const a = evaluate(node.left, scope);
      if (node.operator === '&&') return a && evaluate(node.right, scope);
      if (node.operator === '||') return a || evaluate(node.right, scope);
      const b = evaluate(node.right, scope);
      return ({'+':() => a+b, '-':() => a-b, '*':() => a*b, '/':() => b ? a/b : 0, '%':() => a%b,
        '==':() => a == b, '!=':() => a != b, '===':() => a === b, '!==':() => a !== b,
        '>':() => a>b, '<':() => a<b, '>=':() => a>=b, '<=':() => a<=b})[node.operator]?.() ?? '';
    }
    default: return ''; // No function calls or executable game code.
  }
}
export function expression(text, scope) {
  try {
    const parts = text.split(/(?<!\|)\|(?!\|)/), value = evaluate(jsep(parts.shift().trim()), scope);
    if (!parts.length) return Number.isNaN(value) ? '' : value;
    const format = parts.join('|').match(/format\((\d+)\)/);
    return format ? Number(value).toFixed(Math.min(6, Number(format[1]))) : String(value);
  } catch { return ''; }
}

export function bindRml(source, fixtures, options = {}) {
  const $ = load(source, {xmlMode:true, decodeEntities:true});
  const defaults = {...fixtures.defaults, ...fixtures.presets[options.preset || 'normal']};
  if (options.mode !== undefined) defaults.mode = Number(options.mode);
  if (options.tab !== undefined) defaults.tab_index = Number(options.tab);
  let slots = 0;
  function visit(node, inherited, depth = 0) {
    if (depth > 100) return;
    if (node.type === 'text') {
      node.data = node.data.replace(/\{\{([\s\S]*?)\}\}/g, (_, text) => String(expression(text, inherited)));
      return;
    }
    if (!node.attribs) return;
    if (['style','script'].includes(node.name)) {
      if (node.name === 'script') $(node).remove();
      return;
    }
    const el = $(node), attrs = {...node.attribs};
    const scope = attrs['data-model'] ? {...inherited, ...fixtures.models[attrs['data-model']]} : inherited;
    if (attrs['data-for']) {
      const parts = attrs['data-for'].split(':').map(s => s.trim());
      const names = (parts.length > 1 ? parts[0] : 'it, it_index').split(',').map(s => s.trim());
      const values = expression(parts.at(-1), scope);
      el.removeAttr('data-for');
      if (Array.isArray(values)) values.slice(0, 100).forEach((value, index) => {
        const clone = el.clone(); el.before(clone);
        visit(clone[0], {...scope, [names[0]]:value, [names[1] || 'it_index']:index, it_index:index}, depth+1);
      });
      el.remove(); return;
    }
    if (attrs['data-if'] && !expression(attrs['data-if'], scope)) { el.remove(); return; }
    let style = attrs.style || '';
    for (const [name, value] of Object.entries(attrs)) {
      if (name.startsWith('data-class-')) {
        const className = name.slice(11);
        const classes = new Set((el.attr('class') || '').split(/\s+/).filter(Boolean));
        if (expression(value, scope)) classes.add(className); else classes.delete(className);
        el.attr('class', [...classes].join(' '));
      } else if (name.startsWith('data-style-')) {
        const result = expression(value, scope);
        if (result !== '') style += `;${name.slice(11)}:${result}`;
      } else if (name.startsWith('data-attrif-')) {
        if (expression(value, scope)) el.attr(name.slice(12), ''); else el.removeAttr(name.slice(12));
      } else if (name.startsWith('data-attr-')) {
        const target = name.slice(10), result = String(expression(value, scope));
        if (target.startsWith('on')) { if (target === 'onclick') el.attr('preview-action', result); }
        else el.attr(target, result);
      } else if (name === 'data-value') el.attr('value', String(expression(value, scope)));
      else if (name.startsWith('on')) { if (name === 'onclick') el.attr('preview-action', value); el.removeAttr(name); }
      if (name.startsWith('data-')) el.removeAttr(name);
    }
    if (style) el.attr('style', style);
    for (const child of [...node.children || []]) visit(child, scope, depth+1);
    if (node.name === 'gauge') {
      const value = Number(el.attr('gvalue') || 0), max = Number(el.attr('gmax') || 100);
      el.attr('value', String(value)); el.attr('max', String(max || 100));
      // These labels are normally filled by the game's custom gauge implementation.
      el.find('template').remove();
      if (!el.text().trim()) el.append(`<span>${value} / ${max}</span>`);
      el.find('label#value').text(String(value)); el.find('label#max').text(String(max));
      el.find('label#percent').text(String(Math.round(100*value/(max || 100))));
    }
    if (node.name === 'item-slot') {
      const index = slots++;
      if (options.preset !== 'empty' && index % 4 !== 3) el.append(`<img sprite="itemicon-${120+index%80}" style="width:100%;height:100%;" />`);
    }
    if (node.name === 'virtual-list-box') {
      el.append('<div style="padding:6dp;color:rgb(255,225,155)">Welcome to Junon Polis!</div><div style="padding:6dp">[Party] LunaCleric: Ready for another adventure?</div><div style="padding:6dp;color:rgb(120,230,150)">Offline UI preview — sample chat messages.</div>');
    }
    if (['character-preview','avatar-preview','minimap'].includes(node.name)) {
      el.append('<div style="padding:12dp;color:rgb(160,175,195)">Game scene preview</div>');
    }
    if (node.name === 'str' && !el.text().trim()) {
      el.text(el.attr('job-name') ? 'Knight' : `[text ${el.attr('string-id') || ''}]`);
    }
    if (node.name === 'str' && el.attr('job-name')) el.text('Knight');
  }
  for (const child of [...$.root()[0].children]) visit(child, defaults);
  return $.xml();
}
