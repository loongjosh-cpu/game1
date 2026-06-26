const fs = require('fs');
const vm = require('vm');

const DEMO_FILE = 'demo.html';
const LOCAL_SCRIPT_RE = /^src\//;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function demoScripts() {
  const html = read(DEMO_FILE);
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

function syntaxCheck(files) {
  const issues = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      issues.push(`${file}: missing script file`);
      continue;
    }
    try {
      new Function(read(file));
    } catch (err) {
      issues.push(`${file}: syntax error: ${err.message}`);
    }
  }
  return issues;
}

function loadDataContext(files) {
  const sandbox = {
    console,
    Math,
    JSON,
    structuredClone: global.structuredClone,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    Phaser: {
      Math: {
        Clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        },
        Distance: {
          Between(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
          }
        }
      }
    },
    window: {},
    document: {
      getElementById() { return { style: {}, classList: { add() {}, remove() {}, toggle() {} } }; },
      querySelectorAll() { return []; },
      addEventListener() {}
    }
  };
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(read(file), sandbox, { filename: file });
  vm.runInContext(`
    this.__gameData = {
      ALL_TOWERS,
      PATH_TOWERS,
      BLOCK_TOWERS,
      DRONE_TOWERS,
      REACTORS: typeof REACTORS !== 'undefined' ? REACTORS : [],
      EC,
      META_NODES,
      LEVELS,
      ENDLESS_MAPS,
      THREAT_COST,
      EnemyTargetingMethods: typeof EnemyTargetingMethods !== 'undefined' ? EnemyTargetingMethods : null
    };
  `, sandbox);
  return sandbox.__gameData;
}

function finiteNumber(value) {
  return Number.isFinite(Number(value));
}

function uniqueIds(items, label, issues) {
  const seen = new Set();
  for (const item of items) {
    assert(item && item.id, `${label}: missing id`, issues);
    if (!item?.id) continue;
    assert(!seen.has(item.id), `${label}: duplicate id ${item.id}`, issues);
    seen.add(item.id);
  }
}

function validateTowers(data, issues) {
  const towers = data.ALL_TOWERS || [];
  uniqueIds(towers, 'tower', issues);
  for (const tower of towers) {
    assert(tower.name, `${tower.id}: missing tower name`, issues);
    assert(['path', 'block', 'drone', 'reactor'].includes(tower.type), `${tower.id}: invalid type ${tower.type}`, issues);
    assert(Array.isArray(tower.upg) && tower.upg.length > 0, `${tower.id}: missing upgrade data`, issues);
    if (!Array.isArray(tower.upg)) continue;
    tower.upg.forEach((up, idx) => {
      assert(up.l === idx + 1, `${tower.id}: level marker ${up.l} should be ${idx + 1}`, issues);
      if (idx > 0) assert(finiteNumber(up.c), `${tower.id} Lv${idx + 1}: missing upgrade cost`, issues);
      if (tower.type !== 'reactor') assert(finiteNumber(up.r) || tower.type === 'drone', `${tower.id} Lv${idx + 1}: missing range`, issues);
      if (tower.type === 'block') {
        assert(finiteNumber(up.hp), `${tower.id} Lv${idx + 1}: missing HP`, issues);
        assert(finiteNumber(up.danger), `${tower.id} Lv${idx + 1}: missing danger`, issues);
      }
      if (tower.type === 'drone') {
        assert(finiteNumber(up.coreHp), `${tower.id} Lv${idx + 1}: missing core HP`, issues);
        assert(finiteNumber(up.danger), `${tower.id} Lv${idx + 1}: missing core danger`, issues);
        assert(finiteNumber(up.md), `${tower.id} Lv${idx + 1}: missing drone cap`, issues);
        assert(finiteNumber(up.prod), `${tower.id} Lv${idx + 1}: missing production interval`, issues);
      }
      if (tower.type === 'reactor') {
        assert(finiteNumber(up.hp), `${tower.id} Lv${idx + 1}: missing reactor HP`, issues);
        assert(finiteNumber(up.prod), `${tower.id} Lv${idx + 1}: missing reactor production`, issues);
      }
    });
  }
}

function validateEnemies(data, issues) {
  const entries = Object.entries(data.EC || {});
  assert(entries.length > 0, 'enemy table is empty', issues);
  for (const [id, enemy] of entries) {
    assert(enemy.name, `${id}: missing enemy name`, issues);
    assert(finiteNumber(enemy.hp), `${id}: missing HP`, issues);
    assert(finiteNumber(enemy.spd), `${id}: missing speed`, issues);
    assert(finiteNumber(enemy.danger), `${id}: missing danger`, issues);
    assert(finiteNumber(data.THREAT_COST?.[id]), `${id}: missing threat cost`, issues);
  }
}

