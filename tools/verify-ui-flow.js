const fs = require('fs');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class ClassList {
  constructor(initial = '') {
    this.set = new Set(String(initial).split(/\s+/).filter(Boolean));
  }
  add(name) { this.set.add(name); }
  remove(name) { this.set.delete(name); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force;
    if (on) this.set.add(name);
    else this.set.delete(name);
    return on;
  }
}

class Element {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = new ClassList();
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
    this.scrollTop = 0;
    this.attributes = {};
    this.listeners = {};
    this._strongText = '';
  }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  querySelector(selector) {
    if (selector === 'strong') return { textContent: this._strongText };
    if (selector === '[data-level-state]') return this._levelState || null;
    return null;
  }
  querySelectorAll() { return []; }
  scrollTo() {}
  getContext() { return new Proxy({}, { get: () => () => {} }); }
}

function createUiSandbox() {
  const byId = new Map();
  const bySelector = new Map();

  function get(id) {
    if (!byId.has(id)) byId.set(id, new Element(id));
    return byId.get(id);
  }

  [
    'btnViewToggle', 'btnPauseViewToggle', 'homeViewMode', 'homeSettingsViewMode', 'pauseViewMode',
    'pausePanel', 'hudPhase', 'hud', 'controlHints', 'miniMapWrap', 'buildPanel', 'twPanel',
    'channelPanel', 'selectPage', 'archiveList', 'archiveDetail', 'homeCoreCount', 'homeBestWave',
    'metaCoreCount', 'shopCoreCount', 'homeCurrentMode'
  ].forEach(get);

  const startButton = new Element('', 'button');
  startButton.classList.add('btnStartMode');
  const modeHint = new Element();
  const selCount = new Element();
  const towerCount = new Element();
  bySelector.set('.btnStartMode', [startButton]);
  bySelector.set('.modeHint', [modeHint]);
  bySelector.set('.selCount', [selCount]);
  bySelector.set('.homeStartTowerCount', [towerCount]);
  bySelector.set('[data-home-pane]', []);
  bySelector.set('[data-settings-tab]', []);
  bySelector.set('[data-settings-panel]', []);
  bySelector.set('[data-loadout-grid]', []);
  bySelector.set('[data-tower-index]', []);
  bySelector.set('[data-archive-type]', []);

  const modeCards = [];
  ['level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9', 'endless1'].forEach(mode => {
    const card = new Element();
    card.dataset.mode = mode;
    card._strongText = mode === 'endless1' ? '无尽模式一' : `关卡 ${mode.slice(5)}`;
    card._levelState = new Element();
    modeCards.push(card);
  });
  bySelector.set('[data-mode]', modeCards);

  const storage = new Map();
  const sandbox = {
    console,
    Math,
    JSON,
    Set,
    Map,
    structuredClone: global.structuredClone,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
    window: {
      _events: [],
      dispatchEvent(event) { this._events.push(event); },
      addEventListener() {}
    },
    document: {
      getElementById: get,
      createElement(tag) { return new Element('', tag); },
      querySelectorAll(selector) { return bySelector.get(selector) || []; },
      querySelector(selector) {
        const modeMatch = selector.match(/^\[data-mode="([^"]+)"\] strong$/);
        if (modeMatch) {
          const card = modeCards.find(c => c.dataset.mode === modeMatch[1]);
          return card ? { textContent: card._strongText } : null;
        }
        return null;
      },
      addEventListener() {}
    },
    activeGameScene() { return sandbox.__activeScene || null; },
    __ids: byId,
    __selectors: bySelector,
    __storage: storage
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadUiContext() {
  const ctx = createUiSandbox();
  [
    'src/data/meta.js',
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/game-config.js',
    'src/data/archive.js',
    'src/core/meta-store.js',
    'src/core/map-utils.js',
    'src/ui/home-ui.js',
    'src/ui/view-settings.js',
    'src/ui/archive-ui.js',
    'src/game/minimap.js',
    'src/game/input-controller.js'
  ].forEach(file => vm.runInContext(read(file), ctx, { filename: file }));
  vm.runInContext(`
    this.__ui = {
      getMeta: () => metaSave,
      setMeta: raw => { metaSave = normalizeMetaSave(raw); return metaSave; },
      ViewModeController,
      viewSettings,
      toggleViewMode,
      syncViewSettingsUI,
      MiniMapMethods,
      InputControllerMethods,
      ensureModeForPane,
      selectedModeLocked,
      refreshStartButton,
      getSelectedMode: () => selectedMode,
      setSelectedMode: mode => { selectedMode = mode; },
      getSelectedTowers: () => selectedTowers.slice(),
      setSelectedTowers: list => { selectedTowers = list.slice(); },
      toggleTowerSelection,
      towerArchiveDetailHtml,
      enemyArchiveDetailHtml,
      enemySpeedLabel,
      towerIconSpec,
      enemyIconSpec,
      archiveIconSvg,
      allTowers: () => ALL_TOWERS,
      enemies: () => EC,
      towerIconSpecs: () => TOWER_ICON_SPECS,
      enemyIconSpecs: () => ENEMY_ICON_SPECS,
      iconGlyphDefs: () => ICON_GLYPH_DEFS
    };
  `, ctx);
  return ctx;
}

function testViewMode(ctx) {
  const ui = ctx.__ui;
  const applyCalls = [];
  ctx.__activeScene = { applyViewSettings: () => applyCalls.push(ui.viewSettings().cameraMode) };

  ui.setMeta({ settings: { cameraMode: 'local' } });
  ui.ViewModeController.init();
  assert(ui.viewSettings().cameraMode === 'local', 'view mode should initialize as local');

  const globalMode = ui.ViewModeController.toggle();
  assert(globalMode === 'global', 'view toggle should switch local -> global');
  assert(ui.viewSettings().cameraMode === 'global', 'global view mode should be persisted to meta settings');
  assert(ctx.__storage.has('r32-meta-v1'), 'view toggle should save meta settings');
  assert(applyCalls.at(-1) === 'global', 'view toggle should re-apply active game scene camera settings');
  assert(ctx.window._events.some(e => e.type === 'r32:view-mode-change' && e.detail.cameraMode === 'global'), 'view toggle should dispatch r32:view-mode-change');
  assert(ctx.__ids.get('btnViewToggle').textContent.length > 0, 'home view toggle button should keep visible text');
  assert(ctx.__ids.get('btnViewToggle').getAttribute('aria-pressed') === 'false', 'global mode should update view toggle aria state');
  assert(ctx.__ids.get('homeViewMode').textContent === ctx.__ids.get('pauseViewMode').textContent, 'home and pause view labels should stay synced');

  const localMode = ui.ViewModeController.toggle();
  assert(localMode === 'local', 'view toggle should switch global -> local');
  assert(ctx.__ids.get('btnPauseViewToggle').getAttribute('aria-pressed') === 'true', 'local mode should update pause view toggle aria state');
}

function makeGroup() {
  return { children: { iterate() {} } };
}

function testMinimap(ctx) {
  const ui = ctx.__ui;
  vm.runInContext('MAP={w:2000,h:1000,walls:[],spawns:[],reactor:{x:1000,y:500},unitScale:1};', ctx);
  const calls = [];
  const scene = {
    view: { cameraMode: 'local' },
    ship: { x: 100, y: 100 },
    miniMapWrap: ctx.__ids.get('miniMapWrap'),
    miniMapCanvas: { width: 200, height: 120, getContext: () => new Proxy({}, { get: () => () => {} }) },
    miniMapCtx: new Proxy({}, { get: () => () => {} }),
    towers: makeGroup(),
    blockers: makeGroup(),
    drones: makeGroup(),
    droneHelpers: makeGroup(),
    enemies: makeGroup(),
    reactors: [],
    reactorAlive: () => true,
    drawMiniMapGroup() {},
    cameras: {
      main: {
        width: 1280,
        height: 720,
        zoom: 1,
        scrollX: 0,
        scrollY: 0,
        setBounds(...args) { calls.push(['bounds', ...args]); },
        setZoom(value) { this.zoom = value; calls.push(['zoom', value]); },
        startFollow(...args) { calls.push(['follow', ...args]); },
        stopFollow() { calls.push(['stopFollow']); },
        setDeadzone(...args) { calls.push(['deadzone', ...args]); },
        centerOn(...args) { calls.push(['centerOn', ...args]); }
      }
    }
  };
  Object.assign(scene, ui.MiniMapMethods);

  ui.setMeta({ settings: { cameraMode: 'local' } });
  scene.applyViewSettings();
  assert(scene.shouldShowMiniMap() === true, 'local view should show minimap');
  assert(scene.miniMapWrap.style.display === 'block', 'local view should display minimap wrapper');
  assert(calls.some(c => c[0] === 'follow'), 'local view should follow player ship');
  assert(calls.some(c => c[0] === 'zoom' && c[1] > 1), 'local view should zoom in');

  calls.length = 0;
  ui.setMeta({ settings: { cameraMode: 'global' } });
  scene.applyViewSettings();
  assert(scene.shouldShowMiniMap() === false, 'global view should hide minimap');
  assert(scene.miniMapWrap.style.display === 'none', 'global view should hide minimap wrapper');
  assert(calls.some(c => c[0] === 'stopFollow'), 'global view should stop following ship');
  assert(calls.some(c => c[0] === 'centerOn'), 'global view should center map');
  assert(calls.some(c => c[0] === 'zoom' && c[1] > 0 && c[1] < 1), 'global view should zoom out to show more map');
}

function testEscapeAndPause(ctx) {
  const ui = ctx.__ui;
  const calls = [];
  const scene = {
    ended: false,
    isPaused: false,
    channel: null,
    bld: false,
    selTw: null,
    physics: { world: { pause: () => calls.push('pauseWorld'), resume: () => calls.push('resumeWorld') } },
    time: {},
    tweens: { pauseAll: () => calls.push('pauseTweens'), resumeAll: () => calls.push('resumeTweens') },
    updateMiniMap: (...args) => calls.push(['miniMap', ...args]),
    cancelChannel: () => calls.push('cancelChannel'),
    updPanel: () => calls.push('updPanel'),
    updTwPanel: () => calls.push('updTwPanel'),
    ghost: { setVisible: () => calls.push('ghostHide') },
    ghostRng: { clear: () => calls.push('ghostRngClear') },
    selectionGfx: { clear: () => calls.push('selectionClear') }
  };
  Object.assign(scene, ui.InputControllerMethods);

  scene.handleEscape();
  assert(scene.isPaused === true, 'ESC with no modal/build state should pause');
  assert(ctx.__ids.get('pausePanel').style.display === 'flex', 'pause should display pause panel');
  assert(calls.some(c => Array.isArray(c) && c[0] === 'miniMap' && c[2] === true), 'enterPause should force minimap refresh');

  scene.handleEscape();
  assert(scene.isPaused === false, 'ESC while paused should resume instead of staying trapped');
  assert(ctx.__ids.get('pausePanel').style.display === 'none', 'resume should hide pause panel');

  scene.channel = {};
  calls.length = 0;
  scene.handleEscape();
  assert(calls.includes('cancelChannel'), 'ESC should cancel active channel before pausing');

  scene.channel = null;
  scene.bld = true;
  calls.length = 0;
  scene.handleEscape();
  assert(scene.bld === false && calls.includes('ghostHide'), 'ESC should clear build mode before pausing');
}

function testHomeModeLocks(ctx) {
  const ui = ctx.__ui;
  ui.setMeta({ levelClears: { level1: true }, settings: { cameraMode: 'local' } });
  ui.setSelectedMode('endless1');
  ui.ensureModeForPane('homeLevelPane');
  assert(ui.getSelectedMode() === 'level1', 'entering level pane from endless should select first unlocked level');
  ui.setSelectedMode('level1');
  ui.ensureModeForPane('homeEndlessPane');
  assert(ui.getSelectedMode() === 'endless1', 'entering endless pane from level should select endless map');

  ui.setSelectedMode('level3');
  assert(ui.selectedModeLocked() === true, 'level3 should be locked when level2 is uncleared');
  ui.setSelectedTowers([]);
  for (let i = 0; i < 12; i++) ui.toggleTowerSelection(i);
  assert(ui.getSelectedTowers().length === 10, 'tower loadout selection should be capped at 10');
}

function testArchiveAndIcons(ctx) {
  const ui = ctx.__ui;
  const towers = ui.allTowers();
  const enemies = ui.enemies();
  const glyphs = ui.iconGlyphDefs();
  const towerSpecs = ui.towerIconSpecs();
  const enemySpecs = ui.enemyIconSpecs();

  towers.forEach(t => {
    const spec = ui.towerIconSpec(t.id);
    assert(spec.glyph === towerSpecs[t.id]?.glyph, `${t.id} archive icon should use unified tower icon spec`);
    assert(glyphs[spec.glyph], `${t.id} archive glyph should exist`);
    const html = ui.towerArchiveDetailHtml(t);
    assert(html.includes(String(t.cost)), `${t.id} archive should display build cost`);
    t.upg.slice(1).forEach(u => assert(!u.c || html.includes(String(u.c)), `${t.id} archive should display upgrade cost ${u.c}`));
  });

  Object.entries(enemies).forEach(([id, enemy]) => {
    const spec = ui.enemyIconSpec(enemy);
    assert(spec === enemySpecs[enemy.key], `${id} archive icon should use enemy key icon spec`);
    assert(glyphs[spec.glyph], `${id} archive glyph should exist`);
    const html = ui.enemyArchiveDetailHtml({ id, ...enemy });
    assert(html.includes(String(enemy.hp)), `${id} archive should display HP`);
    assert(!html.includes(`>${enemy.spd}<`) && !html.includes(`${enemy.spd} HP`), `${id} archive should not expose raw speed as a stat`);
    assert(ui.enemySpeedLabel(enemy).length > 0, `${id} archive should provide qualitative speed label`);
  });
}

function testMapEditorDragAndLevels() {
  const html = read('map-editor.html');
  const required = [
    "drag.type === 'move-wall'",
    "drag.type === 'move-spawn'",
    "drag.type === 'move-reactor'",
    "mode === 'select'",
    "canvas.addEventListener('mousedown'",
    "canvas.addEventListener('mousemove'",
    "window.addEventListener('mouseup'",
    "$('importBtn').onclick",
    'function loadLevel'
  ];
  required.forEach(snippet => assert(html.includes(snippet), `map editor missing expected interaction hook: ${snippet}`));

  assert(html.includes('src/data/imported-level-maps.js'), 'map editor should load the shared imported level map registry');
  assert(/const\s+LEVELS\s*=\s*Object\.entries/.test(html), 'map editor should derive its active LEVELS list from imported maps');
}

function testStaticUiGuards() {
  const cssFiles = fs.readdirSync('src/styles').filter(file => file.endsWith('.css')).map(file => `src/styles/${file}`);
  const css = cssFiles.map(read).join('\n');
  assert(css.includes(':focus-visible'), 'styles should preserve a visible keyboard/controller focus indicator');
  assert(css.includes('@media'), 'styles should contain responsive media rules');
  assert(!/z-index\s*:\s*[0-9]{4,}/i.test(css), 'styles should avoid z-index values over 1000');
  const outlineLines = css.split(/\r?\n/).filter(line => /outline\s*:\s*(none|0)/i.test(line));
  const unsafeOutlineLines = outlineLines.filter(line => !line.includes(':focus-visible'));
  assert(!unsafeOutlineLines.length, 'styles should not remove outline without a focus-visible selector on the same rule');

  const demo = read('demo.html');
  ['主界面只保留', '过程性文案', 'demo目标'].forEach(text => {
    assert(!demo.includes(text), `demo should not include process placeholder copy: ${text}`);
  });
  [
    '\u8fb9\u5883\u86c7\u9053',
    '\u53cc\u95e8\u6c47\u6d41',
    '\u73af\u5f62\u77ff\u533a',
    '\u88c2\u8c37\u4e09\u7ebf',
    '\u8fdc\u5f81\u8bd5\u9a8c',
    '\u6781\u51a0\u88c2\u9699',
    '\u53cc\u7ffc\u524d\u7ebf',
    '\u5317\u89d2\u5821\u5792'
  ].forEach(text => {
    assert(!demo.includes(text), `demo should not expose designed level name: ${text}`);
  });
  assert(demo.includes('id="btnEnemyTest"'), 'demo should expose the enemy combat browser test entry');
  assert(demo.includes('id="hudCompleted"'), 'HUD should show completed waves separately from current wave');
  assert(demo.includes('残敌 <span id="hudEnemies"'), 'HUD should label active enemies as remaining enemies');
  assert(demo.includes('id="enemyTestPanel"'), 'demo should include the enemy combat test control panel');
  ['id="enemyTestStart"', 'id="enemyTestStop"', 'id="enemyTestCount"', 'id="enemyTestInterval"'].forEach(snippet => {
    assert(demo.includes(snippet), `enemy combat sandbox should include control: ${snippet}`);
  });
  assert(demo.includes('src/game/enemy-test-lab.js'), 'demo should load the enemy combat test lab script');
  assert(demo.includes('src/ui/draggable-panels.js'), 'demo should load shared draggable panel helpers');
  assert(demo.indexOf('src/ui/draggable-panels.js') < demo.indexOf('src/ui/page-flow.js'), 'draggable panel helpers should load before page-flow.js');
  assert(demo.indexOf('src/game/enemy-test-lab.js') < demo.indexOf('src/game/game-scene.js'), 'enemy test lab should load before game-scene.js');

  const pageFlow = read('src/ui/page-flow.js');
  assert(pageFlow.includes('initDraggablePanels()'), 'page flow should initialize shared draggable panels');
  assert(pageFlow.includes('startEnemyCombatTest'), 'page flow should define an enemy combat test launcher');
  assert(pageFlow.includes('btnEnemyTest'), 'page flow should bind the enemy combat test button');
  assert(pageFlow.includes('launchGameAfterPaint([],ENEMY_TEST_MODE)'), 'enemy combat test should launch without requiring a tower loadout');
  assert(/function\s+startSelectedMode\(\)[\s\S]*?destroyGameInstance\(\)[\s\S]*?launchGameAfterPaint\(selectedTowers\.slice\(\),selectedMode\)/.test(pageFlow), 'starting a normal mode should destroy any stale Phaser instance before launching');
  assert(/function\s+startEnemyCombatTest\(\)[\s\S]*?destroyGameInstance\(\)[\s\S]*?launchGameAfterPaint\(\[\],ENEMY_TEST_MODE\)/.test(pageFlow), 'starting enemy sandbox should destroy any stale Phaser instance before launching');
  assert(pageFlow.includes('gamePage.replaceChildren()'), 'destroying a game instance should clear stale canvas children from gamePage');
  assert(pageFlow.includes('launchGameAfterPaint') && pageFlow.includes('requestAnimationFrame'), 'game launch should display loading UI before heavy synchronous map setup');
  assert(pageFlow.includes('finishLaunchAttempt'), 'game launch should reset launch guard after success or failure');
  assert(pageFlow.includes('启动超时'), 'game launch should expose a timeout state for stalled startup diagnostics');

  const lab = read('src/game/enemy-test-lab.js');
  ['ENEMY_TEST_MODE', 'ENEMY_TEST_MAP', 'startEnemyTestWave', 'stopEnemyTestWave', 'enemyTestBuildChoices', 'applyEnemyTestCamera', 'makePanelDraggable', 'clearEnemyTestEnemies'].forEach(snippet => {
    assert(lab.includes(snippet), `enemy test lab missing expected hook: ${snippet}`);
  });
  const draggable = read('src/ui/draggable-panels.js');
  ['makePanelDraggable', 'resetFloatingPanel', 'twPanel', 'twPanelHead'].forEach(snippet => {
    assert(draggable.includes(snippet), `shared draggable helper missing expected hook: ${snippet}`);
  });
  assert(css.includes('.floatingDragHandle') && css.includes('cursor:move'), 'draggable panels should show a move cursor affordance');
  assert(css.includes('#twPanel.dragging') && css.includes('#enemyTestPanel.dragging'), 'tower and enemy sandbox panels should share dragging feedback');

  const hud = read('src/game/hud-overlay.js');
  ['wavePhaseText', '清理残敌', 'hudCompleted'].forEach(snippet => {
    assert(hud.includes(snippet), `HUD should keep clear wave-progress wording: ${snippet}`);
  });
  const debugTools = read('src/core/debug-tools.js');
  ['r32SetLoading', 'r32HideLoading', 'r32LoadingFailed', 'r32LoadingPanel'].forEach(snippet => {
    assert(debugTools.includes(snippet), `debug tools should expose loading diagnostic hook: ${snippet}`);
  });
  const gameScene = read('src/game/game-scene.js');
  ['launchStep', '计算寻路', '反应炉/出生点', '输入与面板', '等待首帧', '启动完成'].forEach(snippet => {
    assert(gameScene.includes(snippet), `game scene should mark launch stage: ${snippet}`);
  });
}

function main() {
  const ctx = loadUiContext();
  testViewMode(ctx);
  testMinimap(ctx);
  testEscapeAndPause(ctx);
  testHomeModeLocks(ctx);
  testArchiveAndIcons(ctx);
  testMapEditorDragAndLevels();
  testStaticUiGuards();
  console.log('ui flow ok: view toggle, minimap modes, pause/ESC, home locks, archives, icons and editor interactions verified');
}

main();
