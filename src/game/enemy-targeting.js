const EnemyTargetingMethods={
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
