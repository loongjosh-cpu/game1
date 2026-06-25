const EnemyControllerMethods={
  closestPathPt(path,x,y){let bt=0,bd=Infinity;for(let t=0;t<=1;t+=0.01){const pt=path.getPoint(t);const d=Phaser.Math.Distance.Between(x,y,pt.x,pt.y);if(d<bd){bd=d;bt=t}}return{t:bt,dist:bd}},
  makeRoute(x1,y1,x2,y2){return [[x1,y1],...astar(this.gridPF,x1,y1,x2,y2)]},
  setRoute(e,route){e._route=route;e._routeI=Math.min(1,route.length-1)},
  reactorAlive(r){return !!(r&&r.active&&r._hp>0)},
  chooseReactor(e){let best=null,bestDist=Infinity;for(const r of this.reactors){if(!this.reactorAlive(r))continue;const d=Phaser.Math.Distance.Between(e.x,e.y,r.x,r.y);if(d<bestDist){best=r;bestDist=d}}return best},
  routeToReactor(e,keepCurrent=true){const current=keepCurrent&&this.reactorAlive(e._reactorTarget)?e._reactorTarget:null,target=current||this.chooseReactor(e);e._reactorTarget=target;e._state='path';if(target)this.setRoute(e,this.makeRoute(e.x,e.y,target.x,target.y));else this.setRoute(e,[[e.x,e.y]])},
  rejoinPath(e){e._b1tgt=null;e._reactorTarget=null;e._state='path';e._at=0;e._firstAttack=true;this.routeToReactor(e,false)},
  destroyReactor(r){if(!r||!r.active||r._isMainReactor)return;if(this.selTw===r){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}if(r._label)r._label.destroy();r.destroy();this.enemies.children.iterate(e=>{if(e&&e.active&&e._reactorTarget===r)this.rejoinPath(e)});this.updPanel()},
  towerDanger(tw){if(tw._wreck&&tw._type.id==='B1')return (tw._lv||0)===0?3:2;const up=tw._type.upg[tw._lv||0];return up.danger??tw._type.danger??0},
  considerEnemyBuildingTarget(e,cfg,tw,state){
    if(!tw||!tw.active||tw._hp<=0)return state;
    const danger=this.towerDanger(tw),d=Phaser.Math.Distance.Between(e.x,e.y,tw.x,tw.y),range=sd(tw._type.upg[tw._lv||0].r||tw._type.range);
    if(cfg.danger>danger||d>range)return state;
    if(danger>state.bestDanger||(danger===state.bestDanger&&!state.held&&d<state.bestDist)){
      state.best=tw;
      state.bestDanger=danger;
      state.bestDist=d
    }
    return state
  },
  chooseBlocker(e){
    const cfg=EC[e._type],held=e._b1tgt&&e._b1tgt.active&&e._b1tgt._hp>0?e._b1tgt:null;
    const state={best:held,bestDanger:held?this.towerDanger(held):-1,bestDist:held?Phaser.Math.Distance.Between(e.x,e.y,held.x,held.y):Infinity,held};
    this.blockers.children.iterate(tw=>this.considerEnemyBuildingTarget(e,cfg,tw,state));
    this.drones.children.iterate(tw=>this.considerEnemyBuildingTarget(e,cfg,tw,state));
    return state.best
  },
  destroyB1(b1){
    if(b1._type?.type==='drone'){
      this.destroyDroneCore(b1);
      return
    }
    const isSteel=b1._type.id==='B1';if(b1._type.id==='B7'){this.findTargets(b1.x,b1.y,sd(b1._type.range)).forEach(e=>this.damageEnemy(e,b1._type.boom||50))}if(isSteel&&!b1._wreck){b1._hp=200;b1._maxhp=200;b1._repair=0;b1._wreck=true;b1.setAlpha(0.4);b1.setTint(0x666666);this.time.delayedCall(20000,()=>{if(b1.active&&b1._wreck)this.reviveSteel(b1)})}else{if(this.selTw===b1){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}if(b1._rngGfx)b1._rngGfx.destroy();b1.destroy()}this.enemies.children.iterate(e=>{if(e&&e.active&&e._b1tgt===b1)this.rejoinPath(e)})},
  destroyDroneCore(core){
    if(!core||!core.active)return;
    this.droneHelpers.children.iterate(d=>{if(d&&d.active&&d._owner===core)this.destroyDrone(d)});
    if(this.selTw===core){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}
    if(core._rngGfx)core._rngGfx.destroy();
    core.destroy();
    this.enemies.children.iterate(e=>{if(e&&e.active&&e._b1tgt===core)this.rejoinPath(e)});
    this.updPanel()
  },
  reviveSteel(b1){if(!b1?.active)return;b1.clearTint();b1.setAlpha(1);b1._wreck=false;const up=b1._type.upg[b1._lv||0];b1._maxhp=up.hp;b1._hp=up.hp},
  healBlocker(tw,amount){if(!tw?.active||amount<=0)return 0;if(tw._wreck){if(!this.meta.b1Repair)return 0;const before=tw._repair||0;tw._repair=Math.min(200,before+amount);const applied=tw._repair-before;if(tw._repair>=200)this.reviveSteel(tw);return applied}const before=tw._hp;tw._hp=Math.min(tw._maxhp,tw._hp+amount);return tw._hp-before},
  killShip(){if(this.shipDead)return;this.cancelChannel();this.shipDead=true;this.shipMoveTarget=null;this.ship.setActive(false).setVisible(false);this.ship.body.enable=false;this.bld=false;this.ghost.setVisible(false);this.time.delayedCall(SHIP_RESPAWN,()=>{this.ship.setPosition(MAP.reactor.x,MAP.reactor.y);this.ship.body.enable=true;this.ship.setActive(true).setVisible(true);this.shipDead=false})},
  updateEnemies(dt){
    this.enemies.children.iterate(e=>this.updateEnemy(e,dt))
  },
  updateEnemy(e,dt){
    if(!e||!e.active)return;
    const cfg=EC[e._type];
    if(!this.updateEnemySpawnAndStatus(e,cfg,dt))return;
    this.updateEnemyTargetScan(e,cfg,dt);
    const speed=this.updateEnemySpeed(e,cfg,dt);
    if(this.handleEnemyDroneCombat(e,cfg,dt))return;
    if(this.handleEnemyBlockerCombat(e,cfg,dt))return;
    if(this.handleEnemyReactorCombat(e,cfg,dt))return;
    this.advanceEnemyRoute(e,speed)
  },
  updateEnemySpawnAndStatus(e,cfg,dt){
    if(cfg.hatch){
      e._hatch-=dt;
      if(e._hatch<=0){
        e._hatch+=cfg.hatch;
        this.spawnAt(
          'E1',
          e.x+Phaser.Math.Between(-25,25),
          e.y+Phaser.Math.Between(-25,25),
          e._si,
          true
        )
      }
    }
    if(e._poisons?.length){
      for(const p of e._poisons){
        p.left-=dt;
        p.tick-=dt;
        if(p.tick<=0){
          p.tick+=500;
          this.damageEnemy(e,2);
          if(!e.active)return false
        }
      }
      e._poisons=e._poisons.filter(p=>p.left>0)
    }
    e._slowT=Math.max(0,(e._slowT||0)-dt);
    if(!e._slowT)e._slow=0;
    return true
  },
  getEnemyDroneTarget(e){
    const target=e._droneTarget;
    return target&&target.active&&target._hp>0?target:null
  },
  updateEnemyTargetScan(e,cfg,dt){
    e._scan=(e._scan||0)-dt;
    const droneTarget=this.getEnemyDroneTarget(e);
    if(!droneTarget&&e._droneTarget)e._droneTarget=null;
    if(e._scan>0)return;

    e._scan=200;
    if(droneTarget&&!cfg.droneRange){
      this.setRoute(e,this.makeRoute(e.x,e.y,droneTarget.x,droneTarget.y));
      return
    }
    const next=this.chooseBlocker(e);
    if(next===e._b1tgt)return;
    e._b1tgt=next;
    e._at=0;
    e._firstAttack=true;
    if(next){
      e._state='tower';
      this.setRoute(e,this.makeRoute(e.x,e.y,next.x,next.y))
    }else{
      this.rejoinPath(e)
    }
  },
  updateEnemySpeed(e,cfg,dt){
    this.updateEnemyAura(e,cfg,dt);
    e._auraBoostT=Math.max(0,(e._auraBoostT||0)-dt);
    const aura=e._auraBoostT>0?1.2:1;
    let speed=sd(e._spd)*aura*(e._slow?1-e._slow:1);
    if(cfg.burst){
      e._bt=(e._bt||0)+dt;
      const phase=e._bt%(cfg.burstCycle||4000);
      if(phase<(cfg.burstDuration||1000)){
        speed=sd(cfg.burstSpeed||400)*aura*(e._slow?1-e._slow:1)
      }
    }
    return speed
  },
  updateEnemyAura(e,cfg,dt){
    if(!cfg.auraPulse)return;
    e._auraCd=(e._auraCd||0)-dt;
    if(e._auraCd>0)return;

    e._auraCd=cfg.auraEvery||2000;
    this.enemies.children.iterate(a=>{
      if(!a||!a.active)return;
      const dist=Phaser.Math.Distance.Between(e.x,e.y,a.x,a.y);
      if(dist<=sd(cfg.auraPulse)){
        a._auraBoostT=Math.max(a._auraBoostT||0,cfg.auraDur||3000)
      }
    });
    this.flashArea(e.x,e.y,sd(cfg.auraPulse),cfg.color||0x44ddaa)
  },
  handleEnemyDroneCombat(e,cfg,dt){
    if(cfg.droneRange){
      const target=this.chooseDroneInRange(e,sd(cfg.droneRange));
      if(target&&this.enemyAttackReady(e,dt)){
        this.fireEnemyDart(e,target,cfg.shotSpeed||700,e._dmg)
      }
      return false
    }

    const droneTarget=this.getEnemyDroneTarget(e);
    if(!droneTarget)return false;
    const dist=Phaser.Math.Distance.Between(e.x,e.y,droneTarget.x,droneTarget.y);
    if(dist<=sd(CLOSE_ATTACK_RANGE)){
      this.stopEnemyAndFace(e,droneTarget);
      if(this.enemyAttackReady(e,dt)){
        this.damageDrone(droneTarget,e._dmg);
        this.enemyAttackEffect(e,droneTarget)
      }
      return true
    }
    if(!e._route||e._routeI>=e._route.length){
      this.setRoute(e,this.makeRoute(e.x,e.y,droneTarget.x,droneTarget.y))
    }
    return false
  },
  handleEnemyBlockerCombat(e,cfg,dt){
    const target=e._b1tgt&&e._b1tgt.active&&e._b1tgt._hp>0?e._b1tgt:null;
    if(!target)return false;

    const stop=Math.max(sd(CLOSE_ATTACK_RANGE),24+(target._type.tSize||45)/2);
    const dist=Phaser.Math.Distance.Between(e.x,e.y,target.x,target.y);
    if(cfg.rangeAtk&&dist<=sd(cfg.rangeAtk)){
      this.stopEnemyAndFace(e,target);
      if(this.enemyAttackReady(e,dt))this.fireEnemyShell(e,target);
      return true
    }
    if(dist>stop)return false;

    this.stopEnemyAndFace(e,target);
    if(this.enemyAttackReady(e,dt))this.enemyHitBlocker(e,target);
    return true
  },
  enemyHitBlocker(e,target){
    let incoming=e._dmg;
    if(target._type.id==='B4'&&this.meta.b4Shield&&(target._shield||0)>0){
      target._shield--;
      incoming=Math.min(10,incoming);
      this.flashArea(target.x,target.y,sd(55),0xaaddff)
    }
    target._hp-=incoming;
    this.enemyAttackEffect(e,target);
    if(target._type.id==='B4'&&target.active){
      this.areaAttack(target,target._type.upg[target._lv||0],0x66ccff)
    }
    if(target._hp<=0)this.destroyB1(target)
  },
  handleEnemyReactorCombat(e,cfg,dt){
    let reactor=this.reactorAlive(e._reactorTarget)?e._reactorTarget:null;
    if(!reactor){
      this.routeToReactor(e,false);
      reactor=e._reactorTarget
    }
    if(!reactor){
      this.moveEnemy(e,0,0,55);
      return true
    }
    if(cfg.rangeAtk&&Phaser.Math.Distance.Between(e.x,e.y,reactor.x,reactor.y)<=sd(cfg.rangeAtk)){
      this.stopEnemyAndFace(e,reactor);
      if(this.enemyAttackReady(e,dt))this.fireEnemyShell(e,reactor);
      return true
    }
    if(e._route&&e._routeI<e._route.length)return false;

    const dist=Phaser.Math.Distance.Between(e.x,e.y,reactor.x,reactor.y);
    const stop=reactor._size/2+20;
    if(dist<stop){
      this.moveEnemy(e,0,0,55);
      if(this.enemyAttackReady(e,dt))this.enemyHitReactor(e,reactor);
      return true
    }
    this.routeToReactor(e,true);
    return false
  },
  enemyHitReactor(e,reactor){
    reactor._hp=Math.max(0,reactor._hp-e._dmg);
    if(reactor._isMainReactor)this.rxHP=reactor._hp;
    this.enemyAttackEffect(e,reactor);
    this.tweens.add({targets:reactor,alpha:0.5,duration:100,yoyo:true});
    if(reactor._hp>0)return;
    if(reactor._isMainReactor)this.gameOver();
    else this.destroyReactor(reactor)
  },
  stopEnemyAndFace(e,target){
    this.moveEnemy(e,0,0,55);
    e.setRotation(Math.atan2(target.y-e.y,target.x-e.x)+Math.PI/2)
  },
  advanceEnemyRoute(e,speed){
    if(!e._route||e._routeI>=e._route.length)return;
    const wp=e._route[e._routeI],dx=wp[0]-e.x,dy=wp[1]-e.y,dist=Math.hypot(dx,dy);
    if(dist<12){
      e._routeI++;
      e.body.setVelocity(0,0);
      return
    }
    this.moveEnemy(e,dx,dy,speed);
    e.setRotation(Math.atan2(dy,dx)+Math.PI/2)
  },
  spawnAt(type,x,y,si=0,summoned=false){const e=this.spawnE(si,type);e.setPosition(x,y);e._summoned=summoned;this.rejoinPath(e);return e},
  killE(e){if(!e||!e.active)return;const cfg=EC[e._type],x=e.x,y=e.y,si=e._si,summoned=e._summoned;if(!summoned)this.gainEnergy(cfg.danger);const ex=this.add.image(x,y,'msl').setDepth(9).setTint(cfg.color||0xff8844).setScale(3);this.tweens.add({targets:ex,alpha:0,scaleX:6,scaleY:6,duration:200,onComplete:()=>ex.destroy()});e.destroy();if(cfg.split){this.spawnAt('E1',x-18,y,si,true);this.spawnAt('E1',x+18,y,si,true)}},
  wavePool(){const pool=['E1'];if(this.wave>=2)pool.push('E2');if(this.wave>=3)pool.push('E3');if(this.wave>=4)pool.push('E4','E7');if(this.wave>=5)pool.push('E8');if(this.wave>=6)pool.push('E5','E6');if(this.wave>=7)pool.push('E11');if(this.wave>=8)pool.push('E9','E10');if(this.wave>=9)pool.push('E12');return pool},
  buildWaveRoster(){const budget=5+3*(this.wave-1),pool=this.wavePool(),roster=[],specialCount={},specialMax=budget*0.35,directMin=budget*0.35;let rem=budget,specialSpent=0,directSpent=0;const add=ty=>{roster.push(ty);rem-=THREAT_COST[ty]||1;if(SPECIAL_ENEMY.has(ty)){specialSpent+=THREAT_COST[ty]||1;specialCount[ty]=(specialCount[ty]||0)+1}if(DIRECT_ENEMY.has(ty))directSpent+=THREAT_COST[ty]||1};const can=ty=>{const c=THREAT_COST[ty]||1;if(c>rem)return false;if(SPECIAL_ENEMY.has(ty)&&(specialSpent+c>specialMax||(specialCount[ty]||0)>=2))return false;return true};while(directSpent<directMin&&rem>0){const d=pool.filter(ty=>DIRECT_ENEMY.has(ty)&&can(ty));if(!d.length)break;add(Phaser.Utils.Array.GetRandom(d))}while(rem>0){const opts=pool.filter(can);if(!opts.length){if(can('E1'))add('E1');else break}else add(Phaser.Utils.Array.GetRandom(opts))}return Phaser.Utils.Array.Shuffle(roster)},
  levelWave(){return this.levelConfig?.waves?.[this.wave-1]||null},
  startWave(){this.wActive=true;const lw=this.levelWave();this._waveRoster=lw?lw.roster.slice():this.buildWaveRoster();this.wC=this._waveRoster.length;this.wS=0;this._spawnOffset=Phaser.Math.Between(0,MAP.spawns.length-1);this._wt=this.time.addEvent({delay:500,loop:true,callback:()=>{if(this.wS>=this.wC){this._wt.remove();return}const lanes=lw?.lanes,laneRaw=lanes?lanes[this.wS%lanes.length]:(this._spawnOffset+this.wS),si=((laneRaw%MAP.spawns.length)+MAP.spawns.length)%MAP.spawns.length,ty=this._waveRoster[this.wS]||'E1';this.spawnE(si,ty);this.wS++}})},
  spawnE(si,type){const cfg=EC[type],[sx,sy]=MAP.spawns[si],e=this.physics.add.image(sx,sy,cfg.key).setDepth(6).setTint(cfg.color||0xffffff);this.enemies.add(e);e.body.enable=true;e._uid=++this.enemySeq;const sc=this.levelWave()?.scale??(1+(this.wave-1)*0.1);e._hp=Math.round(cfg.hp*sc);e._maxhp=e._hp;e._dmg=cfg.dmg;e._spd=cfg.spd;e._atk=cfg.atk;e._at=0;e._firstAttack=true;e._si=si;e._b1tgt=null;e._reactorTarget=null;e._droneTarget=null;e._type=type;e._bt=0;e._slow=0;e._slowT=0;e._state='path';e._hatch=cfg.hatch||0;e._hits=0;this.routeToReactor(e,false);e.body.setCircle(Math.min(16,e.width/2));e.body.setBounce(0);return e},
  gameOver(title='防线失守'){if(this.ended)return;this.ended=true;const completed=this.completedWaves??Math.max(0,this.wave-1),levelCleared=!!this.levelConfig&&completed>=this.levelConfig.waves.length,reward=this.levelConfig?(levelCleared?1:0):Math.floor(completed/5);metaSave.cores+=reward;metaSave.bestWave=Math.max(metaSave.bestWave,completed);if(levelCleared&&this.levelConfig?.id){metaSave.levelClears=metaSave.levelClears||{};metaSave.levelClears[this.levelConfig.id]=true}saveMeta();document.querySelector('#gameOverPanel h2').textContent=title;document.getElementById('resultWaves').textContent=completed;document.getElementById('resultReward').textContent=reward;document.getElementById('resultCores').textContent=metaSave.cores;document.getElementById('pausePanel').style.display='none';document.getElementById('gameOverPanel').style.display='flex';this.scene.pause()}
};
