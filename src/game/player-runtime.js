const PlayerRuntimeMethods={
  updateShip(dt){
    if(this.isEnemyTestMode?.()){
      this.hideEnemyTestShip?.();
      return;
    }
    let vx=0,vy=0;
    if(!this.shipDead){
      if(this.keys.left.isDown)vx=-1;
      if(this.keys.right.isDown)vx=1;
      if(this.keys.up.isDown)vy=-1;
      if(this.keys.down.isDown)vy=1;
      if(vx||vy)this.shipMoveTarget=null;
      else if(this.shipMoveTarget){
        const dx=this.shipMoveTarget.x-this.ship.x,dy=this.shipMoveTarget.y-this.ship.y,dd=Math.hypot(dx,dy);
        if(dd>25){vx=dx/dd;vy=dy/dd}else this.shipMoveTarget=null
      }
      if(vx&&vy&&Math.abs(vx)===1&&Math.abs(vy)===1){vx*=0.707;vy*=0.707}
      this.ship.setVelocity(vx*sd(this.meta.shipSpeed),vy*sd(this.meta.shipSpeed));
      if(vx||vy)this.ship.setRotation(Math.atan2(vy,vx)+Math.PI/2)
    }
    this.rng.setPosition(this.ship.x,this.ship.y).setVisible(!this.shipDead)
  },
  drawReactorDistancePreview(){
    const minR=sd(REACTOR_MIN_DISTANCE);
    this.ghostRng.lineStyle(2,0xff5566,0.28);
    for(const reactor of this.reactors){
      if(!this.reactorAlive(reactor))continue;
      for(let a=0;a<Math.PI*2;a+=0.16){
        this.ghostRng.lineBetween(
          reactor.x+Math.cos(a)*minR,
          reactor.y+Math.sin(a)*minR,
          reactor.x+Math.cos(a+0.08)*minR,
          reactor.y+Math.sin(a+0.08)*minR
        )
      }
    }
  },
  drawBuildRangePreview(wx,wy,ok){
    const r=sd(this.sel.range);
    this.ghostRng.lineStyle(2.5,ok?0x44ff88:0xff4444,0.6);
    for(let a=0;a<Math.PI*2;a+=0.4){
      this.ghostRng.lineBetween(
        wx+Math.cos(a)*r,
        wy+Math.sin(a)*r,
        wx+Math.cos(a+0.2)*r,
        wy+Math.sin(a+0.2)*r
      )
    }
  },
  updateBuildGhost(t){
    this.ghostRng.clear();
    if(!this.bld||this.shipDead){this.ghost.setVisible(false);return}
    const rawX=this.input.activePointer.worldX,rawY=this.input.activePointer.worldY;
    const point=this.placementPoint(rawX,rawY),wx=point.x,wy=point.y;
    const d=Phaser.Math.Distance.Between(this.ship.x,this.ship.y,wx,wy),shipRange=sd(SHIP_RNG);
    const cost=this.towerBuildCost?this.towerBuildCost(this.sel):this.sel.cost;
    const ok=d<=shipRange&&this.canPl(wx,wy)&&this.en>=cost;
    this.ghost.setVisible(d<=shipRange);
    this.ghost.setPosition(wx,wy);
    this.ghost.setTexture('gh'+this.sel.id);
    this.ghost.setAlpha(ok?0.7+Math.sin(t*0.005)*0.2:0.3);
    if(point.snapped){
      this.ghostRng.fillStyle(0x44aaff,0.18);
      this.ghostRng.fillCircle(wx,wy,sd(24))
    }
    if(this.sel===SMALL_REACTOR)this.drawReactorDistancePreview();
    if(this.sel.range)this.drawBuildRangePreview(wx,wy,ok);
    if(this.input.activePointer.leftButtonDown()&&!this._buildLatch&&ok){this._buildLatch=true;this.startBuild(wx,wy)}
  },
  updateShipMissiles(dt){
    if(this.isEnemyTestMode?.())return;
    if(this.shipDead)return;
    this.mslTmr+=dt;
    if(this.mslTmr<this.meta.missileCd)return;
    const targets=this.findTargets(this.ship.x,this.ship.y,sd(SHIP_RNG))
      .sort((a,b)=>(EC[b._type].danger-EC[a._type].danger)||Phaser.Math.Distance.Between(this.ship.x,this.ship.y,a.x,a.y)-Phaser.Math.Distance.Between(this.ship.x,this.ship.y,b.x,b.y))
      .slice(0,this.meta.missileTargets);
    if(!targets.length)return;
    targets.forEach(tgt=>this.fireMsl(this.ship.x,this.ship.y,tgt));
    this.mslTmr=0
  }
};
