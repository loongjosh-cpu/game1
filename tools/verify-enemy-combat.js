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
    Set,
    Phaser: {
      Math: {
        Between(min) { return min; },
        Clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
        Distance: {
          Between(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
        }
      }
    },
    MAP: { unitScale: 1, walls: [], spawns: [[0, 0]], reactor: { x: 0, y: 0 }, w: 2000, h: 2000 }
  };
  vm.createContext(sandbox);
  [
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/game-config.js',
    'src/core/map-utils.js',
    'src/game/enemy-navigation.js',
    'src/game/enemy-targeting.js',
    'src/game/enemy-combat.js',
    'src/game/enemy-status.js',
    'src/game/enemy-waves.js',
    'src/game/combat-utils.js'
  ].forEach(file => vm.runInContext(read(file), sandbox, { filename: file }));
  vm.runInContext(`
    this.__enemyCombat = {
      EC,
      BLOCK_TOWERS,
      DRONE_TOWERS,
      EnemyNavigationMethods,
      EnemyTargetingMethods,
      EnemyCombatMethods,
      EnemyStatusMethods,
      EnemyWaveMethods,
      CombatUtilMethods
    };
  `, sandbox);
  return sandbox.__enemyCombat;
}

function group(items = []) {
  return {
    list: items,
    children: {
      iterate(fn) { items.slice().forEach(fn); }
    },
    add(item) { items.push(item); }
  };
}

function makeSprite(x, y, extra = {}) {
  return {
    active: true,
    x,
    y,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    body: {
      radius: 16,
      enable: true,
      setVelocity(vx, vy) { this.vx = vx; this.vy = vy; },
      setCircle(radius) { this.radius = radius; },
      setBounce() {}
    },
    setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
    setRotation(value) { this.rotation = value; return this; },
    setDepth() { return this; },
    setTint() { return this; },
    setScale() { return this; },
    setAlpha(value) { this.alpha = value; return this; },
    clearTint() { return this; },
    destroy() { this.active = false; return this; },
    ...extra
  };
}

function makeEnemy(ctx, id, x = 0, y = 0, extra = {}) {
  const cfg = ctx.EC[id];
  return makeSprite(x, y, {
    _type: id,
    _uid: extra._uid || Math.floor(Math.random() * 1000000),
    _hp: extra.hp ?? cfg.hp,
    _maxhp: extra.maxhp ?? cfg.hp,
    _dmg: extra.dmg ?? cfg.dmg,
    _spd: cfg.spd,
    _atk: cfg.atk,
    _at: extra.at ?? 0,
    _firstAttack: extra.firstAttack ?? true,
    _si: 0,
    _hits: extra.hits || 0,
    _hatch: cfg.hatch || 0,
    _summonTimers: (cfg.summons || []).map(s => ({ type: s.type, interval: s.interval, left: s.interval })),
    _route: [],
    _routeI: 0,
    ...extra
  });
}

function makeBlocker(ctx, id = 'B1', x = 0, y = 0, lv = 0, extra = {}) {
  const type = ctx.BLOCK_TOWERS.find(t => t.id === id);
  const up = type.upg[lv];
  return makeSprite(x, y, {
    _type: type,
    _lv: lv,
    _hp: extra.hp ?? up.hp,
    _maxhp: extra.maxhp ?? up.hp,
    ...extra
  });
}

function makeDroneCore(ctx, id = 'D1', x = 0, y = 0, lv = 0, extra = {}) {
  const type = ctx.DRONE_TOWERS.find(t => t.id === id);
  const up = type.upg[lv];
  return makeSprite(x, y, {
    _type: type,
    _lv: lv,
    _hp: extra.hp ?? up.coreHp,
    _maxhp: extra.maxhp ?? up.coreHp,
    ...extra
  });
}

