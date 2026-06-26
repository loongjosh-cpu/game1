const EnemyCombatMethods={
  handleEnemyDroneCombat(e,cfg,dt){
    if(cfg.droneRange){
      if(e._b1tgt&&this.enemyCanBeTauntedBy(e,cfg,e._b1tgt))return false;
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
      if(cfg.selfDestruct){
        this.enemySelfDestruct(e,droneTarget);
        return true
      }
      if(this.enemyAttackReady(e,dt)){
        this.damageDrone(droneTarget,e._dmg,e,{kind:'melee'});
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
    if(cfg.selfDestruct){
      this.enemySelfDestruct(e,target);
      return true
    }
    if(this.enemyAttackReady(e,dt))this.enemyHitBlocker(e,target);
    return true
  },
  enemyHitBlocker(e,target){
    this.applyFriendlyDamage({source:e,target,amount:e._dmg,kind:'melee'});
    this.enemyAttackEffect(e,target);
    if(target._type.id==='B4'&&target.active){
      this.areaAttack(target,target._type.upg[target._lv||0],0x66ccff)
    }
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
    const dist=Phaser.Math.Distance.Between(e.x,e.y,reactor.x,reactor.y);
    const stop=reactor._size/2+20;
    if(dist<stop){
      this.moveEnemy(e,0,0,55);
      if(cfg.selfDestruct){
        this.enemySelfDestruct(e,reactor);
        return true
      }
      if(this.enemyAttackReady(e,dt))this.enemyHitReactor(e,reactor);
      return true
    }
    if(e._route&&e._routeI<e._route.length)return false;
    this.routeToReactor(e,true);
    return false
  },
  enemyHitReactor(e,reactor){
    this.applyFriendlyDamage({source:e,target:reactor,amount:e._dmg,kind:'melee'});
    this.enemyAttackEffect(e,reactor);
  }
};
