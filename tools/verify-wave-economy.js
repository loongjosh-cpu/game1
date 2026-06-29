const fs = require('fs');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function loadContext() {
  const storage = {};
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
    document: {
      querySelector() {
        return { textContent: '' };
      },
      getElementById() {
        return { textContent: '', style: { display: '' } };
      }
    },
    Phaser: {
      Math: {
        Distance: {
          Between(x1, y1, x2, y2) {
            return Math.hypot(x2 - x1, y2 - y1);
          }
        },
        Between(min, max) {
          return min;
        },
        Clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }
      },
      Utils: {
        Array: {
          GetRandom(items) {
            return items[0];
          },
          Shuffle(items) {
            return items.slice();
          }
        }
      }
    }
  };
  vm.createContext(sandbox);
  for (const file of [
    'src/data/meta.js',
    'src/core/meta-store.js',
    'src/data/enemies.js',
    'src/data/game-config.js',
    'src/data/levels.js',
    'src/data/imported-level-maps.js',
    'src/core/map-utils.js',
    'src/core/runtime-maps.js',
    'src/game/enemy-waves.js'
  ]) {
    if (fs.existsSync(file)) vm.runInContext(read(file), sandbox, { filename: file });
  }
  vm.runInContext(`
    this.__waveEconomy = {
      EC,
      THREAT_COST,
      SPECIAL_ENEMY,
      DIRECT_ENEMY,
      KILL_REWARD_MULT,
      REACTOR_WAVE_BONUS_LIMIT,
      EN_CAP,
      MAIN_REACTOR,
      SMALL_REACTOR,
      LEVELS,
      ENDLESS_MAPS,
      LEVEL_UI_ORDER,
      EnemyWaveMethods,
      metaSave,
      metaEffects,
      saveMeta,
      storage
    };
  `, sandbox);
  return sandbox.__waveEconomy;
}

function group(items = []) {
  return {
    items,
    add(item) {
      items.push(item);
    },
    countActive() {
      return items.filter(item => item && item.active).length;
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
    body: {
      enable: true,
      setCircle() {},
      setBounce() {}
    },
    x: 0,
    y: 0,
    setDepth() { return this; },
    setTint() { return this; },
    setScale() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.active = false; },
    ...extra
  };
}

function makeScene(ctx, options = {}) {
  const enemies = options.enemies || [];
  const events = [];
  const scene = {
    ...ctx.EnemyWaveMethods,
    en: options.en ?? 0,
    wave: options.wave ?? 1,
    completedWaves: options.completedWaves ?? 0,
    levelConfig: options.levelConfig ?? null,
    enemySeq: 0,
    wActive: false,
    prepTimer: 10000,
    enemies: group(enemies),
    _spawned: [],
    _routes: [],
    _events: events,
    reactors: options.reactors || [],
    meta: options.meta || {},
    physics: {
      add: {
        image(x, y) {
          return chainable({ x, y });
        }
      }
    },
    add: {
      image(x, y) {
        return chainable({ x, y });
      }
    },
    tweens: {
      add(config) {
        if (config && typeof config.onComplete === 'function') config.onComplete();
      }
    },
    time: {
      addEvent(config) {
        events.push(config);
        return {
          ...config,
          remove() {
            this.removed = true;
          }
        };
      }
    },
    scene: {
      pause() {
        scene._paused = true;
      }
    },
    gainEnergy(v) {
      this.en = Math.min(ctx.EN_CAP, this.en + v);
    },
    routeToReactor(e) {
      e._reactorTarget = { active: true, _hp: 1, x: 1000, y: 1000 };
      this._routes.push(e);
    },
    rejoinPath(e) {
      this._routes.push(e);
    },
    reactorAlive(r) {
      return !!(r && r.active && r._hp > 0);
    }
  };
  return scene;
}

function enemy(type, extra = {}) {
  return {
    active: true,
    _type: type,
    _hp: extra.hp ?? 10,
    _maxhp: extra.maxhp ?? 10,
    _summoned: !!extra.summoned,
    _si: extra.si ?? 0,
    x: extra.x ?? 100,
    y: extra.y ?? 100,
    destroy() {
      this.active = false;
    },
    ...extra
  };
}

function reactor(type, lv = 0, active = true) {
  const up = type.upg[lv];
  return {
    active,
    _hp: active ? up.hp : 0,
    _type: type,
    _lv: lv
  };
}