function makeReactor(x = 0, y = 0, hp = 120, extra = {}) {
  return makeSprite(x, y, {
    _isReactor: true,
    _isMainReactor: false,
    _size: 120,
    _hp: hp,
    _maxhp: hp,
    ...extra
  });
}

function makeDroneHelper(owner, x = 0, y = 0, hp = 40, extra = {}) {
  return makeSprite(x, y, {
    _owner: owner,
    _hp: hp,
    _maxhp: hp,
    ...extra
  });
}

function makeScene(ctx, options = {}) {
  const blockers = options.blockers || [];
  const drones = options.drones || [];
  const droneHelpers = options.droneHelpers || [];
  const reactors = options.reactors || [];
  const enemies = options.enemies || [];
  const scene = {
    ...ctx.EnemyNavigationMethods,
    ...ctx.EnemyTargetingMethods,
    ...ctx.EnemyCombatMethods,
    ...ctx.EnemyStatusMethods,
    ...ctx.EnemyWaveMethods,
    ...ctx.CombatUtilMethods,
    meta: {
      b1Repair: false,
      b3Taunt: false,
      b4Shield: false,
      b4Resonance: false,
      b5Overheal: false,
      b6ToxicShell: false,
      d1ReactiveArmor: false,
      poisonDamage: false,
      poisonLong: false,
      poisonSlow: false,
      ...options.meta
    },
    blockers: group(blockers),
    drones: group(drones),
    droneHelpers: group(droneHelpers),
    reactors,
    enemies: group(enemies),
    ship: options.ship || null,
    shipDead: false,
    enemySeq: 100,
    rxHP: reactors.find(r => r._isMainReactor)?._hp || 0,
    completedWaves: 0,
    wave: 1,
    levelConfig: null,
    gridPF: [[0]],
    add: {
      image: (x, y) => makeSprite(x, y),
      graphics: () => ({
        setPosition() { return this; },
        setDepth() { return this; },
        setScale() { return this; },
        fillStyle() { return this; },
        fillCircle() { return this; },
        lineStyle() { return this; },
        strokeCircle() { return this; },
        lineBetween() { return this; },
        setAlpha() { return this; },
        destroy() { this.destroyed = true; }
      })
    },
    tweens: {
      add(config) {
        if (config?.targets && Number.isFinite(config.x)) config.targets.x = config.x;
        if (config?.targets && Number.isFinite(config.y)) config.targets.y = config.y;
        if (typeof config?.onComplete === 'function') config.onComplete();
        return config;
      }
    },
    time: {
      events: [],
      addEvent(config) {
        this.events.push(config);
        if (typeof config.callback === 'function') config.callback();
        return { remove() {} };
      },
      delayedCall(_delay, cb) { if (typeof cb === 'function') cb(); }
    },
    physics: {
      add: {
        image: (x, y) => makeSprite(x, y, { width: 32 })
      }
    },
    scene: { pause() {} },
    selectionGfx: { clear() {} },
    ghost: { setVisible() {} },
    updPanel() {},
    updTwPanel() {},
    cancelChannel() {},
    gameOver() { this.ended = true; },
    killShip() { this.shipDead = true; if (this.ship) this.ship.active = false; },
    destroyB1(target) { target.destroy(); },
    destroyReactor(target) { target.destroy(); },
    destroyDrone(target) { target.destroy(); },
    damageDrone(target, damage, source = null, damageOptions = {}) {
      return this.applyFriendlyDamage({ source, target, amount: damage, ...damageOptions });
    },
    gainEnergy(v) { this.en = (this.en || 0) + v; },
    moveEnemy(e, dx, dy, speed) {
      e.body.setVelocity(dx ? speed : 0, dy ? speed : 0);
    },
    makeRoute(x1, y1, x2, y2) { return [[x1, y1], [x2, y2]]; },
    setRoute(e, route) { e._route = route; e._routeI = Math.min(1, route.length - 1); },
    routeToReactor(e) {
      e._reactorTarget = reactors.find(r => r.active && r._hp > 0) || null;
      if (e._reactorTarget) this.setRoute(e, this.makeRoute(e.x, e.y, e._reactorTarget.x, e._reactorTarget.y));
    }
  };
  return scene;
}

