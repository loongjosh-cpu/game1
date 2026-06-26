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
    MAP: { unitScale: 1 }
  };
  vm.createContext(sandbox);
  for (const file of [
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/game-config.js',
    'src/core/map-utils.js',
    'src/game/enemy-navigation.js',
    'src/game/enemy-targeting.js',
    'src/game/enemy-combat.js',
    'src/game/combat-utils.js'
  ]) {
    vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    this.__targeting = {
      EC,
      BLOCK_TOWERS,
      DRONE_TOWERS,
      EnemyNavigationMethods,
      EnemyTargetingMethods,
      EnemyCombatMethods,
      CombatUtilMethods
    };
  `, sandbox);
  return sandbox.__targeting;
}

function group(items) {
  return {
    children: {
      iterate(fn) {
        items.forEach(fn);
      }
    }
  };
}

function tower(type, x, y, lv = 0, extra = {}) {
  const up = type.upg[lv];
  return {
    active: true,
    _type: type,
    _lv: lv,
    _hp: extra.hp ?? up.hp ?? up.coreHp ?? 100,
    _maxhp: extra.maxhp ?? up.hp ?? up.coreHp ?? 100,
    x,
    y,
    ...extra
  };
}

function enemy(type, x, y, extra = {}) {
  return {
    active: true,
    _type: type,
    _at: 9999,
    _firstAttack: false,
    _dmg: 4,
    _atk: 900,
    x,
    y,
    setRotation() {},
    body: { setVelocity() {} },
    ...extra
  };
}

function makeScene(ctx, blockers = [], drones = [], reactors = [], droneHelpers = []) {
  return {
    ...ctx.EnemyNavigationMethods,
    ...ctx.EnemyTargetingMethods,
    ...ctx.EnemyCombatMethods,
    ...ctx.CombatUtilMethods,
    meta: { b1LowWreck: false, b3Taunt: false },
    blockers: group(blockers),
    drones: group(drones),
    reactors,
    droneHelpers: group(droneHelpers),
    gridPF: [],
    _routes: [],
    _rejoined: false,
    _dartCount: 0,
    _shellCount: 0,
    _blockerHits: 0,
    enemyCanBeTauntedBy: ctx.EnemyTargetingMethods.enemyCanBeTauntedBy,
    setRoute(e, route) {
      e._route = route;
      e._routeI = Math.min(1, route.length - 1);
      this._routes.push(route);
    },
    makeRoute(x1, y1, x2, y2) {
      return [[x1, y1], [x2, y2]];
    },
    rejoinPath(e) {
      ctx.EnemyNavigationMethods.rejoinPath.call(this, e);
      this._rejoined = true;
    },
    stopEnemyAndFace() {},
    fireEnemyDart() {
      this._dartCount++;
    },
    fireEnemyShell() {
      this._shellCount++;
    },
    enemyHitBlocker() {
      this._blockerHits++;
    },
    moveEnemy() {}
  };
}

function testDangerAndRange(ctx, issues) {
  const b1 = ctx.BLOCK_TOWERS.find(t => t.id === 'B1');
  const b3 = ctx.BLOCK_TOWERS.find(t => t.id === 'B3');
  const scene = makeScene(ctx);
  const e2 = enemy('E2', 0, 0);
  const cfg2 = ctx.EC.E2;
  const steel = tower(b1, 100, 0, 0);
  assert(scene.enemyCanBeTauntedBy(e2, cfg2, steel), 'enemy should be taunted by in-range sufficient-danger blocker', issues);
  steel.x = 1000;
  assert(!scene.enemyCanBeTauntedBy(e2, cfg2, steel), 'enemy should not be taunted after leaving blocker range', issues);

  const heavy = tower(b3, 100, 0, 0);
  scene.meta.b3Taunt = true;
  assert(scene.towerDanger(heavy) === 3, 'B3 taunt chip should raise normal danger to 3', issues);
  heavy._hp = 50;
  heavy._maxhp = 150;
  assert(scene.towerDanger(heavy) === 1, 'B3 taunt chip should lower low-HP danger to 1', issues);
}

function testChooseBlockerPriority(ctx, issues) {
  const b1 = ctx.BLOCK_TOWERS.find(t => t.id === 'B1');
  const b2 = ctx.BLOCK_TOWERS.find(t => t.id === 'B2');
  const b5 = ctx.BLOCK_TOWERS.find(t => t.id === 'B5');
  const low = tower(b1, 100, 0, 0);
  const high = tower(b2, 280, 0, 0);
  const scene = makeScene(ctx, [low, high]);
  const e = enemy('E2', 0, 0);
  assert(scene.chooseBlocker(e) === high, 'higher danger blocker should be preferred over closer lower danger blocker', issues);

  const sameA = tower(b5, 100, 0, 1); // B5 Lv2 danger 2
  const sameB = tower(b1, 250, 0, 0); // B1 Lv1 danger 2
  const scene2 = makeScene(ctx, [sameA, sameB]);
  assert(scene2.chooseBlocker(e) === sameA, 'same danger should choose nearest when no target is held', issues);

  e._b1tgt = sameB;
  assert(scene2.chooseBlocker(e) === sameB, 'held same-danger blocker should not be replaced by nearer same-danger blocker', issues);

  sameB.x = 1000;
  assert(scene2.chooseBlocker(e) === sameA, 'held blocker should be dropped after leaving taunt range', issues);
}

function testReactorFallback(ctx, issues) {
  const scene = makeScene(ctx, [], [], [
    { active: true, _hp: 100, x: 500, y: 0 },
    { active: true, _hp: 100, x: 120, y: 0 }
  ]);
  const e = enemy('E1', 0, 0);
  assert(scene.chooseReactor(e) === scene.reactors[1], 'reactor fallback should choose nearest alive reactor', issues);
  scene.reactors[1]._hp = 0;
  assert(scene.chooseReactor(e) === scene.reactors[0], 'dead reactor should not be selected as fallback target', issues);
}

function testTargetScanReleasesOutOfRange(ctx, issues) {
  const b1 = ctx.BLOCK_TOWERS.find(t => t.id === 'B1');
  const held = tower(b1, 1000, 0, 0);
  const scene = makeScene(ctx, [held]);
  const e = enemy('E2', 0, 0, { _b1tgt: held, _scan: 0 });
  scene.updateEnemyTargetScan(e, ctx.EC.E2, 250);
  assert(e._b1tgt === null, 'target scan should clear blocker target after it leaves range', issues);
  assert(scene._rejoined, 'target scan should rejoin path after losing blocker target', issues);
}

function testE11DronePriorityObeysBlocker(ctx, issues) {
  const source = read('src/game/enemy-combat.js');
  assert(
    /if\(e\._b1tgt&&this\.enemyCanBeTauntedBy\(e,cfg,e\._b1tgt\)\)return false;/.test(source),
    'E11 drone-priority branch must yield when a valid blocker target is active',
    issues
  );

  const b1 = ctx.BLOCK_TOWERS.find(t => t.id === 'B1');
  const blocker = tower(b1, 40, 0, 0);
  const helper = { active: true, _hp: 10, x: 100, y: 0 };
  const scene = makeScene(ctx, [blocker], [], [], [helper]);
  const e = enemy('E11', 0, 0, { _b1tgt: blocker, _dmg: 4, _atk: 900 });
  const handled = scene.handleEnemyDroneCombat(e, ctx.EC.E11, 1000);
  assert(handled === false, 'E11 drone branch should not consume combat while blocker is valid', issues);
  assert(scene._dartCount === 0, 'E11 should not fire at drone while blocked by a valid blocker', issues);

  e._b1tgt = null;
  scene.handleEnemyDroneCombat(e, ctx.EC.E11, 1000);
  assert(scene._dartCount === 1, 'E11 should fire at nearest drone when no valid blocker is active', issues);
}

function testSourceOrder(ctx, issues) {
  const status = read('src/game/enemy-status.js');
  assert(/updateEnemyTargetScan\(e,cfg,dt\)[\s\S]*handleEnemyDroneCombat\(e,cfg,dt\)[\s\S]*handleEnemyBlockerCombat\(e,cfg,dt\)[\s\S]*handleEnemyReactorCombat\(e,cfg,dt\)/.test(status), 'enemy update order should scan target before drone/blocker/reactor combat', issues);
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testDangerAndRange(ctx, issues);
  testChooseBlockerPriority(ctx, issues);
  testReactorFallback(ctx, issues);
  testTargetScanReleasesOutOfRange(ctx, issues);
  testE11DronePriorityObeysBlocker(ctx, issues);
  testSourceOrder(ctx, issues);
  if (issues.length) {
    console.error(`enemy targeting verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified');
}

main();