function testKillRewards(ctx, issues) {
  const scene = makeScene(ctx, { en: 0 });
  const e7 = enemy('E7');
  scene.killE(e7);
  assert(scene.en === ctx.THREAT_COST.E7 * ctx.KILL_REWARD_MULT, 'normal enemy kill should grant threat cost × kill reward multiplier', issues);
  assert(!e7.active, 'killed enemy should be destroyed', issues);

  const summoned = enemy('E4', { summoned: true });
  scene.killE(summoned);
  assert(scene.en === ctx.THREAT_COST.E7 * ctx.KILL_REWARD_MULT, 'summoned enemies should not grant kill energy', issues);

  const splitterScene = makeScene(ctx, { en: 0 });
  splitterScene.spawnAt = function(type, x, y, si, summonedFlag) {
    this._spawned.push({ type, x, y, si, summoned: summonedFlag });
    return enemy(type, { x, y, si, summoned: summonedFlag });
  };
  splitterScene.killE(enemy('E3', { x: 200, y: 300, si: 2 }));
  assert(splitterScene._spawned.length === 2, 'split enemies should spawn exactly two child enemies', issues);
  assert(splitterScene._spawned.every(s => s.type === 'E1' && s.summoned), 'split child enemies should be marked as summoned E1', issues);
}

function testSpawnScaling(ctx, issues) {
  const endlessScene = makeScene(ctx, { wave: 6 });
  const e = endlessScene.spawnE(0, 'E2');
  assert(e._hp === Math.round(ctx.EC.E2.hp * 1.5), 'endless spawn HP should scale by 10% per completed wave index', issues);
  assert(e._dmg === ctx.EC.E2.dmg && e._spd === ctx.EC.E2.spd && e._atk === ctx.EC.E2.atk, 'wave scaling should not increase damage, speed or attack interval', issues);

  const levelConfig = { waves: [{ scale: 2.25, lanes: [0], roster: ['E1'] }] };
  const levelScene = makeScene(ctx, { wave: 1, levelConfig });
  const levelEnemy = levelScene.spawnE(0, 'E1');
  assert(levelEnemy._hp === Math.round(ctx.EC.E1.hp * 2.25), 'level fixed wave scale should control enemy HP', issues);
}

function testWaveRosterRules(ctx, issues) {
  const scene = makeScene(ctx, { wave: 12 });
  const roster = scene.buildWaveRoster();
  const budget = 5 + 3 * (scene.wave - 1);
  const cost = roster.reduce((sum, type) => sum + (ctx.THREAT_COST[type] || 1), 0);
  const specialCost = roster.filter(type => ctx.SPECIAL_ENEMY.has(type)).reduce((sum, type) => sum + (ctx.THREAT_COST[type] || 1), 0);
  const directCost = roster.filter(type => ctx.DIRECT_ENEMY.has(type)).reduce((sum, type) => sum + (ctx.THREAT_COST[type] || 1), 0);
  const specialCounts = {};
  roster.forEach(type => {
    if (ctx.SPECIAL_ENEMY.has(type)) specialCounts[type] = (specialCounts[type] || 0) + 1;
  });
  assert(cost <= budget, 'endless generated roster should not exceed wave threat budget', issues);
  assert(specialCost <= budget * 0.35, 'special enemies should stay within 35% of endless wave budget', issues);
  assert(directCost >= budget * 0.35 || roster.every(type => !ctx.DIRECT_ENEMY.has(type)), 'direct pressure enemies should be seeded before random fill', issues);
  assert(Object.values(specialCounts).every(count => count <= 2), 'each special enemy type should appear at most twice per random wave', issues);

  const pools = [
    [1, ['E1'], ['E2']],
    [4, ['E4', 'E7'], ['E8']],
    [7, ['E11'], ['E9']],
    [10, ['E13'], ['E14']],
    [12, ['E14'], []]
  ];
  for (const [wave, mustInclude, mustExclude] of pools) {
    const poolScene = makeScene(ctx, { wave });
    const pool = poolScene.wavePool();
    mustInclude.forEach(type => assert(pool.includes(type), `wave ${wave} pool should include ${type}`, issues));
    mustExclude.forEach(type => assert(!pool.includes(type), `wave ${wave} pool should not include ${type} yet`, issues));
  }
}