function targetHp(target) {
  return target._hp;
}

function testMeleeEnemyDamagesBlocker(ctx, id, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, id, 40, 0);
  enemy._b1tgt = blocker;
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  const before = targetHp(blocker);
  const handled = scene.handleEnemyBlockerCombat(enemy, ctx.EC[id], 650);
  assert(handled === true, `${id}: blocker combat should be handled in melee range`, issues);
  assert(targetHp(blocker) < before, `${id}: melee attack should reduce blocker HP`, issues);
}

function testAllMeleeDamage(ctx, issues) {
  const meleeIds = Object.keys(ctx.EC).filter(id => !ctx.EC[id].rangeAtk && !ctx.EC[id].droneRange && !ctx.EC[id].selfDestruct);
  meleeIds.forEach(id => testMeleeEnemyDamagesBlocker(ctx, id, issues));
}

function testE3SplitterAttacksBeforeDeath(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, 'E3', 40, 0);
  enemy._b1tgt = blocker;
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  const before = blocker._hp;
  scene.updateEnemy(enemy, 650);
  assert(blocker._hp < before, 'E3 splitter should deal blocker damage before it dies/splits', issues);
  assert(enemy.active, 'E3 splitter should stay alive after a normal attack', issues);
}

function testE3SplitOnDeath(ctx, issues) {
  const enemy = makeEnemy(ctx, 'E3', 0, 0, { hp: 1 });
  const spawned = [];
  const scene = makeScene(ctx, { enemies: [enemy] });
  scene.spawnAt = (type, x, y, si, summoned) => {
    spawned.push({ type, x, y, si, summoned });
    return makeEnemy(ctx, type, x, y, { _summoned: summoned });
  };
  scene.killE(enemy);
  assert(!enemy.active, 'E3 should be destroyed on death', issues);
  assert(spawned.length === 2 && spawned.every(s => s.type === 'E1' && s.summoned), 'E3 death should split into two summoned E1 enemies', issues);
}

function testE4Leech(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, 'E4', 40, 0, { hp: 90, maxhp: ctx.EC.E4.hp });
  enemy._b1tgt = blocker;
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  const beforeHp = enemy._hp;
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E4, 650);
  assert(enemy._hp > beforeHp, 'E4 should leech HP after a successful attack', issues);
  assert(blocker._hp < blocker._maxhp, 'E4 attack should still damage its blocker target', issues);
}

function testE9MeleeSplash(ctx, issues) {
  const main = makeBlocker(ctx, 'B1', 0, 0);
  const nearby = makeBlocker(ctx, 'B3', 20, 0);
  const mid = makeBlocker(ctx, 'B3', 120, 0);
  const far = makeBlocker(ctx, 'B3', 200, 0);
  const droneCore = makeDroneCore(ctx, 'D1', 0, 0);
  const helper = makeDroneHelper(droneCore, 25, 0, 20);
  const enemy = makeEnemy(ctx, 'E9', 40, 0);
  enemy._b1tgt = main;
  const scene = makeScene(ctx, { blockers: [main, nearby, mid, far], drones: [droneCore], droneHelpers: [helper], enemies: [enemy] });
  const nearbyBefore = nearby._hp;
  const midBefore = mid._hp;
  const helperBefore = helper._hp;
  const farBefore = far._hp;
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E9, 650);
  assert(main._hp < main._maxhp, 'E9 should damage the main blocker target', issues);
  assert(nearby._hp < nearbyBefore, 'E9 melee splash should damage nearby blockers', issues);
  assert(mid._hp < midBefore, 'E9 150-range melee splash should damage blockers beyond the old 50 range', issues);
  assert(helper._hp < helperBefore, 'E9 melee splash should damage nearby drone helpers', issues);
  assert(far._hp === farBefore, 'E9 melee splash should not damage out-of-range blockers', issues);
}

