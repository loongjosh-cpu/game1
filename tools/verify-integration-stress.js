const fs = require('fs');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createSandbox(options = {}) {
  const storage = options.storage || {};
  const sandbox = {
    console,
    Math,
    JSON,
    Set,
    Map,
    structuredClone: global.structuredClone,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem() {},
      removeItem() {}
    },
    location: { search: options.search || '' },
    window: { addEventListener() {}, dispatchEvent() {} },
    document: {
      getElementById() { return { style: {}, textContent: '', classList: { add() {}, remove() {}, toggle() {} } }; },
      querySelector() { return { textContent: '', style: {} }; },
      querySelectorAll() { return []; },
      addEventListener() {}
    },
    Element: function Element() {},
    Phaser: {
      AUTO: 'AUTO',
      Scale: { ENVELOP: 'ENVELOP', CENTER_BOTH: 'CENTER_BOTH' },
      Scene: class Scene {},
      Game: class Game {},
      Curves: {
        Path: class Path {
          constructor(x, y) { this.points = [[x, y]]; }
          lineTo(x, y) { this.points.push([x, y]); return this; }
        }
      },
      Math: {
        Clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
        Between(min, max) { return min; },
        Distance: { Between(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); } }
      },
      Utils: {
        Array: {
          GetRandom(items) { return items[0]; },
          Shuffle(items) { return items.slice(); }
        }
      }
    },
    setTimeout() {}
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadContext(files, options = {}) {
  const ctx = createSandbox(options);
  for (const file of files) vm.runInContext(read(file), ctx, { filename: file });
  vm.runInContext(`
    this.__data = {
      ALL_TOWERS, EC, THREAT_COST, SPECIAL_ENEMY, DIRECT_ENEMY,
      LEVEL_UI_ORDER, LEVELS, ENDLESS_MAPS, MAP,
      META_NODES,
      metaSave,
      normalizeMetaSave,
      enforceEquippedRequirements,
      metaEffects,
      cloneMap,
      buildNavigation,
      EnemyWaveMethods,
      GameSceneSourceReady: typeof launch === 'function'
    };
  `, ctx);
  return ctx;
}

function loadRuntimeMapData(options = {}) {
  const ctx = loadContext([
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/archive.js',
    'src/data/meta.js',
    'src/data/game-config.js',
    'src/data/levels.js',
    'src/data/imported-level-maps.js',
    'src/core/map-utils.js',
    'src/core/pathfinding.js',
    'src/core/meta-store.js',
    'src/core/runtime-maps.js',
    'src/game/enemy-waves.js',
    'src/game/game-scene.js'
  ], options);
  return { ctx, data: ctx.__data };
}

function demoLocalScripts() {
  const html = read('demo.html');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map(match => match[1])
    .filter(src => src.startsWith('src/'));
}

function testGameSceneComposition() {
  const source = read('src/game/game-scene.js');
  const assignMatch = source.match(/Object\.assign\(GameScene\.prototype,([\s\S]*?)\);/);
  assert(assignMatch, 'GameScene should compose feature method groups through Object.assign');
  const groups = assignMatch[1].split(',').map(part => part.trim()).filter(Boolean);
  const requiredGroups = [
    'TextureFactoryMethods', 'SceneSetupMethods', 'MiniMapMethods', 'InputControllerMethods',
    'BuildPanelMethods', 'PlacementControllerMethods', 'TowerPanelMethods', 'DroneControllerMethods',
    'CombatUtilMethods', 'TowerCombatMethods', 'ProjectileControllerMethods', 'EnemyControllerMethods',
    'PlayerRuntimeMethods', 'HudOverlayMethods'
  ];
  requiredGroups.forEach(group => assert(groups.includes(group), `GameScene missing composed method group ${group}`));

  const directCalls = [...source.matchAll(/\bthis\.([a-zA-Z_][a-zA-Z0-9_]*)\(/g)].map(match => match[1]);
  const methodSources = [
    ...fs.readdirSync('src/game')
      .filter(file => file.endsWith('.js') && file !== 'bootstrap.js')
      .map(file => read(`src/game/${file}`)),
    ...fs.readdirSync('src/render')
      .filter(file => file.endsWith('.js'))
      .map(file => read(`src/render/${file}`))
  ]
    .join('\n');
  const defined = new Set([...methodSources.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/g)].map(match => match[1]));
  ['preload', 'create', 'update', 'smallReactorCount', 'energyRate', 'gainEnergy'].forEach(name => defined.add(name));
  const ignored = new Set(['constructor']);
  [...new Set(directCalls)].forEach(name => {
    if (ignored.has(name)) return;
    assert(defined.has(name), `GameScene calls this.${name}(), but no method definition was found in game modules`);
  });
}

