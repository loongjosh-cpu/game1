const EnemyNavigationMethods={
  closestPathPt(path,x,y){let bt=0,bd=Infinity;for(let t=0;t<=1;t+=0.01){const pt=path.getPoint(t);const d=Phaser.Math.Distance.Between(x,y,pt.x,pt.y);if(d<bd){bd=d;bt=t}}return{t:bt,dist:bd}},
  makeRoute(x1,y1,x2,y2){return [[x1,y1],...astar(this.gridPF,x1,y1,x2,y2)]},
  setRoute(e,route){e._route=route;e._routeI=Math.min(1,route.length-1)},
  reactorAlive(r){return !!(r&&r.active&&r._hp>0)},
  chooseReactor(e){let best=null,bestDist=Infinity;for(const r of this.reactors){if(!this.reactorAlive(r))continue;const d=Phaser.Math.Distance.Between(e.x,e.y,r.x,r.y);if(d<bestDist){best=r;bestDist=d}}return best},
  routeToReactor(e,keepCurrent=true){const current=keepCurrent&&this.reactorAlive(e._reactorTarget)?e._reactorTarget:null,target=current||this.chooseReactor(e);e._reactorTarget=target;e._state='path';if(target)this.setRoute(e,this.makeRoute(e.x,e.y,target.x,target.y));else this.setRoute(e,[[e.x,e.y]])},
  rejoinPath(e){e._b1tgt=null;e._tauntLockDanger=0;e._reactorTarget=null;e._state='path';e._at=0;e._firstAttack=true;this.routeToReactor(e,false)},
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
  }
};