function testE10SummonOnSecondHit(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, 'E10', 40, 0);
  enemy._b1tgt = blocker;
  const spawned = [];
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  scene.spawnAt = (type, x, y, si, summoned) => {
    spawned.push({ type, x, y, si, summoned });
    return makeEnemy(ctx, type, x, y, { _summoned: summoned });
  };
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E10, 650);
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E10, 1000);
  assert(spawned.length === 1 && spawned[0].type === 'E4' && spawned[0].summoned, 'E10 should summon one E4 after every second successful attack', issues);
}

function testE11RangedDroneDamage(ctx, issues) {
  const core = makeDroneCore(ctx, 'D1', 0, 0);
  const helper = makeDroneHelper(core, 120, 0, 30);
  const enemy = makeEnemy(ctx, 'E11', 0, 0);
  const scene = makeScene(ctx, { drones: [core], droneHelpers: [helper], enemies: [enemy] });
  const before = helper._hp;
  const handled = scene.handleEnemyDroneCombat(enemy, ctx.EC.E11, 650);
  assert(handled === true, 'E11 drone-priority ranged combat should consume the enemy action for this frame', issues);
  assert(helper._hp < before, 'E11 dart should reduce drone helper HP after projectile arrives', issues);
}

function testE11RangedFallbackTargets(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 300, 0);
  const enemy = makeEnemy(ctx, 'E11', 0, 0);
  enemy._b1tgt = blocker;
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  const blockerBefore = blocker._hp;
  const handledBlocker = scene.handleEnemyBlockerCombat(enemy, ctx.EC.E11, 650);
  assert(handledBlocker === true, 'E11 should handle blocker combat at dart range instead of walking into melee', issues);
  assert(blocker._hp < blockerBefore, 'E11 dart should damage ordinary blocker targets when no drone overrides it', issues);

  const reactor = makeReactor(300, 0, 120, { _isMainReactor: true, _size: 120 });
  const reactorEnemy = makeEnemy(ctx, 'E11', 0, 0);
  reactorEnemy._reactorTarget = reactor;
  const reactorScene = makeScene(ctx, { reactors: [reactor], enemies: [reactorEnemy] });
  const reactorBefore = reactor._hp;
  const handledReactor = reactorScene.handleEnemyReactorCombat(reactorEnemy, ctx.EC.E11, 650);
  assert(handledReactor === true, 'E11 should handle reactor combat at dart range instead of walking into melee', issues);
  assert(reactor._hp < reactorBefore, 'E11 dart should damage reactor targets when no drone overrides it', issues);
}

function testE12RangedShell(ctx, issues) {
  const main = makeBlocker(ctx, 'B1', 300, 0);
  const nearby = makeBlocker(ctx, 'B3', 340, 0);
  const far = makeBlocker(ctx, 'B3', 520, 0);
  const core = makeDroneCore(ctx, 'D1', 340, 20);
  const helper = makeDroneHelper(core, 330, 0, 30);
  const ship = makeSprite(345, 0);
  const enemy = makeEnemy(ctx, 'E12', 0, 0);
  enemy._b1tgt = main;
  const scene = makeScene(ctx, { blockers: [main, nearby, far], drones: [core], droneHelpers: [helper], enemies: [enemy], ship });
  const mainBefore = main._hp;
  const nearbyBefore = nearby._hp;
  const coreBefore = core._hp;
  const helperBefore = helper._hp;
  const farBefore = far._hp;
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E12, 650);
  assert(main._hp < mainBefore, 'E12 shell should damage the primary target when it lands near the target', issues);
  assert(nearby._hp < nearbyBefore, 'E12 shell splash should damage nearby blockers', issues);
  assert(core._hp < coreBefore, 'E12 shell splash should damage nearby drone cores', issues);
  assert(helper._hp < helperBefore, 'E12 shell splash should damage nearby drone helpers', issues);
  assert(scene.shipDead === true, 'E12 shell splash should kill the player ship when it is inside the blast radius', issues);
  assert(far._hp === farBefore, 'E12 shell splash should not damage out-of-range blockers', issues);
}

