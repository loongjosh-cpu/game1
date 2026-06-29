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
        Distance: {
          Between(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
          }
        },
        Between(min, max) {
          return Math.floor((min + max) / 2);
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
    'src/game/combat-utils.js',
    'src/game/enemy-status.js',
    'src/game/enemy-structures.js',
    'src/game/projectile-controller.js',
    'src/game/tower-runtime.js',
    'src/game/tower-basic-attacks.js',
    'src/game/tower-special-attacks.js',
    'src/game/tower-healing.js'
  ]) {
    vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    this.__towerCombat = {
      PATH_TOWERS,
      BLOCK_TOWERS,
      DRONE_TOWERS,
      EC,
      CombatUtilMethods,
      EnemyStatusMethods,
      EnemyStructureMethods,
      ProjectileControllerMethods,
      TowerRuntimeMethods,
      TowerBasicAttackMethods,
      TowerSpecialAttackMethods,
      TowerHealingMethods
    };
  `, sandbox);
  return sandbox.__towerCombat;
}

function group(items) {
  return {
    items,
    add(item) {
      items.push(item);
    },
    children: {
      iterate(fn) {
        items.slice().forEach(fn);
      }
    }
  };
}

function chainable(extra = {}) {
  return {
    active: true,
    alpha: 1,
    setDepth() { return this; },
    setTint() { return this; },
    clearTint() { return this; },
    setScale() { return this; },
    setRotation() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setVisible() { return this; },
    setActive(value) { this.active = value; return this; },
    fillStyle() { return this; },
    fillCircle() { return this; },
    lineStyle() { return this; },
    strokeCircle() { return this; },
    lineBetween() { return this; },
    clear() { return this; },
    destroy() { this.active = false; },
    ...extra
  };
}

function tower(type, x, y, lv = 0, extra = {}) {
  const up = type.upg[lv];
  return {
    active: true,
    _type: type,
    _lv: lv,
    _at: extra.at ?? 999999,
    _metaShots: extra.metaShots ?? 0,
    _hp: extra.hp ?? up.hp ?? up.coreHp ?? 100,
    _maxhp: extra.maxhp ?? up.hp ?? up.coreHp ?? 100,
    x,
    y,
    setAlpha() { return this; },
    setTint() { return this; },
    clearTint() { return this; },
    destroy() { this.active = false; },
    ...extra
  };
}

function enemy(type, x, y, extra = {}) {
  return {
    active: true,
    _type: type,
    _hp: extra.hp ?? 100,
    _maxhp: extra.maxhp ?? 100,
    _spd: extra.spd ?? 100,
    _poisons: extra.poisons ? extra.poisons.map(p => ({ ...p })) : [],
    _slow: extra.slow ?? 0,
    _slowT: extra.slowT ?? 0,
    _frozenT: extra.frozenT ?? 0,
    _freezeCd: extra.freezeCd ?? 0,
    _freezeAmpT: extra.freezeAmpT ?? 0,
    x,
    y,
    body: { radius: 16, setVelocity() {} },
    destroy() { this.active = false; },
    ...extra
  };
}

function makeScene(ctx, enemies = [], blockers = [], drones = [], droneHelpers = []) {
  const bolts = [];
  const missiles = [];
  const p3Shells = [];
  const poisonBolts = [];
  const events = [];
  const scene = {
    ...ctx.CombatUtilMethods,
    ...ctx.EnemyStatusMethods,
    ...ctx.EnemyStructureMethods,
    ...ctx.ProjectileControllerMethods,
    ...ctx.TowerRuntimeMethods,
    ...ctx.TowerBasicAttackMethods,
    ...ctx.TowerSpecialAttackMethods,
    ...ctx.TowerHealingMethods,
    meta: {},
    enemies: group(enemies),
    blockers: group(blockers),
    drones: group(drones),
    droneHelpers: group(droneHelpers),
    bolts: group(bolts),
    missiles: group(missiles),
    p3Shells: group(p3Shells),
    poisonBolts: group(poisonBolts),
    reactors: [],
    _events: events,
    _killed: [],
    add: {
      graphics() {
        return chainable();
      },
      image(x, y) {
        return chainable({ x, y });
      }
    },
    physics: {
      add: {
        image(x, y) {
          return chainable({ x, y });
        },
        overlap(a, b, cb) {
          a._overlap = cb;
        }
      },
      moveToObject() {}
    },
    tweens: {
      add(config) {
        if (config && typeof config.onComplete === 'function') config.onComplete();
      }
    },
    time: {
      delayedCall(delay, callback) {
        events.push({ delay, callback, delayed: true });
      },
      addEvent(config) {
        events.push(config);
        return config;
      }
    },
    fxLine: { clear() {} },
    selectionGfx: { clear() {} },
    updTwPanel() {},
    updPanel() {},
    rejoinPath() {},
    destroyDrone(d) {
      d.active = false;
      d._destroyed = true;
    },
    killE(e) {
      e.active = false;
      this._killed.push(e);
    },
    gameOver() {},
    enemyIsPoisoned: ctx.CombatUtilMethods.enemyIsPoisoned
  };
  return scene;
}

function byId(list, id) {
  return list.find(item => item.id === id);
}

function testTowerRangeAndAttackGuards(ctx, issues) {
  const p6 = byId(ctx.PATH_TOWERS, 'P6');
  const b1 = byId(ctx.BLOCK_TOWERS, 'B1');
  const b7 = byId(ctx.BLOCK_TOWERS, 'B7');
  const scene = makeScene(ctx);
  scene.meta.p6Range = true;
  assert(scene.effectiveTowerRange(p6, p6.upg[2]) === 900, 'P6 range chip should add 200 to current upgrade range', issues);
  assert(scene.towerCannotAttack(b1, b1.upg[0]), 'B1 should never run offensive tower attack logic', issues);
  assert(scene.towerCannotAttack(b7, b7.upg[0]), 'B7 should not run normal attack logic', issues);
  assert(!scene.towerCannotAttack(p6, p6.upg[0]), 'P6 should be allowed to attack even with zero direct damage', issues);
}

function testP2Superchain(ctx, issues) {
  const p2 = byId(ctx.PATH_TOWERS, 'P2');
  const main = enemy('E1', 100, 0, { hp: 100 });
  const nearA = enemy('E1', 140, 0, { hp: 100 });
  const nearB = enemy('E1', 210, 0, { hp: 100 });
  const far = enemy('E1', 400, 0, { hp: 100 });
  const scene = makeScene(ctx, [main, nearA, nearB, far]);
  scene.meta.p2Superchain = true;
  scene.flashElectricChain = () => {};
  scene.fireElectricChain(tower(p2, 0, 0), [main], p2.upg[0]);
  assert(main._hp === 87.5, 'P2 superchain should deal 2.5x damage to main target', issues);
  assert(nearA._hp === 97 && nearB._hp === 97, 'P2 superchain branch targets should take 60% branch damage', issues);
  assert(far._hp === 100, 'P2 superchain should respect chain radius', issues);
}

function testB2SurgeAndP3Shell(ctx, issues) {
  const b2 = byId(ctx.BLOCK_TOWERS, 'B2');
  const e1 = enemy('E1', 500, 0, { hp: 20 });
  const e2 = enemy('E1', 1100, 0, { hp: 20 });
  const e3 = enemy('E1', 1300, 0, { hp: 20 });
  const scene = makeScene(ctx, [e1, e2, e3]);
  scene.meta.b2Surge = true;
  scene.runFlameTower(tower(b2, 0, 0, 0, { metaShots: 2 }), b2.upg[0]);
  assert(e1._hp === 17 && e2._hp === 17, 'B2 surge should hit all enemies within 1200 for 1.5x damage', issues);
  assert(e3._hp === 20, 'B2 surge should not hit enemies outside 1200', issues);

  const p3 = byId(ctx.PATH_TOWERS, 'P3');
  const shellScene = makeScene(ctx, [enemy('E1', 95, 0, { hp: 20 }), enemy('E1', 260, 0, { hp: 20 })]);
  shellScene.fireP3Shell(0, 0, { x: 100, y: 0, active: true }, 6, 150);
  shellScene.updateP3Shells(1000);
  assert(shellScene.enemies.items[0]._hp === 14, 'P3 shell should apply AOE damage when it reaches the target point', issues);
  assert(shellScene.enemies.items[1]._hp === 20, 'P3 shell should respect explosion radius', issues);
  assert(p3.splash === 150, 'P3 data should keep 150 AOE radius', issues);
}

function testP4Freeze(ctx, issues) {
  const p4 = byId(ctx.PATH_TOWERS, 'P4');
  const frozen = enemy('E1', 100, 0, { frozenT: 100 });
  const fresh = enemy('E1', 120, 0, { slowT: 1000 });
  const scene = makeScene(ctx, [frozen, fresh]);
  scene.meta.p4Freeze = true;
  const fired = [];
  scene.fireBolt = (x, y, target, dmg, effect) => fired.push({ target, dmg, effect });
  scene.runCondenseTower(p4, tower(p4, 0, 0), p4.upg[0], [frozen, fresh]);
  assert(fired[0].target === fresh, 'P4 freeze chip should prioritize enemies that are not currently frozen', issues);
  assert(fired.every(f => f.effect && f.effect.freeze), 'P4 freeze chip should pass freeze effect through its projectile', issues);

  const hitScene = makeScene(ctx, []);
  const target = enemy('E1', 50, 0, { hp: 20, slowT: 500, freezeCd: 0 });
  hitScene.fireBolt(0, 0, target, 1, { slow: 0.4, duration: 2000, freeze: true });
  const bolt = hitScene.bolts.items[0];
  bolt._overlap(bolt, target);
  assert(target._frozenT === 500 && target._freezeAmpT === 500 && target._freezeCd === 2000, 'P4 projectile hit should freeze slowed enemies for 0.5s with 2s cooldown', issues);
}

function testP7PoisonBurst(ctx, issues) {
  const p7 = byId(ctx.PATH_TOWERS, 'P7');
  const poisoned = enemy('E1', 100, 0, {
    hp: 100,
    poisons: [
      { left: 1000, tick: 500, dmg: 2 },
      { left: 500, tick: 500, dmg: 2 }
    ]
  });
  const scene = makeScene(ctx, [poisoned]);
  scene.meta.p7Burst = true;
  let fired = null;
  scene.fireBolt = (x, y, target, dmg) => { fired = { target, dmg }; };
  scene.runPoisonBetaTower(p7, tower(p7, 0, 0, 0, { metaShots: 0 }), p7.upg[0], [poisoned]);
  assert(fired && fired.dmg === 19, 'P7 burst should include base, poison bonus, remaining poison and layers*2 damage', issues);
  assert(poisoned._poisons.length === 1 && poisoned._poisons[0].left === 2000, 'P7 burst should consume old poison and add one fresh layer', issues);
}

function testPoisonRules(ctx, issues) {
  const scene = makeScene(ctx, []);
  scene.meta.poisonLong = true;
  scene.meta.poisonDamage = true;
  const e = enemy('E1', 0, 0, { hp: 20 });
  scene.applyPoison(e, 2);
  assert(e._poisons.length === 2, 'applyPoison should add requested layer count', issues);
  assert(e._poisons.every(p => p.left === 2500 && p.dmg === 3), 'poison chips should extend duration to 2.5s and tick damage to 3', issues);
  scene.updateEnemySpawnAndStatus(e, ctx.EC.E1, 500);
  assert(e._hp === 14, 'poison should tick every 0.5s once per active layer', issues);

  const speedScene = makeScene(ctx, []);
  speedScene.meta.poisonSlow = true;
  const moving = enemy('E1', 0, 0, { spd: 100, poisons: [{ left: 1000, tick: 500, dmg: 2 }] });
  assert(speedScene.updateEnemySpeed(moving, ctx.EC.E1, 0) === 90, 'poison slow chip should reduce poisoned enemy speed by 10%', issues);
}

function testB5HealingAndShield(ctx, issues) {
  const b5 = byId(ctx.BLOCK_TOWERS, 'B5');
  const b1 = byId(ctx.BLOCK_TOWERS, 'B1');
  const full = tower(b1, 100, 0, 0, { hp: 300, maxhp: 300, _overShield: 98 });
  const scene = makeScene(ctx, [], [full]);
  scene.meta.b5Overheal = true;
  scene.runHealTower(tower(b5, 0, 0, 0, { at: 1000 }), b5.upg[0], 700);
  assert(full._overShield === 100, 'B5 overheal chip should shield full-HP towers up to 100 cap', issues);

  const helper = { active: true, _hp: 4, _maxhp: 10, _owner: { _type: { id: 'D1' } }, x: 100, y: 0 };
  const droneScene = makeScene(ctx, [], [], [], [helper]);
  droneScene.meta.b5DroneHeal = true;
  droneScene.runHealTower(tower(b5, 0, 0, 0, { at: 1000 }), b5.upg[0], 700);
  assert(helper._hp === 7, 'B5 drone-heal chip should allow healing drone helpers inside range', issues);
}

function testFriendlyDamageModifiers(ctx, issues) {
  const b6 = byId(ctx.BLOCK_TOWERS, 'B6');
  const scene = makeScene(ctx, []);
  scene.meta.b6ToxicShell = true;
  const source = enemy('E1', 0, 0, { poisons: [{ left: 1000, tick: 500, dmg: 2 }] });
  const target = tower(b6, 0, 0, 0, { hp: 220, maxhp: 220 });
  const applied = scene.damageFriendly(target, 10, source);
  assert(applied === 7 && target._hp === 213, 'B6 toxic shell chip should reduce poisoned enemy damage by 30%', issues);

  const d1Core = { _type: { id: 'D1' } };
  const drone = { active: true, _owner: d1Core, _hp: 10, _maxhp: 10 };
  scene.meta.d1ReactiveArmor = true;
  const attacker = { active: true, _uid: 42 };
  scene.damageFriendly(drone, 10, attacker);
  scene.damageFriendly(drone, 10, attacker);
  assert(drone._hp === -4, 'D1 reactive armor should reduce only the first hit from each enemy by 60%', issues);
}

function testB7ExplosionAndB4Resonance(ctx, issues) {
  const b7 = byId(ctx.BLOCK_TOWERS, 'B7');
  const b4 = byId(ctx.BLOCK_TOWERS, 'B4');
  const e = enemy('E1', 100, 0, { hp: 100 });
  const scene = makeScene(ctx, [e]);
  scene.meta.b7Damage = true;
  scene.explodeB7(tower(b7, 0, 0));
  assert(e._hp === 25, 'B7 damage chip should raise explosion damage from 50 to 75', issues);

  const resonanceScene = makeScene(ctx, []);
  resonanceScene.meta.b4Resonance = true;
  resonanceScene.createB4Resonance(tower(b4, 0, 0, 1));
  assert(resonanceScene._events.length === 1, 'B4 resonance should register a delayed pulse event on destruction', issues);
  assert(resonanceScene._events[0].delay === 1000 && resonanceScene._events[0].repeat === 7, 'B4 resonance should create 8 one-second pulses', issues);
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testTowerRangeAndAttackGuards(ctx, issues);
  testP2Superchain(ctx, issues);
  testB2SurgeAndP3Shell(ctx, issues);
  testP4Freeze(ctx, issues);
  testP7PoisonBurst(ctx, issues);
  testPoisonRules(ctx, issues);
  testB5HealingAndShield(ctx, issues);
  testFriendlyDamageModifiers(ctx, issues);
  testB7ExplosionAndB4Resonance(ctx, issues);
  if (issues.length) {
    console.error(`tower combat verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('tower combat ok: attacks, DOT, healing, shields, projectiles and chip combat effects verified');
}

main();
