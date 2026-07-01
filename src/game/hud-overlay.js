const HudOverlayMethods={
  drawMiniBar(g,x,y,width,height,pct,color,bg=0x333333){
    const clamped=Phaser.Math.Clamp(pct,0,1);
    g.fillStyle(bg);g.fillRect(x,y,width,height);
    g.fillStyle(color);g.fillRect(x,y,width*clamped,height)
  },
  renderBlockerBar(tw){
    if(!tw||!tw.active||!Number.isFinite(tw._hp)||!tw._maxhp)return;
    const forceShow=!!tw._wreck;
    if(!forceShow&&tw._hp>=tw._maxhp)return;
    const pct=tw._hp/tw._maxhp,x=tw.x-25,y=tw.y-tw._size/2-10;
    const color=tw._wreck?0xb8b8b8:(pct>0.5?0x8899aa:0xe94560);
    this.drawMiniBar(this.overlay,x,y,50,4,pct,color);
    if(!tw._wreck)return;
    this.overlay.lineStyle(1,0xffffff,0.25);
    this.overlay.strokeRect(x,y,50,4);
    if(!this.meta.b1Repair)return;
    this.drawMiniBar(this.overlay,x,y+6,50,3,(tw._repair||0)/200,0x44dd88,0x1b2a24)
  },
  renderDroneBar(d){
    if(!d||!d.active||d._hp>=d._maxhp)return;
    const pct=Math.max(0,d._hp/d._maxhp);
    this.drawMiniBar(this.overlay,d.x-12,d.y-16,24,3,pct,pct>0.5?0x22cc66:pct>0.25?0xddcc44:0xe94560)
  },
  renderEnemyBar(e){
    if(!e||!e.active)return;
    const pct=Math.max(0,e._hp/e._maxhp);
    this.drawMiniBar(this.overlay,e.x-15,e.y-28,30,4,pct,pct>0.5?0x22cc66:pct>0.25?0xddcc44:0xe94560)
  },
  enemyCombatDebugEnabled(){
    return !!((typeof R32_DEBUG_ENABLED!=='undefined'&&R32_DEBUG_ENABLED)||this.isEnemyTestMode?.())
  },
  updateEnemyCombatDebugLabels(){
    if(!this.enemyCombatDebugEnabled()){
      if(this._enemyDebugLabels){
        this._enemyDebugLabels.forEach(label=>label.destroy());
        this._enemyDebugLabels=[];
      }
      return
    }
    this._enemyDebugLabels=this._enemyDebugLabels||[];
    const active=[];
    this.enemies.children.iterate(e=>{if(e&&e.active)active.push(e)});
    const maxLabels=Math.min(active.length,30);
    while(this._enemyDebugLabels.length<maxLabels){
      this._enemyDebugLabels.push(
        this.add.text(0,0,'',textStyle(11,'#d8f6ff'))
          .setDepth(30)
          .setOrigin(0.5)
          .setShadow(0,1,'#001018',3)
      )
    }
    while(this._enemyDebugLabels.length>maxLabels)this._enemyDebugLabels.pop().destroy();
    for(let i=0;i<maxLabels;i++){
      const e=active[i],dbg=e._combatDebug||{};
      const line1=`${e._type} ${dbg.phase||e._state||'-'} ${dbg.reason||'-'}`;
      const line2=`T:${dbg.target||'-'} D:${dbg.dist??'-'}/${dbg.range??'-'} CD:${dbg.at??0}/${dbg.delay??e._atk}`;
      this._enemyDebugLabels[i]
        .setPosition(e.x,e.y-48)
        .setText(`${line1}\n${line2}`)
        .setVisible(true)
    }
  },
  renderReactorBars(){
    this.rxBar.clear();
    for(const r of this.reactors){
      if(!this.reactorAlive(r))continue;
      const pct=Math.max(0,r._hp/r._maxhp),w=r._isMainReactor?100:60,h=r._isMainReactor?8:6,x=r.x-w/2,y=r.y-r._size/2-20;
      this.drawMiniBar(this.rxBar,x,y,w,h,pct,pct>0.5?0x22cc66:pct>0.25?0xddcc44:0xe94560);
      this.rxBar.lineStyle(1,0xffffff,0.3);
      this.rxBar.strokeRect(x,y,w,h)
    }
  },
  renderOverlayBars(){
    this.overlay.clear();
    this.blockers.children.iterate(tw=>this.renderBlockerBar(tw));
    this.drones.children.iterate(tw=>this.renderBlockerBar(tw));
    this.droneHelpers.children.iterate(d=>this.renderDroneBar(d));
    this.enemies.children.iterate(e=>this.renderEnemyBar(e));
    this.renderReactorBars();
    this.updateEnemyCombatDebugLabels()
  },
  wavePhaseText(activeEnemies){
    if(this.wActive)return '出敌中';
    if(activeEnemies>0&&!this._allLevelWavesSpawned)return `下一波 ${(this.prepTimer/1000).toFixed(1)}s`;
    if(activeEnemies>0&&this._allLevelWavesSpawned)return '清理残敌';
    return `准备 ${(this.prepTimer/1000).toFixed(1)}s`
  },
  updateHud(t,dt){
    const activeEnemies=this.enemies.countActive();
    document.getElementById('hudPhase').textContent=this.wavePhaseText(activeEnemies);
    this.spawnMarkers.forEach((m,i)=>m.setAlpha(this.wActive?0.35:0.45+0.45*Math.sin(t*0.006+i)));
    document.getElementById('hudEnergy').textContent=Math.floor(this.en);
    document.getElementById('hudIncome').textContent=this.energyRate();
    document.getElementById('hudReactor').textContent=Math.ceil(this.rxHP);
    document.getElementById('hudSmallReactors').textContent=this.smallReactorCount()+'/'+SMALL_REACTOR.maxCount;
    document.getElementById('hudWave').textContent=this.wave;
    document.getElementById('hudCompleted').textContent=this.completedWaves||0;
    document.getElementById('hudEnemies').textContent=activeEnemies;
    document.getElementById('hudTowers').textContent=this.towers.countActive()+this.blockers.countActive()+this.drones.countActive();
    if(Math.floor(t/500)!==Math.floor((t-dt)/500))document.getElementById('hudFps').textContent=Math.round(this.game.loop.actualFps);
    this.updTwPanel();
    this.updUpgradeHint()
  }
};