function testE13SelfDestruct(ctx, issues) {
  const main = makeBlocker(ctx, 'B1', 0, 0);
  const nearby = makeBlocker(ctx, 'B3', 40, 0);
  const enemy = makeEnemy(ctx, 'E13', 40, 0);
  enemy._b1tgt = main;
  const scene = makeScene(ctx, { blockers: [main, nearby], enemies: [enemy] });
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E13, 1);
  assert(main._hp < main._maxhp, 'E13 self-destruct should immediately damage the primary target', issues);
  assert(nearby._hp < nearby._maxhp, 'E13 self-destruct should damage nearby blockers', issues);
  assert(!enemy.active, 'E13 should be destroyed after self-destructing', issues);
}

function testReactorDamageAndGameOver(ctx, issues) {
  const reactor = makeReactor(0, 0, 10, { _isMainReactor: true, _size: 120 });
  const enemy = makeEnemy(ctx, 'E1', 40, 0);
  enemy._reactorTarget = reactor;
  const scene = makeScene(ctx, { reactors: [reactor], enemies: [enemy] });
  scene.handleEnemyReactorCombat(enemy, ctx.EC.E1, 650);
  assert(reactor._hp < 10, 'enemy melee should damage main reactor target', issues);
  scene.handleEnemyReactorCombat(enemy, ctx.EC.E1, 1000);
  scene.handleEnemyReactorCombat(enemy, ctx.EC.E1, 1000);
  scene.handleEnemyReactorCombat(enemy, ctx.EC.E1, 1000);
  assert(scene.ended === true, 'main reactor should trigger gameOver after HP reaches zero', issues);
}

function testDroneMeleeAggroDamage(ctx, issues) {
  const core = makeDroneCore(ctx, 'D1', 0, 0);
  const helper = makeDroneHelper(core, 0, 0, 30);
  const enemy = makeEnemy(ctx, 'E1', 40, 0, { _droneTarget: helper });
  const scene = makeScene(ctx, { drones: [core], droneHelpers: [helper], enemies: [enemy] });
  const before = helper._hp;
  const handled = scene.handleEnemyDroneCombat(enemy, ctx.EC.E1, 650);
  assert(handled === true, 'enemy should handle melee drone combat when in close range', issues);
  assert(helper._hp < before, 'enemy melee should damage drone helper target', issues);
}

function testSpawnAndAuraSpecials(ctx, issues) {
  const spawned = [];
  const e5 = makeEnemy(ctx, 'E5', 0, 0, { _hatch: 1 });
  const e8 = makeEnemy(ctx, 'E8', 0, 0);
  const ally = makeEnemy(ctx, 'E1', 100, 0);
  const e14 = makeEnemy(ctx, 'E14', 0, 0);
  e14._summonTimers.forEach(timer => { timer.left = 1; });
  const scene = makeScene(ctx, { enemies: [e5, e8, ally, e14] });
  scene.spawnAt = (type, x, y, si, summoned) => {
    spawned.push({ type, x, y, si, summoned });
    return makeEnemy(ctx, type, x, y, { _summoned: summoned });
  };
  scene.updateEnemySpawnAndStatus(e5, ctx.EC.E5, 1);
  assert(spawned.some(s => s.type === 'E1' && s.summoned), 'E5 should hatch summoned E1 enemies over time', issues);
  scene.updateEnemyAura(e8, ctx.EC.E8, 2000);
  assert(ally._auraBoostT > 0 && e8._auraBoostT > 0, 'E8 aura should boost nearby enemies, including itself', issues);
  scene.updateEnemySpawnAndStatus(e14, ctx.EC.E14, 1);
  assert(spawned.some(s => s.type === 'E4' && s.summoned), 'E14 should summon E4 over time', issues);
  assert(spawned.some(s => s.type === 'E13' && s.summoned), 'E14 should summon E13 over time', issues);
}