function testMapsReachable(data) {
  const maps = [
    ...Object.entries(data.LEVELS).map(([id, level]) => [`level:${id}`, level.map]),
    ...Object.entries(data.ENDLESS_MAPS).map(([id, level]) => [`endless:${id}`, level.map])
  ];
  maps.forEach(([label, map]) => {
    const runtimeMap = data.cloneMap(map);
    const nav = data.buildNavigation(runtimeMap);
    assert(nav.enemyWaypoints.length === runtimeMap.spawns.length, `${label}: waypoint count should match spawns`);
    nav.enemyWaypoints.forEach((route, index) => {
      assert(route.length >= 2, `${label}: spawn ${index + 1} should have a path to reactor`);
      const last = route[route.length - 1];
      const dist = Math.hypot(last[0] - runtimeMap.reactor.x, last[1] - runtimeMap.reactor.y);
      assert(dist <= 120, `${label}: spawn ${index + 1} route should end near reactor, got ${Math.round(dist)}`);
    });
  });
}

function rosterCost(roster, threatCost) {
  return roster.reduce((sum, type) => sum + (threatCost[type] || 1), 0);
}

function testEndlessWaveStress(data) {
  const scene = { wave: 1 };
  Object.assign(scene, data.EnemyWaveMethods);
  for (let wave = 1; wave <= 60; wave++) {
    scene.wave = wave;
    const roster = scene.buildWaveRoster();
    assert(roster.length > 0, `endless wave ${wave}: roster should not be empty`);
    roster.forEach(type => assert(data.EC[type], `endless wave ${wave}: unknown enemy type ${type}`));
    const budget = 6 + 4 * (wave - 1);
    const cost = rosterCost(roster, data.THREAT_COST);
    assert(cost <= budget + 8, `endless wave ${wave}: roster cost ${cost} is too far above budget ${budget}`);
    const special = roster.filter(type => data.SPECIAL_ENEMY.has(type));
    const byType = {};
    special.forEach(type => { byType[type] = (byType[type] || 0) + 1; });
    Object.entries(byType).forEach(([type, count]) => assert(count <= 2, `endless wave ${wave}: special enemy ${type} exceeds per-wave cap`));
  }
}

function testFixedWaves(data) {
  Object.entries(data.LEVELS).forEach(([id, level]) => {
    const expected = ['level6', 'level7', 'level8', 'level9'].includes(id) ? 15 : 10;
    assert(level.waves.length === expected, `${id}: expected ${expected} fixed waves, got ${level.waves.length}`);
    const laneCount = level.map.spawns.length;
    level.waves.forEach((wave, index) => {
      assert(Number.isFinite(wave.scale) && wave.scale > 0, `${id} wave ${index + 1}: invalid scale`);
      assert(Array.isArray(wave.roster) && wave.roster.length > 0, `${id} wave ${index + 1}: empty roster`);
      wave.roster.forEach(type => assert(data.EC[type], `${id} wave ${index + 1}: unknown enemy ${type}`));
      (wave.lanes || []).forEach(lane => {
        assert(Number.isInteger(lane) && lane >= 0, `${id} wave ${index + 1}: lane ${lane} should be a non-negative integer`);
        assert(laneCount > 0 && Number.isInteger(lane % laneCount), `${id} wave ${index + 1}: lane ${lane} should be foldable into ${laneCount} spawn lanes`);
      });
    });
  });
}