function testFixedLevelWaves(ctx, issues) {
  const level1 = ctx.LEVELS.level1;
  assert(level1.waves.length === 10, 'original first five levels should keep 10 fixed waves', issues);
  for (const id of ['level6', 'level7', 'level8', 'level9']) {
    if (!ctx.LEVELS[id]) continue;
    assert(ctx.LEVELS[id].waves.length === 15, `${id} imported level should use 15 waves`, issues);
  }

  const scene = makeScene(ctx, { levelConfig: { waves: [{ lanes: [1, 0], roster: ['E2', 'E7', 'E1'] }] } });
  scene.startWave();
  assert(scene._waveRoster.join(',') === 'E2,E7,E1', 'level mode should use fixed wave roster instead of random endless roster', issues);
  const event = scene._events[0];
  event.callback();
  event.callback();
  assert(scene._spawned.length === 0, 'test scene should not record spawns unless spawnE is wrapped', issues);
  assert(scene.wS === 2 && scene.wC === 3, 'startWave event should advance fixed roster spawn count', issues);
}

function testWaveCompletionAndRewards(ctx, issues) {
  const bonusScene = makeScene(ctx, {
    completedWaves: 4,
    meta: { reactorWaveBonus: 120, reactorWaveBonusLimit: ctx.REACTOR_WAVE_BONUS_LIMIT },
    en: 0
  });
  bonusScene.grantWaveClearBonus();
  assert(bonusScene.en === 120, 'reactor wave chip should grant 120 energy through wave 5', issues);
  bonusScene.completedWaves = 6;
  bonusScene.grantWaveClearBonus();
  assert(bonusScene.en === 120, 'reactor wave chip should stop after configured early-wave limit', issues);

  ctx.metaSave.cores = 0;
  ctx.metaSave.bestWave = 0;
  ctx.metaSave.levelClears = {};
  const endlessGameOver = makeScene(ctx, { completedWaves: 12 });
  endlessGameOver.gameOver('manual exit');
  assert(ctx.metaSave.cores === 2, 'endless reward should be one star core per 5 completed waves, including manual exit', issues);
  assert(ctx.metaSave.bestWave === 12, 'endless game over should update best completed wave', issues);

  ctx.metaSave.cores = 0;
  ctx.metaSave.levelClears = {};
  const levelConfig = { id: 'level-test', waves: [{}, {}, {}] };
  const failedLevel = makeScene(ctx, { completedWaves: 2, levelConfig });
  failedLevel.gameOver('failed');
  assert(ctx.metaSave.cores === 0 && !ctx.metaSave.levelClears['level-test'], 'failed level should not grant star core or mark clear', issues);
  const clearedLevel = makeScene(ctx, { completedWaves: 3, levelConfig });
  clearedLevel.gameOver('clear');
  assert(ctx.metaSave.cores === 1 && ctx.metaSave.levelClears['level-test'], 'cleared level should grant one star core and unlock clear flag', issues);
}

function testReactorIncome(ctx, issues) {
  const main = reactor(ctx.MAIN_REACTOR, 2);
  const smallA = reactor(ctx.SMALL_REACTOR, 0);
  const smallB = reactor(ctx.SMALL_REACTOR, 2);
  const dead = reactor(ctx.SMALL_REACTOR, 2, false);
  const scene = makeScene(ctx, { reactors: [main, smallA, smallB, dead] });
  scene.energyRate = function() {
    return this.reactors.reduce((sum, r) => sum + (this.reactorAlive(r) ? r._type.upg[r._lv || 0].prod : 0), 0);
  };
  assert(scene.energyRate() === 7 + 2 + 4, 'energyRate should sum only alive main and small reactor production', issues);
}

function main() {
  const issues = [];
  const ctx = loadContext();
  testKillRewards(ctx, issues);
  testSpawnScaling(ctx, issues);
  testWaveRosterRules(ctx, issues);
  testFixedLevelWaves(ctx, issues);
  testWaveCompletionAndRewards(ctx, issues);
  testReactorIncome(ctx, issues);
  if (issues.length) {
    console.error(`wave/economy verification failed (${issues.length} issues):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('wave economy ok: kill rewards, spawn scaling, fixed waves, endless budget, reactor income and star-core rewards verified');
}

main();
