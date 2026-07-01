const EnemyStatusMethods={
  updateEnemies(dt){
    this.enemies.children.iterate(e=>this.updateEnemy(e,dt))
  },
  updateEnemy(e,dt){
    if(!e||!e.active)return;
    const cfg=EC[e._type];
    if(!this.updateEnemySpawnAndStatus(e,cfg,dt))return;
    this.updateEnemyTargetScan(e,cfg,dt);
    const speed=this.updateEnemySpeed(e,cfg,dt);
    if(this.handleEnemyDroneCombat(e,cfg,dt,speed))return;
    if(this.handleEnemyBlockerCombat(e,cfg,dt,speed))return;
    if(this.handleEnemyReactorCombat(e,cfg,dt,speed))return;
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
          true,
          e._waveNo
        )
      }
    }
    if(e._summonTimers?.length){
      for(const s of e._summonTimers){
        s.left-=dt;
        if(s.left<=0){
          s.left+=s.interval;
          this.spawnAt(
            s.type,
            e.x+Phaser.Math.Between(-28,28),
            e.y+Phaser.Math.Between(-28,28),
            e._si,
            true,
            e._waveNo
          )
        }
      }
    }
    if(e._poisons?.length){
      for(const p of e._poisons){
        p.left-=dt;
        p.tick-=dt;
        if(p.tick<=0){
          p.tick+=500;
          this.damageEnemy(e,p.dmg||this.poisonTickDamage());
          if(!e.active)return false
        }
      }
      e._poisons=e._poisons.filter(p=>p.left>0)
    }
    e._freezeCd=Math.max(0,(e._freezeCd||0)-dt);
    e._frozenT=Math.max(0,(e._frozenT||0)-dt);
    e._freezeAmpT=Math.max(0,(e._freezeAmpT||0)-dt);
    e._slowT=Math.max(0,(e._slowT||0)-dt);
    if(!e._slowT)e._slow=0;
    return true
  },
  updateEnemySpeed(e,cfg,dt){
    this.updateEnemyAura(e,cfg,dt);
    e._auraBoostT=Math.max(0,(e._auraBoostT||0)-dt);
    const aura=e._auraBoostT>0?1.2:1;
    if(e._frozenT>0)return 0;
    const poisonSlow=this.meta.poisonSlow&&this.enemyIsPoisoned(e)?0.9:1;
    let speed=sd(e._spd)*aura*(e._slow?1-e._slow:1)*poisonSlow;
    if(cfg.burst){
      e._bt=(e._bt||0)+dt;
      const phase=e._bt%(cfg.burstCycle||4000);
      if(phase<(cfg.burstDuration||1000)){
        speed=sd(cfg.burstSpeed||400)*aura*(e._slow?1-e._slow:1)*poisonSlow
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
  }
};