function setEquipped(ctx, ids) {
  vm.runInContext(`metaSave = normalizeMetaSave({ cores: 99, ownedChips: {}, equippedChips: {} });`, ctx);
  ids.forEach(id => {
    vm.runInContext(`metaSave.ownedChips['${id}'] = true; metaSave.equippedChips['${id}'] = true;`, ctx);
  });
  vm.runInContext('enforceEquippedRequirements(); this.__effects = metaEffects(); this.__meta = metaSave;', ctx);
  return { effects: ctx.__effects, meta: ctx.__meta };
}

function testMetaCombinations(ctx) {
  const poison = setEquipped(ctx, ['poison_long', 'poison_damage', 'poison_slow']);
  const equippedPoison = ['poison_long', 'poison_damage', 'poison_slow'].filter(id => poison.meta.equippedChips[id]);
  assert(equippedPoison.length === 1, 'poison chips should remain mutually exclusive in integrated meta save');

  const towerCombo = setEquipped(ctx, [
    'tower_p2_superchain', 'tower_p4_freeze', 'tower_p7_burst',
    'tower_b1_low_wreck', 'tower_b3_taunt', 'tower_b4_resonance',
    'tower_b5_overheal', 'tower_b6', 'tower_b7_manual',
    'tower_d1_death_blast', 'tower_d2', 'tower_d3'
  ]);
  [
    'p2Superchain', 'p4Freeze', 'p7Burst', 'b1LowWreck', 'b3Taunt', 'b4Resonance',
    'b5Overheal', 'b6ToxicShell', 'b7Manual', 'd1DeathBlast', 'd2Revive', 'd3Retreat'
  ].forEach(key => assert(towerCombo.effects[key] === true, `meta combo should enable effect ${key}`));

  const economy = setEquipped(ctx, ['reactor_wave_supply']);
  assert(economy.effects.reactorWaveBonus === 120, 'reactor wave supply should grant 120 energy per early wave');
  assert(economy.effects.reactorWaveBonusLimit >= 5, 'reactor wave supply should have an early-wave limit');
}

function testLaunchEntryReady(data) {
  assert(data.GameSceneSourceReady === true, 'launch() entry should be defined after loading game scene');
  Object.keys(data.LEVELS).forEach(id => assert(data.LEVEL_UI_ORDER.includes(id), `${id}: level exists but is missing from LEVEL_UI_ORDER`));
  assert(Object.keys(data.ENDLESS_MAPS).includes('endless1'), 'endless1 map should exist for home endless flow');
}

function testSavedEditorMapIsolation() {
  const corruptMap = JSON.stringify({
    map: {
      walls: [],
      spawns: [null],
      reactor: null,
      worldSize: { w: 7356, h: 4144 }
    }
  });
  const defaultRun = loadRuntimeMapData({ storage: { 'r32-map': corruptMap } }).data;
  assert(defaultRun.ENDLESS_MAPS.endless1.map.spawns.length === 8, 'public endless mode should ignore saved editor maps by default');

  const explicitRun = loadRuntimeMapData({ search: '?useSavedMap=1', storage: { 'r32-map': corruptMap } }).data;
  assert(explicitRun.ENDLESS_MAPS.endless1.map.spawns.length === 8, 'invalid saved editor map should be rejected even when explicitly enabled');
  assert(explicitRun.ENDLESS_MAPS.endless1.name === '无尽模式一', 'endless map name should remain readable after rejecting saved map');
}

function main() {
  const { ctx, data } = loadRuntimeMapData();
  assert(demoLocalScripts().length >= 40, 'demo should keep loading the split local script graph');
  testGameSceneComposition();
  testMapsReachable(data);
  testEndlessWaveStress(data);
  testFixedWaves(data);
  testMetaCombinations(ctx);
  testLaunchEntryReady(data);
  testSavedEditorMapIsolation();
  console.log('integration stress ok: scene composition, map reachability, long-wave rosters, fixed waves, saved-map isolation and meta combos verified');
}

main();