function testFirstAttackDelay(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, 'E9', 40, 0);
  enemy._b1tgt = blocker;
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  const before = blocker._hp;
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E9, 649);
  assert(blocker._hp === before, 'enemy should not attack before the unified 0.65s first-attack delay', issues);
  scene.handleEnemyBlockerCombat(enemy, ctx.EC.E9, 1);
  assert(blocker._hp < before, 'enemy should attack exactly after reaching the unified 0.65s first-attack delay', issues);
}

function testCombatHoldDoesNotUseSeparationMove(issues) {
  const source = read('src/game/enemy-navigation.js');
  assert(/stopEnemyAndFace\(e,target\)\s*\{[\s\S]*?setVelocity\(0,0\)/.test(source), 'combat hold should directly zero enemy velocity', issues);
  assert(!/stopEnemyAndFace\(e,target\)\s*\{[\s\S]*?moveEnemy\(e,0,0,55\)/.test(source), 'combat hold should not call moveEnemy because separation can push melee enemies out of attack range', issues);
}

function testFriendlyHitFeedback(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0);
  const enemy = makeEnemy(ctx, 'E1', 40, 0);
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  let fx = 0;
  scene.playFriendlyHitEffect = () => { fx++; };
  const before = blocker._hp;
  scene.enemyHitBlocker(enemy, blocker);
  assert(blocker._hp < before, 'normal enemy hit should still reduce blocker HP', issues);
  assert(fx >= 1, 'normal enemy hit should trigger friendly hit feedback', issues);
}

function testShieldAbsorbFeedback(ctx, issues) {
  const blocker = makeBlocker(ctx, 'B1', 0, 0, 0, { _overShield: 100 });
  const enemy = makeEnemy(ctx, 'E1', 40, 0);
  const scene = makeScene(ctx, { blockers: [blocker], enemies: [enemy] });
  let fx = 0;
  scene.playFriendlyHitEffect = () => { fx++; };
  const beforeHp = blocker._hp;
  const dealt = scene.applyFriendlyDamage({ source: enemy, target: blocker, amount: 10, kind: 'melee' });
  assert(dealt === 0, 'full shield absorb should report zero HP damage', issues);
  assert(blocker._hp === beforeHp, 'full shield absorb should not reduce blocker HP', issues);
  assert(fx === 1, 'full shield absorb should still trigger friendly hit feedback', issues);
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testAllMeleeDamage(ctx, issues);
  testE3SplitterAttacksBeforeDeath(ctx, issues);
  testE3SplitOnDeath(ctx, issues);
  testE4Leech(ctx, issues);
  testE9MeleeSplash(ctx, issues);
  testE10SummonOnSecondHit(ctx, issues);
  testE11RangedDroneDamage(ctx, issues);
  testE11RangedFallbackTargets(ctx, issues);
  testE12RangedShell(ctx, issues);
  testE13SelfDestruct(ctx, issues);
  testReactorDamageAndGameOver(ctx, issues);
  testDroneMeleeAggroDamage(ctx, issues);
  testSpawnAndAuraSpecials(ctx, issues);
  testFirstAttackDelay(ctx, issues);
  testCombatHoldDoesNotUseSeparationMove(issues);
  testFriendlyHitFeedback(ctx, issues);
  testShieldAbsorbFeedback(ctx, issues);

  if (issues.length) {
    console.error(`enemy combat verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('enemy combat ok: E1-E14 attacks, damage, ranged hits, combat hold, hit feedback, self-destruct, split, summon, leech, aura and first-hit timing verified');
}

main();
