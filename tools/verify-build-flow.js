const fs = require('fs');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function loadContext() {
  const sandbox = {
    console,
    Math,
    JSON,
    Phaser: {
      Math: {
        Distance: {
          Between(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
          }
        },
        Clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }
      }
    },
    document: {
      getElementById() {
        return {
          style: {},
          className: '',
          textContent: '',
          innerHTML: '',
          classList: { add() {}, remove() {}, toggle() {} },
          querySelectorAll() { return []; }
        };
      }
    },
    MAP: { unitScale: 1, walls: [], spawns: [], reactor: { x: 0, y: 0 } }
  };
  vm.createContext(sandbox);
  for (const file of [
    'src/data/towers.js',
    'src/data/game-config.js',
    'src/core/map-utils.js',
    'src/game/placement-controller.js',
    'src/game/tower-panel.js',
    'src/game/player-runtime.js'
  ]) {
    vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    this.__build = {
      ALL_TOWERS,
      BLOCK_TOWERS,
      PATH_TOWERS,
      SMALL_REACTOR,
      REACTOR_MIN_DISTANCE,
      SHIP_RNG,
      PlacementControllerMethods,
      TowerPanelMethods,
      PlayerRuntimeMethods
    };
  `, sandbox);
  return sandbox.__build;
}

function makeScene(build) {
  return {
    ...build.PlacementControllerMethods,
    ...build.TowerPanelMethods,
    ...build.PlayerRuntimeMethods,
    meta: {
      b4Resonance: false,
      p1Recycle: false,
      b7Manual: false,
      b7Hp: false
    },
    en: 1000,
    isPaused: false,
    shipDead: false,
    channel: null,
    ship: { x: 0, y: 0 },
    selTw: null,
    gainEnergy(v) { this.en += v; },
    updPanel() {},
    updTwPanel() {},
    updChannelPanel() {},
    applyUpgrade(tw) {
      const next = tw._type.upg[(tw._lv || 0) + 1];
      this.en -= next.c;
      tw._lv = (tw._lv || 0) + 1;
    },
    canPlaceType() { return true; },
    placeTower() { this._placed = true; },
    channelGfx: { clear() {} }
  };
}

function testSourceInvariants(issues) {
  const playerRuntime = read('src/game/player-runtime.js');
  assert(
    /activePointer\.leftButtonDown\(\).*startBuild/.test(playerRuntime.replace(/\s+/g, ' ')),
    'build confirmation must require leftButtonDown(), not generic pointer isDown',
    issues
  );
  assert(
    !/activePointer\.isDown.*startBuild/.test(playerRuntime.replace(/\s+/g, ' ')),
    'build confirmation still uses generic activePointer.isDown',
    issues
  );

  const placement = read('src/game/placement-controller.js');
  assert(/td===SMALL_REACTOR\?sd\(REACTOR_MIN_DISTANCE\)/.test(placement), 'small reactor distance rule must use REACTOR_MIN_DISTANCE', issues);
  assert(/finishBuildChannel\(c\)[\s\S]*this\.en<this\.towerBuildCost\(c\.td\)[\s\S]*!this\.canPlaceType/.test(placement), 'finishBuildChannel must re-check energy and placement', issues);
  assert(/finishUpgradeChannel\(c\)[\s\S]*!c\.tw\.active[\s\S]*\(c\.tw\._lv\|\|0\)!==c\.fromLevel[\s\S]*this\.en<c\.cost/.test(placement), 'finishUpgradeChannel must re-check active tower, level and energy', issues);

  const towerPanel = read('src/game/tower-panel.js');
  assert(/document\.getElementById\('btnUpgrade'\)[\s\S]*this\.upgradeTower\(\)/.test(read('src/game/input-controller.js')), 'upgrade button must call upgradeTower()', issues);
  assert(/canSellTower\(tw\)[\s\S]*!this\.isPaused&& !?/.test(towerPanel.replace(/\s+/g, ' ')) || /return !this\.isPaused&&!this\.channel&&tw&&tw\.active&&tw\._type\.type!=='reactor'/.test(towerPanel), 'sell must be blocked while paused, channeling, invalid, or reactor', issues);
}

function testBuildCosts(build, issues) {
  const scene = makeScene(build);
  const b4 = build.BLOCK_TOWERS.find(t => t.id === 'B4');
  assert(scene.towerBuildCost(b4) === b4.cost, 'B4 base build cost mismatch', issues);
  scene.meta.b4Resonance = true;
  assert(scene.towerBuildCost(b4) === Math.max(0, b4.cost - 80), 'B4 resonance chip should reduce build cost by 80', issues);
}

function testSellRefunds(build, issues) {
  const scene = makeScene(build);
  const p1 = build.PATH_TOWERS.find(t => t.id === 'P1');
  const b7 = build.BLOCK_TOWERS.find(t => t.id === 'B7');
  const p1Tower = { _type: p1, _lv: 1, _buildCost: p1.cost };
  assert(scene.sellRefund(p1Tower) === Math.floor((p1.cost + p1.upg[1].c) * 0.5), 'default sell refund should be 50% invested', issues);
  scene.meta.p1Recycle = true;
  assert(scene.sellRefund(p1Tower) === Math.floor((p1.cost + p1.upg[1].c) * 0.9), 'P1 recycle chip should refund 90% invested', issues);
  scene.meta.b7Manual = true;
  assert(scene.sellRefund({ _type: b7, _lv: 0, _buildCost: b7.cost }) === 0, 'B7 manual detonation sell refund should be 0', issues);
}

function testUpgradeGuards(build, issues) {
  const scene = makeScene(build);
  const p1 = build.PATH_TOWERS.find(t => t.id === 'P1');
  const tower = { active: true, _type: p1, _lv: 0, x: 0, y: 0 };
  scene.selTw = tower;
  scene.en = p1.upg[1].c;
  assert(scene.upgradeBlockReason() === '', 'valid upgrade should not be blocked', issues);
  scene.en = p1.upg[1].c - 1;
  assert(scene.upgradeBlockReason() !== '', 'upgrade should be blocked when energy is insufficient', issues);
  scene.en = 9999;
  scene.channel = { kind: 'build' };
  assert(scene.upgradeBlockReason() !== '', 'upgrade should be blocked while another channel is active', issues);
  scene.channel = null;
  tower._lv = p1.upg.length - 1;
  assert(scene.upgradeBlockReason() !== '', 'upgrade should be blocked at max level', issues);
}

function testEnemySandboxInstantUpgradeSource(issues) {
  const source = read('src/game/tower-panel.js');
  assert(source.includes('this.isEnemyTestMode?.()') && source.includes('this.applyUpgrade(tw);'), 'enemy combat sandbox upgrades should apply immediately without a channel', issues);
  assert(source.includes('沙盒模式：升级已立即完成'), 'enemy combat sandbox instant upgrade should show a clear hint', issues);
}

function testChannelFinishGuards(build, issues) {
  const scene = makeScene(build);
  const p1 = build.PATH_TOWERS.find(t => t.id === 'P1');
  scene.sel = p1;
  scene.en = p1.cost;
  scene.finishBuildChannel({ kind: 'build', td: p1, x: 0, y: 0 });
  assert(scene._placed === true, 'finishBuildChannel should place when energy and placement are valid', issues);
  scene._placed = false;
  scene.en = p1.cost - 1;
  scene.finishBuildChannel({ kind: 'build', td: p1, x: 0, y: 0 });
  assert(scene._placed === false, 'finishBuildChannel should not place when energy is insufficient', issues);

  const tower = { active: true, _type: p1, _lv: 0 };
  scene.en = p1.upg[1].c;
  scene.finishUpgradeChannel({ kind: 'upgrade', tw: tower, fromLevel: 0, cost: p1.upg[1].c });
  assert(tower._lv === 1 && scene.en === 0, 'finishUpgradeChannel should upgrade and deduct cost when valid', issues);
  tower._lv = 0;
  scene.en = p1.upg[1].c - 1;
  scene.finishUpgradeChannel({ kind: 'upgrade', tw: tower, fromLevel: 0, cost: p1.upg[1].c });
  assert(tower._lv === 0, 'finishUpgradeChannel should not upgrade when energy is insufficient', issues);
}

function testReactorAndHpRules(build, issues) {
  const scene = makeScene(build);
  const b7 = build.BLOCK_TOWERS.find(t => t.id === 'B7');
  assert(scene.effectiveTowerHp(b7, b7.upg[0]) === b7.upg[0].hp, 'B7 base HP mismatch', issues);
  scene.meta.b7Hp = true;
  assert(scene.effectiveTowerHp(b7, b7.upg[0]) === b7.upg[0].hp + 100, 'B7 HP chip should add 100 HP', issues);
  assert(build.REACTOR_MIN_DISTANCE === 1000, 'reactor minimum distance should be 1000', issues);
}

function main() {
  const issues = [];
  const build = loadContext();
  testSourceInvariants(issues);
  testBuildCosts(build, issues);
  testSellRefunds(build, issues);
  testUpgradeGuards(build, issues);
  testEnemySandboxInstantUpgradeSource(issues);
  testChannelFinishGuards(build, issues);
  testReactorAndHpRules(build, issues);
  if (issues.length) {
    console.error(`build flow verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('build flow ok: placement, channel, upgrade and sell guards verified');
}

main();
