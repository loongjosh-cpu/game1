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
  const b3 = data.ALL_TOWERS.find(t => t.id === 'B3');
  const b3Rows = gdd.split(/\r?\n/).filter(line => /^\| B3 \| Lv\d+ \|/.test(line));
  assert(b3Rows.length === b3.upg.length, `GDD/code mismatch: B3 has ${b3.upg.length} code levels but ${b3Rows.length} GDD level rows`, issues);
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
