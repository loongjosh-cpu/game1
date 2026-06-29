const fs = require('fs');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function createDomStub() {
  const elements = new Map();
  const makeEl = id => ({
    id,
    innerHTML: '',
    textContent: '',
    style: { display: '' },
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    setAttribute() {},
    addEventListener() {},
    querySelectorAll() { return []; }
  });
  return {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    querySelector() {
      return makeEl('query');
    },
    querySelectorAll() {
      return [];
    },
    _elements: elements
  };
}

function loadContext(rawSave = null) {
  const storage = {};
  if (rawSave !== null) storage['r32-meta-v1'] = JSON.stringify(rawSave);
  const sandbox = {
    console,
    Math,
    JSON,
    Set,
    storage,
    localStorage: {
      getItem(key) {
        return storage[key] ?? null;
      },
      setItem(key, value) {
        storage[key] = String(value);
      }
    },
    document: createDomStub(),
    window: {
      addEventListener() {},
      dispatchEvent() {}
    },
    CustomEvent: function CustomEvent(type, init) {
      return { type, ...init };
    }
  };
  vm.createContext(sandbox);
  for (const file of [
    'src/data/towers.js',
    'src/data/meta.js',
    'src/data/game-config.js',
    'src/core/meta-store.js',
    'src/ui/archive-ui.js',
    'src/ui/meta-ui.js'
  ]) {
    vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    renderHome = function(){};
    renderTowerArchive = function(){};
    bindMetaUiButtons = function(){};
    this.__metaSystems = {
      META_NODES,
      ALL_TOWERS,
      META_UI_STATE,
      META_SAVE_KEY,
      metaSave,
      normalizeMetaSave,
      emptyMetaSave,
      ownsChip,
      isChipEquipped,
      hasMeta,
      chipRequirementsMet,
      chipMutexKey,
      unequipConflictingChips,
      enforceEquippedRequirements,
      syncMetaNodeAlias,
      saveMeta,
      metaEffects,
      nodeState,
      buyChip,
      toggleChip,
      towerEquipUnits,
      selectedEquipUnit,
      chipCanInstallToUnit,
      installChipToSelectedSlot,
      unitSlotState,
      storage
    };
  `, sandbox);
  return sandbox.__metaSystems;
}

function node(ctx, id) {
  return ctx.META_NODES.find(n => n.id === id);
}

function resetSave(ctx, data = {}) {
  ctx.metaSave.cores = data.cores ?? 0;
  ctx.metaSave.bestWave = data.bestWave ?? 0;
  ctx.metaSave.nodes = { ...(data.nodes || {}) };
  ctx.metaSave.ownedChips = { ...(data.ownedChips || {}) };
  ctx.metaSave.equippedChips = { ...(data.equippedChips || {}) };
  ctx.metaSave.levelClears = { ...(data.levelClears || {}) };
  ctx.metaSave.settings = { cameraMode: 'local', ...(data.settings || {}) };
}

function testSaveNormalization(ctx, issues) {
  const normalized = ctx.normalizeMetaSave({
    cores: -5,
    bestWave: '8',
    nodes: { ship_speed_1: true, fake_chip: true },
    ownedChips: { tower_p1: true },
    equippedChips: { tower_p2: true },
    levelClears: { level1: true, level2: false },
    settings: { cameraMode: 'invalid', miniMap: true }
  });
  assert(normalized.cores === 0, 'normalizeMetaSave should clamp negative cores to zero', issues);
  assert(normalized.bestWave === 8, 'normalizeMetaSave should preserve numeric bestWave', issues);
  assert(normalized.ownedChips.ship_speed_1 && normalized.ownedChips.tower_p1, 'legacy nodes should migrate into owned chips', issues);
  assert(normalized.equippedChips.ship_speed_1 && !normalized.equippedChips.tower_p2, 'equipped chips should migrate from legacy nodes and drop unowned equipped chips', issues);
  assert(!normalized.ownedChips.fake_chip, 'unknown chip ids should be discarded during normalization', issues);
  assert(normalized.levelClears.level1 && !normalized.levelClears.level2, 'level clear flags should keep only true values', issues);
  assert(normalized.settings.cameraMode === 'local' && !('miniMap' in normalized.settings), 'settings should normalize camera mode and remove legacy miniMap flag', issues);
}

function testChipMutexAndRequirements(ctx, issues) {
  assert(ctx.chipMutexKey(node(ctx, 'tower_p1')) === 'tower:P1', 'tower chips should use tower-specific mutex slot', issues);
  assert(ctx.chipMutexKey(node(ctx, 'poison_long')) === 'mutex:poison', 'poison chips should share one global poison mutex slot', issues);
  assert(ctx.chipMutexKey(node(ctx, 'ship_speed_1')) === null, 'ship chips without mutex should not conflict by slot', issues);

  resetSave(ctx, {
    ownedChips: { ship_speed_2: true },
    equippedChips: { ship_speed_2: true }
  });
  ctx.enforceEquippedRequirements();
  assert(!ctx.isChipEquipped('ship_speed_2'), 'equipped chip should be removed if its equipped prerequisite is missing', issues);

  resetSave(ctx, {
    ownedChips: { tower_p1: true, tower_p1_recycle: true },
    equippedChips: { tower_p1: true, tower_p1_recycle: true }
  });
  ctx.enforceEquippedRequirements();
  const equippedP1Count = ['tower_p1', 'tower_p1_recycle'].filter(id => ctx.isChipEquipped(id)).length;
  assert(equippedP1Count === 1, 'only one chip may remain equipped per tower mutex slot', issues);

  resetSave(ctx, {
    ownedChips: { poison_long: true, poison_damage: true, poison_slow: true },
    equippedChips: { poison_long: true, poison_damage: true, poison_slow: true }
  });
  ctx.enforceEquippedRequirements();
  const poisonCount = ['poison_long', 'poison_damage', 'poison_slow'].filter(id => ctx.isChipEquipped(id)).length;
  assert(poisonCount === 1, 'poison chips should be mutually exclusive', issues);
}

function testBuying(ctx, issues) {
  resetSave(ctx, { cores: 2 });
  ctx.buyChip('ship_speed_2');
  assert(!ctx.ownsChip('ship_speed_2') && ctx.metaSave.cores === 2, 'shop should not allow buying locked prerequisite chip', issues);
  ctx.buyChip('ship_speed_1');
  assert(ctx.ownsChip('ship_speed_1') && ctx.metaSave.cores === 1, 'buyChip should spend cores and mark chip owned', issues);
  ctx.buyChip('ship_speed_1');
  assert(ctx.metaSave.cores === 1, 'buyChip should not double-charge already owned chip', issues);
  ctx.buyChip('ship_speed_2');
  assert(ctx.ownsChip('ship_speed_2') && ctx.metaSave.cores === 0, 'buyChip should allow prerequisite chain once previous chip is owned', issues);
}

function testEquipAndInstall(ctx, issues) {
  resetSave(ctx, {
    cores: 0,
    ownedChips: {
      ship_speed_1: true,
      ship_speed_2: true,
      tower_p1: true,
      tower_p1_recycle: true,
      poison_long: true,
      poison_damage: true
    }
  });

  ctx.toggleChip('ship_speed_2');
  assert(!ctx.isChipEquipped('ship_speed_2'), 'toggleChip should not equip a chip whose equipped prerequisite is missing', issues);
  ctx.toggleChip('ship_speed_1');
  ctx.toggleChip('ship_speed_2');
  assert(ctx.isChipEquipped('ship_speed_1') && ctx.isChipEquipped('ship_speed_2'), 'toggleChip should equip ship prerequisite chains in order', issues);
  ctx.toggleChip('ship_speed_2');
  assert(!ctx.isChipEquipped('ship_speed_2'), 'toggleChip should unequip equipped chip when toggled again', issues);

  ctx.installChipToSelectedSlot('tower_p1', 'tower:P1');
  assert(ctx.isChipEquipped('tower_p1'), 'installChipToSelectedSlot should equip owned tower chip into its slot', issues);
  ctx.installChipToSelectedSlot('tower_p1_recycle', 'tower:P1');
  assert(!ctx.isChipEquipped('tower_p1') && ctx.isChipEquipped('tower_p1_recycle'), 'installing another chip to same tower should replace previous chip', issues);
  ctx.installChipToSelectedSlot('poison_long', 'tower:P1');
  assert(!ctx.isChipEquipped('poison_long'), 'installing chip to wrong slot should be rejected', issues);
  ctx.installChipToSelectedSlot('poison_long', 'mutex:poison');
  ctx.installChipToSelectedSlot('poison_damage', 'mutex:poison');
  assert(!ctx.isChipEquipped('poison_long') && ctx.isChipEquipped('poison_damage'), 'poison slot should replace previous poison chip', issues);
}

function testLoadoutSlots(ctx, issues) {
  resetSave(ctx, {
    ownedChips: { tower_p1: true, poison_long: true },
    equippedChips: { tower_p1: true }
  });
  const units = ctx.towerEquipUnits();
  const p1 = units.find(unit => unit.slotKey === 'tower:P1');
  const poison = units.find(unit => unit.slotKey === 'mutex:poison');
  assert(p1 && poison, 'tower loadout should contain tower-specific units and global poison unit', issues);
  assert(ctx.unitSlotState(p1).className === 'filled', 'unitSlotState should mark equipped tower slots as filled', issues);
  assert(ctx.unitSlotState(poison).className === 'ready', 'unitSlotState should mark owned installable empty slots as ready', issues);
  assert(ctx.chipCanInstallToUnit(node(ctx, 'tower_p1'), p1), 'owned tower chip should be installable to matching tower unit', issues);
  assert(!ctx.chipCanInstallToUnit(node(ctx, 'tower_p1'), poison), 'tower chip should not be installable to poison unit', issues);
}

function testMetaEffects(ctx, issues) {
  resetSave(ctx, {
    ownedChips: {
      ship_speed_1: true,
      ship_speed_2: true,
      ship_speed_3: true,
      tower_p2_superchain: true,
      tower_b6: true,
      poison_damage: true
    },
    equippedChips: {
      ship_speed_1: true,
      ship_speed_2: true,
      ship_speed_3: true,
      tower_p2_superchain: true,
      tower_b6: true,
      poison_damage: true
    }
  });
  ctx.syncMetaNodeAlias();
  const effects = ctx.metaEffects();
  assert(effects.shipSpeed === 660, 'ship speed effects should combine flat and multiplicative upgrades', issues);
  assert(effects.p2Superchain && effects.b6ToxicShell && effects.poisonDamage, 'metaEffects should expose equipped tower and poison chip effects', issues);
  assert(ctx.metaSave.nodes.ship_speed_1 && ctx.metaSave.nodes.tower_b6, 'syncMetaNodeAlias should mirror equipped chips into legacy nodes alias', issues);
}

function testPersistence(ctx, issues) {
  resetSave(ctx, {
    cores: 4,
    ownedChips: { tower_b7: true },
    equippedChips: { tower_b7: true },
    settings: { cameraMode: 'global' }
  });
  ctx.saveMeta();
  const raw = JSON.parse(ctx.storage[ctx.META_SAVE_KEY]);
  assert(raw.cores === 4, 'saveMeta should persist cores', issues);
  assert(raw.ownedChips.tower_b7 && raw.equippedChips.tower_b7 && raw.nodes.tower_b7, 'saveMeta should persist owned, equipped and legacy node alias', issues);
  assert(raw.settings.cameraMode === 'global', 'saveMeta should persist settings', issues);
}

function testCatalogCoverage(ctx, issues) {
  const ids = new Set(ctx.META_NODES.map(n => n.id));
  assert(ids.size === ctx.META_NODES.length, 'chip ids should be unique', issues);
  ctx.META_NODES.forEach(n => {
    assert(Number.isFinite(n.cost) && n.cost >= 0, `${n.id} should have non-negative numeric cost`, issues);
    (n.req || []).forEach(req => assert(ids.has(req), `${n.id} should reference existing prerequisite ${req}`, issues));
    if (n.tower) assert(ctx.ALL_TOWERS.some(t => t.id === n.tower), `${n.id} should reference existing tower ${n.tower}`, issues);
  });
  const towerIdsWithChips = new Set(ctx.META_NODES.filter(n => n.group === 'tower' && n.tower).map(n => n.tower));
  ['P1','P2','P3','P4','P5','P6','P7','B1','B2','B3','B4','B5','B6','B7','D1','D2','D3'].forEach(id => {
    assert(towerIdsWithChips.has(id), `${id} should have at least one chip in current catalog`, issues);
  });
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testSaveNormalization(ctx, issues);
  testChipMutexAndRequirements(ctx, issues);
  testBuying(ctx, issues);
  testEquipAndInstall(ctx, issues);
  testLoadoutSlots(ctx, issues);
  testMetaEffects(ctx, issues);
  testPersistence(ctx, issues);
  testCatalogCoverage(ctx, issues);
  if (issues.length) {
    console.error(`meta systems verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('meta systems ok: save migration, shop purchase, loadout equip, mutex, prerequisites, effects and persistence verified');
}

main();
