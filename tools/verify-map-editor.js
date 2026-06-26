const fs = require('fs');
const vm = require('vm');

const EDITOR_FILE = 'map-editor.html';

function readEditorScript() {
  const html = fs.readFileSync(EDITOR_FILE, 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('map-editor.html missing inline script');
  return { html, script: match[1] };
}

function extractLevels(html) {
  const startMatch = /const\s+LEVELS\s*=\s*\[/.exec(html);
  const start = startMatch ? startMatch.index : -1;
  const arrStart = startMatch ? html.indexOf('[', start) : -1;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  for (let i = arrStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (start < 0 || arrStart < 0 || end < 0) throw new Error('Could not locate LEVELS array');
  return JSON.parse(html.slice(arrStart, end));
}

function normalizePoint(p) {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p?.x, y: p?.y };
}

function validateLevels(levels) {
  const issues = [];
  if (!Array.isArray(levels) || !levels.length) issues.push('LEVELS is empty');
  levels.forEach((lv, idx) => {
    const label = lv?.id || lv?.name || `#${idx}`;
    if (!lv?.id) issues.push(`${label}: missing id`);
    if (!lv?.name) issues.push(`${label}: missing name`);
    if (!Array.isArray(lv?.walls)) issues.push(`${label}: missing walls`);
    if (!Array.isArray(lv?.spawns) || !lv.spawns.length) issues.push(`${label}: missing spawns`);
    if (!lv?.reactor || !Number.isFinite(lv.reactor.x) || !Number.isFinite(lv.reactor.y)) {
      issues.push(`${label}: invalid reactor`);
    }
    const routes = lv?.routes || lv?.paths || [];
    if (!Array.isArray(routes) || !routes.length) issues.push(`${label}: missing routes/paths`);
    routes.forEach((route, routeIdx) => {
      if (!Array.isArray(route) || !route.length) issues.push(`${label}: route ${routeIdx + 1} empty`);
      (route || []).forEach((point, pointIdx) => {
        const p = normalizePoint(point);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          issues.push(`${label}: route ${routeIdx + 1}.${pointIdx + 1} invalid point`);
        }
      });
    });
  });
  return issues;
}

class ClassList {
  constructor() { this.set = new Set(); }
  toggle(name, on) { if (on) this.set.add(name); else this.set.delete(name); }
  add(name) { this.set.add(name); }
  remove(name) { this.set.delete(name); }
  contains(name) { return this.set.has(name); }
}

class Element {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tag = tag;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.classList = new ClassList();
    this.className = '';
    this._innerHTML = '';
    this.textContent = '';
    this.checked = false;
    this.clientWidth = 1200;
    this.value = '';
  }
  set innerHTML(value) {
    this._innerHTML = value;
    if (value === '') this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener() {}
  click() { if (typeof this.onclick === 'function') this.onclick(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 563 }; }
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  scrollTo() {}
  select() {}
}

function simulateEditorBoot(script) {
  const ids = new Map();
  const needed = [
    'map', 'canvasWrap', 'levelList', 'levelName', 'levelSummary', 'wallCount', 'spawnCount', 'openEnds',
    'pathIssues', 'checkHint', 'pathReport', 'designNotes', 'coord', 'saveState', 'editorBootStatus',
    'snapGrid', 'showRoutes', 'showActualPaths', 'showGrid', 'loadLevel', 'undoBtn', 'clearBtn', 'fitBtn',
    'testPathBtn', 'exportBtn', 'copyBtn', 'importBtn', 'saveDraftBtn', 'loadDraftBtn', 'sendDemoBtn', 'out'
  ];
  for (const id of needed) ids.set(id, new Element(id, id === 'map' ? 'canvas' : 'div'));
  for (const id of ['snapGrid', 'showRoutes', 'showActualPaths', 'showGrid']) ids.get(id).checked = true;

  const document = {
    getElementById(id) {
      if (!ids.has(id)) ids.set(id, new Element(id));
      return ids.get(id);
    },
    createElement(tag) { return new Element('', tag); },
    querySelectorAll(selector) {
      if (selector === '[data-mode]') return [];
      return [];
    },
    addEventListener() {}
  };

  const sandbox = {
    console,
    document,
    window: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    Math,
    JSON,
    structuredClone: global.structuredClone,
    setTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: EDITOR_FILE });
  return {
    cardCount: ids.get('levelList').children.length,
    bootText: ids.get('editorBootStatus').textContent,
    bootBad: ids.get('editorBootStatus').classList.contains('bad')
  };
}

function main() {
  const { html, script } = readEditorScript();
  new Function(script);
  const levels = extractLevels(html);
  const issues = validateLevels(levels);
  if (issues.length) throw new Error(`Level data validation failed:\n${issues.join('\n')}`);
  const boot = simulateEditorBoot(script);
  if (boot.cardCount !== levels.length) {
    throw new Error(`Rendered level cards mismatch: expected ${levels.length}, got ${boot.cardCount}`);
  }
  if (boot.bootBad) {
    throw new Error(`Editor boot status is bad: ${boot.bootText}`);
  }
  console.log(`map editor ok: ${levels.length} levels, ${boot.cardCount} rendered cards`);
  console.log(boot.bootText);
}

main();
