const PlacementControllerMethods={
  towerBuildCost(td){
    if(td?.id==='B4'&&this.meta.b4Resonance)return Math.max(0,td.cost-80);
    return td.cost
  },
  placementPoint(x,y,td=this.sel){return this.isEnemyTestMode?.()?{x,y,snapped:false}:td.type==='path'?snapToWallEdge(x,y,20):{x,y,snapped:false}},
  canPl(x,y){
    const td=this.sel;
    const point=this.placementPoint(x,y,td);
    const radius=this.placementRadius(td);
    x=point.x;
    y=point.y;
    if(!this.isEnemyTestMode?.()&&td===SMALL_REACTOR&&this.smallReactorCount()>=td.maxCount)return false;
    if(!this.isEnemyTestMode?.()&&!this.validWallPlacement(td,x,y,radius))return false;
    if(this.overlapsExistingDefense(x,y,radius))return false;
    if(!this.isEnemyTestMode?.()&&this.overlapsReactorRule(td,x,y,radius))return false;
    if(!this.isEnemyTestMode?.()&&this.tooCloseToSpawn(x,y,radius))return false;
    return true;
  },
  placementRadius(td){
    const rawSize=td.tSize||(td.type==='block'?45:40);
    const size=td.type==='reactor'?sd(rawSize):rawSize;
    return size/2;
  },
  validWallPlacement(td,x,y,radius){
    const wallDistance=nearestWallDistance(x,y);
    const minGap=td.type==='path'?0:4;
    if(wallDistance<radius+minGap)return false;
    if(td.type==='path'&&wallDistance>radius+4)return false;
    return true;
  },
  overlapsExistingDefense(x,y,radius){
    return this.groupOverlapsPlacement(this.towers,x,y,radius)
      ||this.groupOverlapsPlacement(this.blockers,x,y,radius)
      ||this.groupOverlapsPlacement(this.drones,x,y,radius);
  },
  groupOverlapsPlacement(group,x,y,radius){
    let overlaps=false;
    group.children.iterate(t=>{
      if(t&&t.active&&Phaser.Math.Distance.Between(x,y,t.x,t.y)<radius+t._size/2+4)overlaps=true;
    });
    return overlaps;
  },
  overlapsReactorRule(td,x,y,radius){
    for(const r of this.reactors){
      if(!this.reactorAlive(r))continue;
      const distance=Phaser.Math.Distance.Between(x,y,r.x,r.y);
      const minDistance=td===SMALL_REACTOR?sd(REACTOR_MIN_DISTANCE):radius+r._size/2+12;
      if(distance<minDistance)return true;
    }
    return false;
  },
  tooCloseToSpawn(x,y,radius){
    return MAP.spawns.some(s=>Phaser.Math.Distance.Between(x,y,s[0],s[1])<radius+32);
  },
  canPlaceType(td,x,y){const prev=this.sel;this.sel=td;const ok=this.canPl(x,y);this.sel=prev;return ok},
  startBuild(x,y){
    if(this.isPaused||this.shipDead||this.channel)return;
    const td=this.sel;
    const point=this.placementPoint(x,y,td);
    x=point.x;
    y=point.y;
    if(!this.canStartBuildAt(td,x,y))return;
    if(this.isEnemyTestMode?.()){
      this.placeTower(x,y);
      this.bld=true;
      this.ghost.setVisible(false);
      this.updPanel();
      return;
    }
    this.channel={kind:'build',td,x,y,elapsed:0,duration:BUILD_TIME[td.type]||1800,label:`建造 ${td.name}`};
    this.bld=false;
    this.ghost.setVisible(false);
    this.updChannelPanel();
    this.updPanel();
  },
  canStartBuildAt(td,x,y){
    if(this.en<this.towerBuildCost(td))return false;
    if(this.isEnemyTestMode?.())return this.canPlaceType(td,x,y);
    if(Phaser.Math.Distance.Between(this.ship.x,this.ship.y,x,y)>sd(SHIP_RNG))return false;
    return this.canPlaceType(td,x,y);
  },
  cancelChannel(){this.channel=null;this.channelGfx.clear();document.getElementById('channelPanel').style.display='none';this.updPanel();this.updTwPanel()},
  updChannelPanel(){
    const c=this.channel;
    const p=document.getElementById('channelPanel');
    if(!c){
      p.style.display='none';
      return;
    }
    const ratio=Math.min(1,c.elapsed/c.duration);
    const left=Math.max(0,c.duration-c.elapsed);
    p.style.display='block';
    document.getElementById('channelLabel').textContent=c.label;
    document.getElementById('channelTime').textContent=(left/1000).toFixed(1)+'s';
    document.getElementById('channelFill').style.width=(ratio*100)+'%';
  },
  updateChannel(dt){
    const c=this.channel;
    if(!c)return;
    const point=this.channelPoint(c);
    if(!this.channelTargetValid(c,point)){
      this.cancelChannel();
      return
    }
    c.elapsed+=dt;
    this.updChannelPanel();
    this.drawChannelProgress(c,point);
    if(c.elapsed<c.duration)return;
    this.finishChannel(c)
  },
  channelPoint(c){
    return c.kind==='build'?{x:c.x,y:c.y}:{x:c.tw?.x,y:c.tw?.y}
  },
  channelTargetValid(c,point){
    const targetOk=c.kind==='build'
      ?this.canPlaceType(c.td,c.x,c.y)
      :c.tw&&c.tw.active&&(c.tw._lv||0)===c.fromLevel;
    const dist=Phaser.Math.Distance.Between(this.ship.x,this.ship.y,point.x,point.y);
    return !this.shipDead&&targetOk&&dist<=sd(SHIP_RNG)
  },
  drawChannelProgress(c,point){
    const ratio=Math.min(1,c.elapsed/c.duration),x=point.x,y=point.y;
    this.channelGfx.clear();
    this.channelGfx.lineStyle(2,0x7ec8e3,0.8);
    this.channelGfx.strokeCircle(x,y,34);
    this.channelGfx.fillStyle(0x08121c,0.9);
    this.channelGfx.fillRect(x-32,y-48,64,7);
    this.channelGfx.fillStyle(0x75e6ff,1);
    this.channelGfx.fillRect(x-31,y-47,62*ratio,5)
  },
  finishChannel(c){
    this.channel=null;
    this.channelGfx.clear();
    document.getElementById('channelPanel').style.display='none';
    if(c.kind==='build')this.finishBuildChannel(c);
    else this.finishUpgradeChannel(c);
    this.updPanel();
    this.updTwPanel()
  },
  finishBuildChannel(c){
    if(this.en<this.towerBuildCost(c.td)||!this.canPlaceType(c.td,c.x,c.y))return;
    const prev=this.sel;
    this.sel=c.td;
    this.placeTower(c.x,c.y);
    this.sel=prev
  },
  finishUpgradeChannel(c){
    if(!c.tw.active||(c.tw._lv||0)!==c.fromLevel||this.en<c.cost)return;
    this.applyUpgrade(c.tw)
  },
  placeTower(x,y){
    const td=this.sel,point=this.placementPoint(x,y,td);
    if(td.type==='reactor'){
      this.placeSmallReactor(point.x,point.y);
      return
    }
    const buildCost=this.towerBuildCost(td);
    this.en-=buildCost;
    const tw=this.createTowerSprite(td,point.x,point.y);
    tw._buildCost=buildCost;
    this.addTowerRangeGraphic(tw,td);
    this.registerTowerByType(tw,td);
    this.playTowerPlacedTween(tw);
    this.makeTowerInteractive(tw);
    this.updPanel()
  },
  createTowerSprite(td,x,y){
    const size=(td.type==='block'?(td.tSize||45):40)*1.25;
    const tw=this.add.image(x,y,'tw'+td.id).setDisplaySize(size,size).setDepth(3);
    tw._type=td;
    tw._lv=0;
    tw._at=0;
    tw._size=size;
    tw._metaShots=0;
    return tw
  },
  towerRangeColor(td){
    return td.type==='drone'?0x6688ff:td.type==='block'?0x8899aa:0x22cc66
  },
  addTowerRangeGraphic(tw,td){
    const rng=this.add.graphics().setDepth(1);
    this.drawPersistentTowerRange(rng,tw,td,td.upg[0]||{});
    tw._rngGfx=rng
  },
  drawPersistentTowerRange(gfx,tw,td,up){
    const color=this.towerRangeColor(td);
    const range=sd(this.effectiveTowerRange?this.effectiveTowerRange(td,up):(up.r||td.range));
    gfx.clear();
    gfx.fillStyle(color,0.018);
    gfx.fillCircle(tw.x,tw.y,range);
    gfx.lineStyle(5,color,0.08);
    gfx.strokeCircle(tw.x,tw.y,range);
    gfx.lineStyle(2,color,0.34);
    gfx.strokeCircle(tw.x,tw.y,range);
    gfx.lineStyle(1,0xffffff,0.28);
    gfx.strokeCircle(tw.x,tw.y,range*0.985);
    gfx.lineStyle(2,color,0.28);
    const tickCount=24;
    const tickOuter=range;
    const tickInner=Math.max(0,range-18);
    for(let i=0;i<tickCount;i++){
      const a=i*Math.PI*2/tickCount;
      gfx.lineBetween(
        tw.x+Math.cos(a)*tickInner,
        tw.y+Math.sin(a)*tickInner,
        tw.x+Math.cos(a)*tickOuter,
        tw.y+Math.sin(a)*tickOuter
      );
    }
  },
  registerTowerByType(tw,td){
    if(td.type==='drone'){
      const up=td.upg[0];
      tw._energySpend=true;
      tw._hp=up.coreHp||120;
      tw._maxhp=tw._hp;
      this.drones.add(tw);
      this.physics.add.existing(tw,true);
      this.spawnDrones(tw);
      return
    }
    if(td.type==='block'){
      this.blockers.add(tw);
      this.physics.add.existing(tw,true);
      tw._hp=this.effectiveTowerHp(td,td.upg[0]);
      tw._maxhp=tw._hp;
      if(td.id==='B4'){tw._shield=0;tw._shieldClock=0}
      return
    }
    this.towers.add(tw);
    this.physics.add.existing(tw,true)
  },
  effectiveTowerHp(td,up){
    let hp=up.hp;
    if(td.id==='B7'&&this.meta.b7Hp)hp+=100;
    return hp
  },
  playTowerPlacedTween(tw){
    this.tweens.add({targets:tw,scaleX:1.3,scaleY:1.3,duration:150,yoyo:true})
  },
  makeTowerInteractive(tw){
    tw.setInteractive();
    tw.on('pointerdown',pointer=>{
      const inRange=this.isEnemyTestMode?.()||Phaser.Math.Distance.Between(this.ship.x,this.ship.y,tw.x,tw.y)<=sd(SHIP_RNG);
      if(pointer.leftButtonDown()&&inRange){
        this.selTw=tw;
        this.updTwPanel()
      }
    })
  },
  makeReactorInteractive(r){
    r.setInteractive();
    r.on('pointerdown',pointer=>this.trySelectReactor(pointer,r));
  },
  trySelectReactor(pointer,r){
    if(!pointer.leftButtonDown()||this.shipDead)return;
    if(this.isEnemyTestMode?.()){
      this.bld=false;
      this.selTw=r;
      this.updPanel();
      this.updTwPanel();
      return;
    }
    const dist=Phaser.Math.Distance.Between(this.ship.x,this.ship.y,r.x,r.y);
    if(dist>sd(SHIP_RNG))return;
    this.bld=false;
    this.selTw=r;
    this.updPanel();
    this.updTwPanel();
  },
  placeSmallReactor(x,y){
    if(!this.isEnemyTestMode?.()&&(this.en<SMALL_REACTOR.cost||this.smallReactorCount()>=SMALL_REACTOR.maxCount))return;
    this.en-=SMALL_REACTOR.cost;
    const r=this.createSmallReactorSprite(x,y);
    this.reactors.push(r);
    this.makeReactorInteractive(r);
    this.playReactorPlacedTween(r);
    this.updPanel();
  },
  createSmallReactorSprite(x,y){
    const rSize=sd(SMALL_REACTOR.tSize);
    const r=this.add.image(x,y,'smallReactor').setDisplaySize(rSize,rSize).setDepth(3);
    r._type=SMALL_REACTOR;
    r._lv=0;
    r._size=rSize;
    r._hp=SMALL_REACTOR.upg[0].hp;
    r._maxhp=r._hp;
    r._isReactor=true;
    r._isMainReactor=false;
    r._label=this.add.text(x,y+rSize*0.67,'小反应炉 Lv1',textStyle(13,'#8fe7ff'))
      .setOrigin(0.5)
      .setDepth(11);
    return r;
  },
  playReactorPlacedTween(r){
    this.tweens.add({targets:r,scaleX:1.3,scaleY:1.3,duration:180,yoyo:true});
  },
  drawSelectedTowerRange(t){
    this.selectionGfx.clear();
    const tw=this.selTw;
    if(!tw||!tw.active)return;
    const td=tw._type;
    const up=td.upg[tw._lv||0];
    const color=this.selectionColor(td);
    const pulse=0.72+0.18*Math.sin(t*0.006);
    if(td.type!=='reactor')this.drawAttackRangeHighlight(tw,td,up,color,pulse);
    this.drawSelectedBodyHighlight(tw,color);
  },
  selectionColor(td){
    if(td.type==='reactor')return 0x7ec8e3;
    if(td.type==='drone')return 0x66aaff;
    if(td.type==='block')return 0xffcc66;
    return 0x44ff99;
  },
  drawAttackRangeHighlight(tw,td,up,color,pulse){
    const range=sd(this.effectiveTowerRange?this.effectiveTowerRange(td,up):(up.r||td.range));
    this.selectionGfx.fillStyle(color,0.055);
    this.selectionGfx.fillCircle(tw.x,tw.y,range);
    this.selectionGfx.lineStyle(10,color,0.11*pulse);
    this.selectionGfx.strokeCircle(tw.x,tw.y,range);
    this.selectionGfx.lineStyle(3,0xffffff,0.9*pulse);
    this.selectionGfx.strokeCircle(tw.x,tw.y,range);
  },
  drawSelectedBodyHighlight(tw,color){
    this.selectionGfx.fillStyle(color,0.18);
    this.selectionGfx.fillCircle(tw.x,tw.y,tw._size*0.9);
    this.selectionGfx.lineStyle(4,0xffffff,0.95);
    this.selectionGfx.strokeCircle(tw.x,tw.y,tw._size*0.72);
  }
};
