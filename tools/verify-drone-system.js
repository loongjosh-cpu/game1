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
    Map,
    Phaser: {
      Math: {
        Distance: {
          Between(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
          }
        },
        Between(min, max) {
          return Math.floor((min + max) / 2);
        },
        Clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }
      }
    },
    MAP: {
      unitScale: 1,
      worldSize: { w: 2000, h: 1200 },
      walls: [[480, 480, 160, 160]],
      reactor: { x: 1000, y: 600 },
      spawns: [[100, 100]]
    }
  };
  vm.createContext(sandbox);
  for (const file of [
    'src/data/towers.js',
    'src/data/enemies.js',
    'src/data/game-config.js',
    'src/core/map-utils.js',
    'src/core/pathfinding.js',
    'src/game/combat-utils.js',
    'src/game/enemy-structures.js',
    'src/game/drone-controller.js'
  ]) {
    vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    this.__droneSystem = {
      DRONE_TOWERS,
      EC,
      CELL,
      CLOSE_ATTACK_RANGE,
      DRONE_CHASE_SPEED,
      DRONE_CHASE_LIMIT,
      DRONE_STUCK_LIMIT,
      CombatUtilMethods,
      EnemyStructureMethods,
      DroneControllerMethods
    };
  `, sandbox);
  return sandbox.__droneSystem;
}

function group(items = []) {
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
    width: 20,
    height: 20,
    x: 0,
    y: 0,
    body: {
      speed: 0,
      radius: 8,
      setCircle() {},
      setVelocity(x, y) {
        this.vx = x;
        this.vy = y;
        this.speed = Math.hypot(x, y);
      }
    },
    setDepth() { return this; },
    setTint(value) { this._tint = value; return this; },
    setScale() { return this; },
    setRotation(value) { this.rotation = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.active = false; },
    ...extra
  };
}

function byId(list, id) {
  return list.find(item => item.id === id);
}

function core(type, x, y, lv = 0, extra = {}) {
  const up = type.upg[lv];
  return {
    active: true,
    _type: type,
    _lv: lv,
    _hp: up.coreHp,
    _maxhp: up.coreHp,
    _droneClock: 0,
    _energySpend: true,
    x,
    y,
    destroy() { this.active = false; },
    ...extra
  };
}

function drone(owner, x, y, extra = {}) {
  return chainable({
    _owner: owner,
    _target: null,
    _engaged: false,
    _hp: extra.hp ?? owner._type.upg[owner._lv || 0].hp,
    _maxhp: extra.maxhp ?? owner._type.upg[owner._lv || 0].hp,
    _at: 99999,
    _iv: owner._type.upg[owner._lv || 0].i || 1000,
    _dmg: owner._type.upg[owner._lv || 0].d || 0,
    _retargetT: 0,
    _first: null,
    _lastTargetDist: Infinity,
    _chaseT: 0,
    _avoidT: 0,
    _avoidUid: null,
    _lastX: x,
    _lastY: y,
    _stuckT: 0,
    x,
    y,
    ...extra
  });
}

function enemy(type, x, y, extra = {}) {
  return {
    active: true,
    _type: type,
    _uid: extra.uid ?? Math.floor(Math.random() * 100000),
    _hp: extra.hp ?? 100,
    _maxhp: extra.maxhp ?? 100,
    _droneTarget: null,
    _b1tgt: null,
    _state: 'path',
    _at: 0,
    _firstAttack: false,
    x,
    y,
    body: { radius: 16, setVelocity() {} },
    destroy() { this.active = false; },
    ...extra
  };
}

function blocker(type, x, y, extra = {}) {
  const up = type.upg[0];
  return {
    active: true,
    _type: type,
    _lv: 0,
    _hp: extra.hp ?? up.hp,
    _maxhp: extra.maxhp ?? up.hp,
    x,
    y,
    ...extra
  };
}

function makeScene(ctx, { enemies = [], cores = [], helpers = [], blockers = [] } = {}) {
  const events = [];
  const scene = {
    ...ctx.CombatUtilMethods,
    ...ctx.EnemyStructureMethods,
    ...ctx.DroneControllerMethods,
    meta: {},
    en: 100,
    enemies: group(enemies),
    drones: group(cores),
    droneHelpers: group(helpers),
    blockers: group(blockers),
    towers: group([]),
    reactors: [],
    gridPF: Array.from({ length: 15 }, () => Array.from({ length: 25 }, () => 0)),
    _spawned: 0,
    _routes: [],
    _rejoined: 0,
    _damageLog: [],
    _events: events,
    add: {
      image(x, y) {
        return chainable({ x, y });
      },
      graphics() {
        return chainable();
      }
    },
    physics: {
      add: {
        image(x, y) {
          return chainable({ x, y });
        }
      },
      moveTo(target, x, y, speed) {
        const dx = x - target.x;
        const dy = y - target.y;
        const dist = Math.hypot(dx, dy) || 1;
        target.body.setVelocity(dx / dist * speed, dy / dist * speed);
      }
    },
    tweens: {
      add(config) {
        if (config && typeof config.onComplete === 'function') config.onComplete();
      }
    },
    time: {
      delayedCall(delay, callback) {
        events.push({ delay, callback });
      },
      addEvent(config) {
        events.push(config);
        return config;
      }
    },
    flashArea() {},
    findTargets(x, y, r) {
      return enemies.filter(e => e.active && Math.hypot(e.x - x, e.y - y) <= r);
    },
    damageEnemy(e, amount) {
      e._hp -= amount;
      this._damageLog.push({ e, amount });
      if (e._hp <= 0) e.active = false;
    },
    makeRoute(x1, y1, x2, y2) {
      return [[x1, y1], [x2, y2]];
    },
    setRoute(e, route) {
      e._route = route;
      e._routeI = Math.min(1, route.length - 1);
      this._routes.push({ e, route });
    },
    rejoinPath() {
      this._rejoined++;
    },
    healBlocker(target, amount) {
      const before = target._wreck ? (target._repair || 0) : target._hp;
      if (target._wreck) {
        target._repair = Math.min(200, before + amount);
        return target._repair - before;
      }
      target._hp = Math.min(target._maxhp, target._hp + amount);
      return target._hp - before;
    },
    enemyIsPoisoned: ctx.CombatUtilMethods.enemyIsPoisoned
  };
  return scene;
}

function testDroneProductionAndEnergyGate(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const c = core(d1, 200, 200, 0, { _droneClock: d1.upg[0].prod - 1 });
  const helpers = Array.from({ length: 12 }, (_, i) => drone(c, 210 + i, 200));
  const scene = makeScene(ctx, { cores: [c], helpers });
  scene.en = 10;
  scene.updateDroneCores(1);
  assert(scene.droneHelpers.items.length === 13, 'D1 should produce up to its Lv1 cap of 13 drones', issues);
  assert(scene.en === 8, 'drone replacement should consume droneCost energy on successful spawn', issues);

  c._droneClock = d1.upg[0].prod;
  scene.updateDroneCores(16);
  assert(scene.droneHelpers.items.length === 13 && scene.en === 8, 'drone core at cap should not spend energy', issues);

  const blocked = core(d1, 400, 200, 0, { _droneClock: d1.upg[0].prod, _energySpend: false });
  const scene2 = makeScene(ctx, { cores: [blocked] });
  scene2.en = 10;
  scene2.updateDroneCores(1000);
  assert(scene2.droneHelpers.items.length === 0 && scene2.en === 10, 'manual energy toggle off should block replenishment and spending', issues);
}

function testTargetDistributionAndEngagementStickiness(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const c = core(d1, 0, 0);
  const e1 = enemy('E2', 100, 0, { uid: 1 });
  const e2 = enemy('E2', 110, 0, { uid: 2 });
  const busy = drone(c, 0, 0, { _target: e1 });
  const free = drone(c, 0, 0);
  const scene = makeScene(ctx, { enemies: [e1, e2], cores: [c], helpers: [busy, free] });
  assert(scene.chooseDroneTarget(free, c, 700) === e2, 'free drones should avoid over-stacking on a target already covered by another drone', issues);

  free._target = e1;
  free._engaged = true;
  free._retargetT = -1;
  free._first = null;
  free.x = 45;
  free.y = 0;
  scene.updateCombatDrone(free, c, d1, 700, 100);
  assert(free._target === e1, 'engaged combat drones should not retarget just because retarget timer expires', issues);

  free._engaged = false;
  free._retargetT = -1;
  free._target = e1;
  scene.updateCombatDrone(free, c, d1, 700, 100);
  assert(free._target === e2, 'non-engaged drones may retarget to improve target distribution', issues);
}

function testChaseCanLeaveCoreRangeAndDropOnFailure(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const c = core(d1, 0, 0);
  const target = enemy('E7', 900, 0, { uid: 7 });
  const h = drone(c, 650, 0, { _target: target, _engaged: false });
  const scene = makeScene(ctx, { enemies: [target], cores: [c], helpers: [h] });
  scene.runDroneCombat(h, target, 100);
  assert(h._target === target && h.body.speed > 0, 'combat drone should keep chasing an already selected target outside core range', issues);

  h._lastTargetDist = 10;
  h._chaseT = ctx.DRONE_CHASE_LIMIT - 1;
  h._moveFailT = 0;
  scene.chaseDroneTarget(h, target, 16);
  assert(h._target === null && h._avoidUid === target._uid, 'drone should drop unreachable target after chase timeout and temporarily avoid it', issues);
}

function testStuckRecoveryAndWallValidation(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const c = core(d1, 100, 100);
  const target = enemy('E1', 200, 100, { uid: 11 });
  const h = drone(c, 100, 100, {
    _target: target,
    _engaged: false,
    _lastX: 100,
    _lastY: 100
  });
  h.body.speed = 100;
  const scene = makeScene(ctx, { enemies: [target], cores: [c], helpers: [h] });
  assert(scene.navPointOpen(80, 80), 'open nav grid cells should be valid for drone navigation', issues);
  scene.gridPF[1][1] = 1;
  assert(!scene.navPointOpen(120, 120), 'blocked nav grid cells should not be valid for drone navigation', issues);
  assert(!scene.validDronePoint(500, 500, 2000, 1200), 'drone patrol/spawn points should reject wall-adjacent or blocked wall positions', issues);

  scene.droneStuck(h, ctx.DRONE_STUCK_LIMIT);
  assert(h._target === null && h._avoidUid === target._uid, 'stuck chasing drone should clear target and remember avoid uid', issues);
}

function testDroneAggroAndRelease(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const c = core(d1, 0, 0);
  const h1 = drone(c, 50, 0);
  const h2 = drone(c, 60, 0);
  const e = enemy('E1', 0, 0);
  const scene = makeScene(ctx, { enemies: [e], cores: [c], helpers: [h1, h2] });
  scene.aggroDrone(e, h1);
  assert(e._droneTarget === h1 && e._state === 'drone' && e._firstAttack, 'drone attack should pull enemy aggro onto that drone', issues);
  scene.aggroDrone(e, h2);
  assert(e._droneTarget === h1, 'enemy should keep current live drone aggro instead of bouncing between drones', issues);

  h2._target = e;
  scene.destroyDrone(h1);
  assert(e._droneTarget === h2, 'when an aggroed drone dies, enemy should transfer to another attacking drone when available', issues);
}

function testD1AndD2ChipEffects(ctx, issues) {
  const d1 = byId(ctx.DRONE_TOWERS, 'D1');
  const d2 = byId(ctx.DRONE_TOWERS, 'D2');
  const c1 = core(d1, 0, 0);
  const blastTarget = enemy('E1', 30, 0, { hp: 50 });
  const deathDrone = drone(c1, 0, 0, { hp: 1 });
  const scene = makeScene(ctx, { enemies: [blastTarget], cores: [c1], helpers: [deathDrone] });
  scene.meta.d1DeathBlast = true;
  scene.destroyDrone(deathDrone);
  assert(blastTarget._hp === 30, 'D1 death blast chip should deal 20 damage in 80 range', issues);

  const c2 = core(d2, 300, 300);
  const revived = drone(c2, 350, 300, { hp: 1, maxhp: 25 });
  const reviveScene = makeScene(ctx, { cores: [c2], helpers: [revived] });
  reviveScene.meta.d2Revive = true;
  reviveScene.destroyDrone(revived);
  assert(revived.active && revived._revived && revived._decayHp && revived._noHeal, 'D2 revive chip should keep drone active, mark one-time revive, decay and no-heal flags', issues);
  assert(revived.x === c2.x && revived.y === c2.y && revived._hp === revived._maxhp, 'D2 revived drone should return to core at full HP', issues);

  revived._hp = 0.2;
  reviveScene.refreshDroneRuntime(revived, d2, d2.upg[0], 500);
  assert(!revived.active, 'revived D2 drone should die permanently when decay drains HP', issues);
}

function testD3RepairRules(ctx, issues) {
  const d3 = byId(ctx.DRONE_TOWERS, 'D3');
  const c = core(d3, 0, 0);
  const dummyEnemy = enemy('E1', 30, 0, { hp: 50 });
  const repairer = drone(c, 0, 0, { hp: 10, maxhp: 45 });
  const towerType = { id: 'B1', type: 'block', upg: [{ hp: 300, r: 800, danger: 2 }], danger: 2 };
  const hurt = blocker(towerType, 40, 0, { hp: 100, maxhp: 300 });
  const scene = makeScene(ctx, { enemies: [dummyEnemy], cores: [c], helpers: [repairer], blockers: [hurt] });
  scene.updateDroneHelper(repairer, 1000);
  assert(dummyEnemy._hp === 50, 'D3 repair drones should not attack enemies even when enemies are nearby', issues);
  assert(hurt._hp === 102 && repairer._hp === 8, 'D3 repair should heal blocker and consume equal repairer HP', issues);

  scene.meta.d3Retreat = true;
  repairer._hp = 8; // below 20% of 45
  repairer.x = 200;
  repairer.y = 0;
  scene.updateRepairDrone(repairer, c, d3.upg[0], 550, 100);
  assert(repairer._forcedReturn && repairer.body.speed > 0, 'D3 retreat chip should force low-HP repair drone to return to core', issues);
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testDroneProductionAndEnergyGate(ctx, issues);
  testTargetDistributionAndEngagementStickiness(ctx, issues);
  testChaseCanLeaveCoreRangeAndDropOnFailure(ctx, issues);
  testStuckRecoveryAndWallValidation(ctx, issues);
  testDroneAggroAndRelease(ctx, issues);
  testD1AndD2ChipEffects(ctx, issues);
  testD3RepairRules(ctx, issues);
  if (issues.length) {
    console.error(`drone system verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('drone system ok: production, targeting, chase, stuck recovery, aggro, revive, death blast and D3 repair verified');
}

main();
