const DroneControllerMethods={
  navPointOpen(x,y){const c=Math.floor(x/CELL),r=Math.floor(y/CELL);return r>=0&&r<this.gridPF.length&&c>=0&&c<this.gridPF[0].length&&!this.gridPF[r][c]},
  randomCorePoint(core,minRatio=0.15,maxRatio=0.85){
    const range=sd(core._type.upg[core._lv||0].r||core._type.range);
    const mw=mapW(),mh=mapH();
    for(let i=0;i<32;i++){
      const point=this.randomPointAroundCore(core,range,minRatio,maxRatio);
      if(this.validDronePoint(point.x,point.y,mw,mh))return point;
    }
    const open=nearestOpenCell(this.gridPF,Math.floor(core.x/CELL),Math.floor(core.y/CELL),12);
    return open?{x:open.c*CELL+CELL/2,y:open.r*CELL+CELL/2}:{x:core.x,y:core.y};
  },
  randomPointAroundCore(core,range,minRatio,maxRatio){
    const a=Math.random()*Math.PI*2;
    const r=range*(minRatio+Math.random()*(maxRatio-minRatio));
    return {x:core.x+Math.cos(a)*r,y:core.y+Math.sin(a)*r};
  },
  validDronePoint(x,y,mw,mh){
    return x>20&&x<mw-20&&y>20&&y<mh-20
      &&nearestWallDistance(x,y)>NAV_CLEARANCE+8
      &&this.navPointOpen(x,y);
  },
  spawnDrones(tw){tw._droneClock=0;this.spawnDrone(tw)},
  droneCount(tw){let count=0;this.droneHelpers.children.iterate(d=>{if(d&&d.active&&d._owner===tw)count++});return count},
  spawnDrone(tw){
    if(!this.canSpawnDrone(tw))return false;
    const td=tw._type;
    const up=td.upg[tw._lv||0];
    const d=this.createDroneSprite(tw,td);
    this.initDroneRuntime(d,tw,up);
    return true;
  },
  canSpawnDrone(tw){
    if(!tw||!tw.active)return false;
    const td=tw._type;
    const up=td.upg[tw._lv||0];
    return this.droneCount(tw)<(up.md||td.maxDrones||1);
  },
  createDroneSprite(tw,td){
    const pos=this.randomCorePoint(tw);
    const d=this.physics.add.image(pos.x,pos.y,'msl').setDepth(7).setTint(td.color).setScale(1.5);
    this.droneHelpers.add(d);
    d.body.setCircle(Math.min(8,d.width/2));
    return d;
  },
  initDroneRuntime(d,tw,up){
    d._owner=tw;
    d._target=null;
    d._engaged=false;
    d._patrol=this.randomCorePoint(tw);
    d._patrolWait=0;
    d._dmg=up.d;
    d._iv=up.i||1000;
    d._at=0;
    d._first=null;
    d._hp=up.hp;
    d._maxhp=up.hp;
    d._retargetT=Phaser.Math.Between(0,180);
    d._chaseT=0;
    d._lastTargetDist=Infinity;
    d._avoidUid=null;
    d._avoidT=0;
    this.resetDroneRouteState(d);
    d._lastX=d.x;
    d._lastY=d.y;
    d._stuckT=0;
  },
  resetDroneRouteState(d){
    d._route=null;
    d._routeI=0;
    d._routeGoal=null;
    d._moveFailT=0;
  },
  chooseDroneTarget(d,core,range){
    let best=null,bestScore=Infinity;
    const loads=this.droneTargetLoads(d);
    this.enemies.children.iterate(e=>{
      const score=this.droneTargetScore(e,d,core,range,loads);
      if(score<bestScore){
        best=e;
        bestScore=score;
      }
    });
    return best;
  },
  droneTargetLoads(d){
    const loads=new Map();
    this.droneHelpers.children.iterate(o=>{
      if(o&&o.active&&o!==d&&o._target&&o._target.active){
        loads.set(o._target,(loads.get(o._target)||0)+1);
      }
    });
    return loads;
  },
  droneTargetScore(e,d,core,range,loads){
    if(!e||!e.active||e._uid===d._avoidUid)return Infinity;
    const coreDist=Phaser.Math.Distance.Between(core.x,core.y,e.x,e.y);
    if(coreDist>range)return Infinity;
    const dist=Phaser.Math.Distance.Between(d.x,d.y,e.x,e.y);
    const load=loads.get(e)||0;
    const danger=EC[e._type]?.danger||0;
    const stick=e===d._target?45:0;
    return load*100000+dist-danger*8-stick;
  },
  clearDroneRoute(d){d._route=null;d._routeI=0;d._routeGoal=null;d._routeRefresh=0},
  moveDroneTo(d,x,y,speed,dt){
    d._routeRefresh=Math.max(0,(d._routeRefresh||0)-dt);
    if(this.droneRouteNeedsRefresh(d,x,y))this.refreshDroneRoute(d,x,y);
    while(d._route&&d._routeI<d._route.length){
      if(this.moveDroneTowardWaypoint(d,speed))return true;
      d._routeI++;
    }
    d.body.setVelocity(0,0);
    d._moveFailT=(d._moveFailT||0)+dt;
    return false;
  },
  droneRouteNeedsRefresh(d,x,y){
    const moved=!d._routeGoal||Phaser.Math.Distance.Between(d._routeGoal.x,d._routeGoal.y,x,y)>CELL*0.5;
    return !d._route||d._routeI>=d._route.length||(moved&&d._routeRefresh<=0);
  },
  refreshDroneRoute(d,x,y){
    const route=this.makeRoute(d.x,d.y,x,y);
    d._route=route;
    d._routeI=route.length?Math.min(1,route.length-1):0;
    d._routeGoal={x,y};
    d._routeRefresh=350;
  },
  moveDroneTowardWaypoint(d,speed){
    const wp=d._route[d._routeI];
    const dist=Phaser.Math.Distance.Between(d.x,d.y,wp[0],wp[1]);
    if(dist<=14)return false;
    this.physics.moveTo(d,wp[0],wp[1],speed);
    d.setRotation(Math.atan2(wp[1]-d.y,wp[0]-d.x)+Math.PI/2);
    d._moveFailT=0;
    return true;
  },
  droneStuck(d,dt){
    this.updateDroneStuckTimer(d,dt);
    if(d._stuckT<DRONE_STUCK_LIMIT)return false;
    this.recoverStuckDrone(d);
    return true;
  },
  updateDroneStuckTimer(d,dt){
    const moved=Phaser.Math.Distance.Between(d._lastX??d.x,d._lastY??d.y,d.x,d.y);
    const trying=(d.body?.speed||0)>5;
    d._stuckT=trying&&moved<0.35?(d._stuckT||0)+dt:0;
    d._lastX=d.x;
    d._lastY=d.y;
  },
  recoverStuckDrone(d){
    if(d._target&&!d._engaged){
      d._avoidUid=d._target._uid;
      d._avoidT=900;
      d._target=null;
      d._first=null;
      d._retargetT=0;
    }
    d._patrol=null;
    d._patrolWait=0;
    d._chaseT=0;
    d._lastTargetDist=Infinity;
    d._stuckT=0;
    d._moveFailT=0;
    this.clearDroneRoute(d);
    d.body.setVelocity(0,0);
  },
  findAttackingDrone(e){
    let next=null;
    this.droneHelpers.children.iterate(d=>{
      if(!next&&d&&d.active&&d._hp>0&&d._target===e)next=d
    });
    return next;
  },
  destroyDrone(d){
    if(!d||!d.active)return;
    const locked=[];
    this.enemies.children.iterate(e=>{
      if(e&&e.active&&e._droneTarget===d)locked.push(e)
    });
    d._hp=0;
    d.destroy();
    locked.forEach(e=>this.releaseDroneAggro(e));
  },
  releaseDroneAggro(e){
    e._droneTarget=null;
    const next=this.findAttackingDrone(e);
    if(next)this.aggroDrone(e,next);
    else this.rejoinPath(e);
  },
  damageDrone(d,dmg){
    if(!d||!d.active)return;
    d._hp-=dmg;
    if(d._hp<=0)this.destroyDrone(d);
  },
  aggroDrone(e,d){
    if(!e||!e.active||!d||!d.active||d._hp<=0)return;
    if(e._droneTarget&&e._droneTarget.active&&e._droneTarget._hp>0)return;
    e._droneTarget=d;
    e._b1tgt=null;
    e._state='drone';
    e._at=0;
    e._firstAttack=true;
    this.setRoute(e,this.makeRoute(e.x,e.y,d.x,d.y));
  }
};
