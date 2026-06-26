const EnemyTargetingMethods={
  towerDanger(tw){
    if(tw._wreck&&tw._type.id==='B1'){
      const base=(tw._lv||0)===0?3:2;
      return Math.max(0,base-(this.meta.b1LowWreck?1:0))
    }
    const up=tw._type.upg[tw._lv||0];
    let danger=up.danger??tw._type.danger??0;
    if(tw._type.id==='B3'&&this.meta.b3Taunt){
      const low=tw._maxhp&&tw._hp/tw._maxhp<0.4;
      danger+=low?-1:1
    }
    return Math.max(0,danger)
  },
  enemyCanBeTauntedBy(e,cfg,tw){
    if(!tw||!tw.active||tw._hp<=0)return false;
    const danger=this.towerDanger(tw);
    if(cfg.danger>danger)return false;
    const range=sd(tw._type.upg[tw._lv||0].r||tw._type.range);
    return Phaser.Math.Distance.Between(e.x,e.y,tw.x,tw.y)<=range
  },
  considerEnemyBuildingTarget(e,cfg,tw,state){
    if(!this.enemyCanBeTauntedBy(e,cfg,tw))return state;
    const danger=this.towerDanger(tw),d=Phaser.Math.Distance.Between(e.x,e.y,tw.x,tw.y);
    if(danger>state.bestDanger||(danger===state.bestDanger&&!state.held&&d<state.bestDist)){
      state.best=tw;
      state.bestDanger=danger;
      state.bestDist=d
    }
    return state
  },
  chooseBlocker(e){
    const cfg=EC[e._type],held=this.enemyCanBeTauntedBy(e,cfg,e._b1tgt)?e._b1tgt:null;
    const state={best:held,bestDanger:held?this.towerDanger(held):-1,bestDist:held?Phaser.Math.Distance.Between(e.x,e.y,held.x,held.y):Infinity,held};
    this.blockers.children.iterate(tw=>this.considerEnemyBuildingTarget(e,cfg,tw,state));
    this.drones.children.iterate(tw=>this.considerEnemyBuildingTarget(e,cfg,tw,state));
    return state.best
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
  }
};