function validateMeta(data, issues) {
  const nodes = data.META_NODES || [];
  const towerIds = new Set((data.ALL_TOWERS || []).map(t => t.id));
  uniqueIds(nodes, 'meta node', issues);
  for (const node of nodes) {
    assert(node.group, `${node.id}: missing group`, issues);
    assert(node.name, `${node.id}: missing name`, issues);
    assert(finiteNumber(node.cost), `${node.id}: missing cost`, issues);
    if (node.tower) assert(towerIds.has(node.tower), `${node.id}: references missing tower ${node.tower}`, issues);
  }
  validateMetaEffectsCoverage(nodes, issues);
}

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listJsFiles(file));
    else if (entry.isFile() && file.endsWith('.js')) out.push(file);
  }
  return out;
}

function validateMetaEffectsCoverage(nodes, issues) {
  const store = read('src/core/meta-store.js');
  const hasMetaIds = new Set([...store.matchAll(/hasMeta\('([^']+)'\)/g)].map(m => m[1]));
  for (const node of nodes) {
    assert(hasMetaIds.has(node.id), `${node.id}: defined in META_NODES but not read by metaEffects`, issues);
  }
  const effectBody = extractFunctionReturnObject(store, 'metaEffects');
  const effectKeys = [...effectBody.matchAll(/^\s*([a-zA-Z0-9_]+):/gm)].map(m => m[1]);
  const gameSource = listJsFiles('src')
    .filter(file => !file.endsWith('core/meta-store.js'))
    .map(file => read(file))
    .join('\n');
  for (const key of effectKeys) {
    assert(new RegExp(`meta\\.${key}\\b`).test(gameSource), `meta effect ${key} is returned but never used`, issues);
  }
}

function extractFunctionReturnObject(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start < 0) return '';
  const ret = source.indexOf('return {', start);
  if (ret < 0) return '';
  const open = source.indexOf('{', ret);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return '';
}

function pointValid(point) {
  if (Array.isArray(point)) return finiteNumber(point[0]) && finiteNumber(point[1]);
  return finiteNumber(point?.x) && finiteNumber(point?.y);
}

function validateMap(id, map, issues) {
  assert(map && finiteNumber(map.worldSize?.w) && finiteNumber(map.worldSize?.h), `${id}: invalid worldSize`, issues);
  assert(Array.isArray(map?.walls), `${id}: missing walls`, issues);
  assert(Array.isArray(map?.spawns) && map.spawns.length > 0, `${id}: missing spawns`, issues);
  assert(pointValid(map?.reactor), `${id}: invalid reactor`, issues);
  const routes = map?.routes || map?.paths || [];
  assert(Array.isArray(routes) && routes.length > 0, `${id}: missing routes`, issues);
  for (const [idx, spawn] of (map?.spawns || []).entries()) {
    assert(pointValid(spawn), `${id}: invalid spawn ${idx + 1}`, issues);
  }
  for (const [idx, route] of routes.entries()) {
    assert(Array.isArray(route) && route.length >= 2, `${id}: route ${idx + 1} too short`, issues);
    for (const [pIdx, point] of (route || []).entries()) {
      assert(pointValid(point), `${id}: route ${idx + 1}.${pIdx + 1} invalid point`, issues);
    }
  }
}

function validateLevels(data, issues) {
  for (const [id, level] of Object.entries(data.LEVELS || {})) {
    assert(level.name, `${id}: missing level name`, issues);
    assert(Array.isArray(level.waves) && level.waves.length > 0, `${id}: missing waves`, issues);
    if (level.map) validateMap(`${id}.map`, level.map, issues);
  }
  for (const [id, endless] of Object.entries(data.ENDLESS_MAPS || {})) {
    assert(endless.name, `${id}: missing endless map name`, issues);
    if (endless.map) validateMap(`${id}.map`, endless.map, issues);
  }
}

function validateGddSync(data, issues) {
  const gdd = read('GDD.md');
  const parsed = parseGddTables(gdd);
  validateGddTowerTable(data, parsed.pathTowers, 'path', issues);
  validateGddTowerTable(data, parsed.blockTowers, 'block', issues);
  validateGddTowerTable(data, parsed.droneTowers, 'drone', issues);
  validateGddEnemyTable(data, parsed.enemies, issues);
}

function tableCells(line) {
  return line.split('|').slice(1, -1).map(cell => cell.trim());
}

function numericCell(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/,/g, '');
  if (/^[-—–]$/.test(text)) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function secondsToMs(value) {
  const seconds = numericCell(value);
  return seconds === null ? null : Math.round(seconds * 1000);
}

function parseTargetCell(value) {
  const text = String(value || '');
  const out = {};
  const total = text.match(/总(\d+)目标/);
  const branch = text.match(/分叉(\d+)/);
  const aoe = text.match(/AOE(\d+)/i);
  const simple = text.match(/^(\d+)$/);
  if (total) out.targets = Number(total[1]);
  if (branch) out.cr = Number(branch[1]);
  if (aoe) out.s = Number(aoe[1]);
  if (simple) out.n = Number(simple[1]);
  return out;
}

function parseDamageIntervalCell(value) {
  const text = String(value || '');
  if (!text.includes('/')) return { damage: numericCell(text), interval: null };
  return {
    damage: numericCell(text),
    interval: secondsToMs(text.split('/').pop())
  };
}

function parseGddTables(gdd) {
  const parsed = { pathTowers: {}, blockTowers: {}, droneTowers: {}, enemies: {} };
  for (const line of gdd.split(/\r?\n/)) {
    if (!/^\| [PBDE]\d+ /.test(line)) continue;
    const cells = tableCells(line);
    const id = cells[0];
    if (/^P\d+$/.test(id) && /^Lv\d+/.test(cells[1])) {
      const level = numericCell(cells[1]);
      const targets = parseTargetCell(cells[4]);
      const row = {
        level,
        d: numericCell(cells[2]),
        i: secondsToMs(cells[3]),
        r: numericCell(cells[5]),
        c: numericCell(cells[7]),
        ...targets
      };
      if (id === 'P6' && targets.n !== undefined) row.ps = targets.n;
      if (id === 'P7' && targets.n !== undefined) row.n = targets.n;
      parsed.pathTowers[id] = parsed.pathTowers[id] || [];
      parsed.pathTowers[id][level - 1] = row;
      continue;
    }
    if (/^B\d+$/.test(id) && /^Lv\d+/.test(cells[1])) {
      const level = numericCell(cells[1]);
      const damage = parseDamageIntervalCell(cells[4]);
      const row = {
        level,
        hp: numericCell(cells[2]),
        danger: numericCell(cells[3]),
        d: damage.damage,
        i: damage.interval,
        r: numericCell(cells[6]),
        c: numericCell(cells[7])
      };
      if (/^治/.test(cells[4])) {
        row.hl = numericCell(cells[4]);
        row.d = null;
      }
      if (/^毒/.test(cells[4])) {
        row.d = null;
      }
      if (id === 'B7') {
        row.bm = numericCell(cells[4]);
        row.d = null;
        row.i = null;
      }
      parsed.blockTowers[id] = parsed.blockTowers[id] || [];
      parsed.blockTowers[id][level - 1] = row;
      continue;
    }
    if (/^D\d+$/.test(id) && /^Lv\d+/.test(cells[1])) {
      const level = numericCell(cells[1]);
      const row = {
        level,
        coreHp: numericCell(cells[2]),
        danger: numericCell(cells[3]),
        md: numericCell(cells[4]),
        hp: numericCell(cells[5]),
        d: numericCell(cells[6]),
        i: secondsToMs(cells[7]),
        r: numericCell(cells[8]),
        prod: secondsToMs(cells[9]),
        c: numericCell(cells[11])
      };
      if (id === 'D3') {
        row.hl = numericCell(cells[6]);
        row.d = 0;
      }
      parsed.droneTowers[id] = parsed.droneTowers[id] || [];
      parsed.droneTowers[id][level - 1] = row;
      continue;
    }
    if (/^E\d+$/.test(id)) {
      parsed.enemies[id] = {
        hp: numericCell(cells[2]),
        spd: numericCell(cells[3]),
        dmg: numericCell(cells[4]),
        atk: secondsToMs(cells[5]),
        danger: numericCell(cells[7])
      };
    }
  }
  return parsed;
}

function compareField(label, actual, expected, issues) {
  if (expected === null || expected === undefined || Number.isNaN(expected)) return;
  if (actual !== expected) issues.push(`${label}: code ${actual} != GDD ${expected}`);
}

function validateGddTowerTable(data, table, type, issues) {
  const towers = (data.ALL_TOWERS || []).filter(t => t.type === type);
  for (const tower of towers) {
    const rows = table[tower.id] || [];
    assert(rows.length === tower.upg.length, `GDD/code mismatch: ${tower.id} has ${tower.upg.length} code levels but ${rows.length} GDD level rows`, issues);
    tower.upg.forEach((up, idx) => {
      const row = rows[idx];
      if (!row) return;
      const label = `${tower.id} Lv${idx + 1}`;
      compareField(`${label} range`, up.r, row.r, issues);
      compareField(`${label} upgrade cost`, idx === 0 ? null : up.c, row.c, issues);
      if (type === 'path') {
        compareField(`${label} damage`, up.d, row.d, issues);
        compareField(`${label} interval`, up.i, row.i, issues);
        compareField(`${label} targets`, up.targets, row.targets, issues);
        compareField(`${label} chain range`, up.cr, row.cr, issues);
        compareField(`${label} splash`, up.s, row.s, issues);
        if (tower.id === 'P4' || tower.id === 'P7') compareField(`${label} target count`, up.n, row.n, issues);
        if (tower.id === 'P6') compareField(`${label} poison targets`, up.ps, row.ps, issues);
      } else if (type === 'block') {
        compareField(`${label} HP`, up.hp, row.hp, issues);
        compareField(`${label} danger`, up.danger, row.danger, issues);
        compareField(`${label} damage`, up.d, row.d, issues);
        compareField(`${label} heal`, up.hl, row.hl, issues);
        compareField(`${label} blast damage`, up.bm, row.bm, issues);
        compareField(`${label} interval`, up.i, row.i, issues);
      } else if (type === 'drone') {
        compareField(`${label} core HP`, up.coreHp, row.coreHp, issues);
        compareField(`${label} danger`, up.danger, row.danger, issues);
        compareField(`${label} drone cap`, up.md, row.md, issues);
        compareField(`${label} drone HP`, up.hp, row.hp, issues);
        compareField(`${label} damage`, up.d, row.d, issues);
        compareField(`${label} heal`, up.hl, row.hl, issues);
        compareField(`${label} interval`, up.i, row.i, issues);
        compareField(`${label} production`, up.prod, row.prod, issues);
      }
    });
  }
}

function validateGddEnemyTable(data, table, issues) {
  for (const [id, enemy] of Object.entries(data.EC || {})) {
    const row = table[id];
    assert(!!row, `GDD/code mismatch: ${id} missing from enemy table`, issues);
    if (!row) continue;
    compareField(`${id} HP`, enemy.hp, row.hp, issues);
    compareField(`${id} speed`, enemy.spd, row.spd, issues);
    compareField(`${id} damage`, enemy.dmg, row.dmg, issues);
    if (id !== 'E13') compareField(`${id} attack interval`, enemy.atk, row.atk, issues);
    compareField(`${id} danger`, enemy.danger, row.danger, issues);
  }
}

function validateDangerEffects(data, issues) {
  const methods = data.EnemyTargetingMethods;
  const b3 = data.ALL_TOWERS.find(t => t.id === 'B3');
  assert(!!methods?.towerDanger, 'EnemyTargetingMethods.towerDanger is missing', issues);
  if (!methods?.towerDanger || !b3) return;
  const scene = { meta: { b3Taunt: true }, towerDanger: methods.towerDanger };
  const full = { _type: b3, _lv: 0, _hp: 150, _maxhp: 150 };
  const low = { _type: b3, _lv: 0, _hp: 50, _maxhp: 150 };
  assert(methods.towerDanger.call(scene, full) === 3, 'B3 taunt chip should raise full-HP danger to 3', issues);
  assert(methods.towerDanger.call(scene, low) === 1, 'B3 taunt chip should lower low-HP danger to 1', issues);
}

function main() {
  const scripts = demoScripts();
  const localScripts = scripts.filter(s => LOCAL_SCRIPT_RE.test(s));
  const syntaxIssues = syntaxCheck(localScripts);

  const dataFiles = [
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/archive.js',
    'src/data/meta.js',
    'src/data/game-config.js',
    'src/data/levels.js',
    'src/data/imported-level-maps.js',
    'src/core/map-utils.js',
    'src/core/meta-store.js',
    'src/core/runtime-maps.js',
    'src/game/enemy-targeting.js'
  ];
  const issues = [...syntaxIssues];
  const data = loadDataContext(dataFiles);
  validateTowers(data, issues);
  validateEnemies(data, issues);
  validateMeta(data, issues);
  validateLevels(data, issues);
  validateGddSync(data, issues);
  validateDangerEffects(data, issues);

  if (issues.length) {
    console.error(`game preflight failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log(`game preflight ok: ${localScripts.length} scripts, ${data.ALL_TOWERS.length} towers, ${Object.keys(data.EC).length} enemies`);
}

main();
