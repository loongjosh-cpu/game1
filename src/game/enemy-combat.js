const EnemyCombatMethods={
  combatTargetName(target){
    if(!target)return '-';
    if(target._owner)return `${target._owner?._type?.id||'D?'}-unit`;
    if(target._isMainReactor)return 'R0';
    if(target._isReactor)return 'R1';
    return target._type?.id||'target'
  },
  recordEnemyCombat(e,phase,target,dist=null,range=null,reason=''){
    if(!e)return;
    e._combatDebug={
      phase,
      target:this.combatTargetName(target),
      dist:Number.isFinite(dist)?Math.round(dist):null,
      range:Number.isFinite(range)?Math.round(range):null,
      at:Math.round(e._at||0),
      delay:Math.round(this.enemyAttackDelay?this.enemyAttackDelay(e):(e._firstAttack?650:e._atk||0)),
      first:!!e._firstAttack,
      reason,
      time:Date.now()
    };
    e._combatDebugReason=reason
  },
  tryEnemyRangedAttack(e,target,cfg,dt,range,fire,phase){
    if(!target||!target.active||target._hp<=0){
      this.recordEnemyCombat(e,phase,target,null,range,'invalid-target');
      return false
    }
    const dist=Phaser.Math.Distance.Between(e.x,e.y,target.x,target.y);
    if(dist>range){
      this.recordEnemyCombat(e,phase,target,dist,range,'out-of-range');
      return false
    }
    this.stopEnemyAndFace(e,target);
    if(this.enemyAttackReady(e,dt)){
      fire();
      this.recordEnemyCombat(e,phase,target,dist,range,'fired');
    }else{
      this.recordEnemyCombat(e,phase,target,dist,range,'cooldown')
    }
    return true
  },
  tryEnemyMeleeAttack(e,target,cfg,dt,onHit,phase){
    if(!target||!target.active||target._hp<=0){
      this.recordEnemyCombat(e,phase,target,null,null,'invalid-target');
      return false
    }
    const range=this.enemyMeleeRange(e,target);
    const dist=Phaser.Math.Distance.Between(e.x,e.y,target.x,target.y);
    if(dist>range){
      this.recordEnemyCombat(e,phase,target,dist,range,'approach');
      return false
    }
    this.stopEnemyAndFace(e,target);
    if(cfg.selfDestruct){
      this.enemySelfDestruct(e,target);
      this.recordEnemyCombat(e,phase,target,dist,range,'self-destruct');
      return true
    }
    if(this.enemyAttackReady(e,dt)){
      onHit();
      this.recordEnemyCombat(e,phase,target,dist,range,'hit');
    }else{
      this.recordEnemyCombat(e,phase,target,dist,range,'cooldown')
    }
    return true
  },
  handleEnemyDroneCombat(e,cfg,dt,speed=sd(cfg.spd||0)){
    if(cfg.droneRange){
      if(this.enemyHasBlockerLock(e))return false;
      const target=this.chooseDroneInRange(e,sd(cfg.droneRange));
      if(target){
        return this.tryEnemyRangedAttack(
          e,
          target,
          cfg,
          dt,
          sd(cfg.droneRange),
          ()=>this.fireEnemyDart(e,target,cfg.shotSpeed||700,e._dmg),
          'drone-ranged'
        )
      }
      this.recordEnemyCombat(e,'drone-ranged',null,null,sd(cfg.droneRange),'no-drone');
      return false
    }

    const droneTarget=this.getEnemyDroneTarget(e);
    if(!droneTarget){
      this.recordEnemyCombat(e,'drone-melee',null,null,null,'no-drone-lock');
      return false
    }
    if(this.tryEnemyMeleeAttack(e,droneTarget,cfg,dt,()=>{
      this.damageDrone(droneTarget,e._dmg,e,{kind:'melee'});
      this.enemyAttackEffect(e,droneTarget)
    },'drone-melee')){
      return true
    }
    this.advanceEnemyToTarget(e,droneTarget,speed,dt);
    return true
  },
  handleEnemyBlockerCombat(e,cfg,dt,speed=sd(cfg.spd||0)){
    const target=e._b1tgt&&e._b1tgt.active&&e._b1tgt._hp>0?e._b1tgt:null;
    if(!target)return false;

    const stop=this.enemyMeleeRange(e,target);
    const dist=Phaser.Math.Distance.Between(e.x,e.y,target.x,target.y);
    if(cfg.droneRange){
      const handled=this.tryEnemyRangedAttack(
        e,
        target,
        cfg,
        dt,
        sd(cfg.droneRange),
        ()=>this.fireEnemyDart(e,target,cfg.shotSpeed||700,e._dmg),
        'blocker-ranged'
      );
      if(handled)return true
    }
    if(cfg.rangeAtk){
      const handled=this.tryEnemyRangedAttack(
        e,
        target,
        cfg,
        dt,
        sd(cfg.rangeAtk),
        ()=>this.fireEnemyShell(e,target),
        'blocker-ranged'
      );
      if(handled)return true
    }
    if(dist>stop){
      this.recordEnemyCombat(e,'blocker-approach',target,dist,stop,'approach');
      this.advanceEnemyToTarget(e,target,speed,dt);
      return true
    }

    this.tryEnemyMeleeAttack(e,target,cfg,dt,()=>this.enemyHitBlocker(e,target),'blocker-melee');
    return true
  },
  enemyHitBlocker(e,target){
    this.applyFriendlyDamage({source:e,target,amount:e._dmg,kind:'melee'});
    this.enemyAttackEffect(e,target);
    if(target._type.id==='B4'&&target.active){
      this.areaAttack(target,target._type.upg[target._lv||0],0x66ccff)
    }
  },
  handleEnemyReactorCombat(e,cfg,dt,speed=sd(cfg.spd||0)){
    let reactor=this.reactorAlive(e._reactorTarget)?e._reactorTarget:null;
    if(!reactor){
      this.routeToReactor(e,false);
      reactor=e._reactorTarget
    }
    if(!reactor){
      this.recordEnemyCombat(e,'reactor',null,null,null,'no-reactor');
      this.moveEnemy(e,0,0,55);
      return true
    }
    if(cfg.droneRange){
      const handled=this.tryEnemyRangedAttack(
        e,
        reactor,
        cfg,
        dt,
        sd(cfg.droneRange),
        ()=>this.fireEnemyDart(e,reactor,cfg.shotSpeed||700,e._dmg),
        'reactor-ranged'
      );
      if(handled)return true
    }
    if(cfg.rangeAtk){
      const handled=this.tryEnemyRangedAttack(
        e,
        reactor,
        cfg,
        dt,
        sd(cfg.rangeAtk),
        ()=>this.fireEnemyShell(e,reactor),
        'reactor-ranged'
      );
      if(handled)return true
    }
    const dist=Phaser.Math.Distance.Between(e.x,e.y,reactor.x,reactor.y);
    const stop=this.enemyMeleeRange(e,reactor);
    if(dist<stop){
      this.tryEnemyMeleeAttack(e,reactor,cfg,dt,()=>this.enemyHitReactor(e,reactor),'reactor-melee');
      return true
    }
    this.advanceEnemyToTarget(e,reactor,speed,dt);
    this.recordEnemyCombat(e,'reactor-approach',reactor,dist,stop,'approach');
    return true
  },
  enemyHitReactor(e,reactor){
    this.applyFriendlyDamage({source:e,target:reactor,amount:e._dmg,kind:'melee'});
    this.enemyAttackEffect(e,reactor);
  }
};
