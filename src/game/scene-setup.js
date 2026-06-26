const SceneSetupMethods={
  initSceneState(){
    const ctx=this.launchContext||{};
    this.selTowers=ctx.selIds||[];
    this.mode=ctx.mode||'endless1';
    this.levelConfig=ctx.levelConfig||null;
    this.gridPF=ctx.gridPF||[];
    this.meta=metaEffects();
    this.ended=false;
    this.completedWaves=0;
  },
  configureWorldBounds(){
    const mw=mapW(),mh=mapH();
    this.cameras.main.setBounds(0,0,mw,mh);
    this.physics.world.setBounds(0,0,mw,mh);
  },
  createBackdrop(){
    const mw=mapW(),mh=mapH();
    const bg=this.add.graphics().setDepth(-10);
    bg.fillStyle(BLUEPRINT_ART.bg);
    bg.fillRect(0,0,mw,mh);
    bg.lineStyle(0.5,BLUEPRINT_ART.bgGrid,0.035);
    for(let x=0;x<=mw;x+=50){
      bg.moveTo(x,0);
      bg.lineTo(x,mh);
    }
    for(let y=0;y<=mh;y+=50){
      bg.moveTo(0,y);
      bg.lineTo(mw,y);
    }
    bg.strokePath();
    bg.lineStyle(1,BLUEPRINT_ART.bgGrid,0.08);
    for(let x=0;x<=mw;x+=200){
      bg.moveTo(x,0);
      bg.lineTo(x,mh);
    }
    for(let y=0;y<=mh;y+=200){
      bg.moveTo(0,y);
      bg.lineTo(mw,y);
    }
    bg.strokePath();
    bg.lineStyle(3,BLUEPRINT_ART.cyan,0.42);
    bg.strokeRect(1,1,mw-2,mh-2);
    bg.lineStyle(1,BLUEPRINT_ART.white,0.18);
    bg.strokeRect(12,12,mw-24,mh-24);
  },
  createWalls(){
    this.wallGrp=this.physics.add.staticGroup();
    MAP.walls.forEach(wall=>this.createWall(wall));
  },
  createWall([x,y,w,h]){
    const r=this.add.rectangle(x+w/2,y+h/2,w,h,BLUEPRINT_ART.wall,0.95);
    r.setStrokeStyle(1,BLUEPRINT_ART.wallEdge,0.34);
    this.physics.add.existing(r,true);
    this.wallGrp.add(r);
  },
  createGameGroups(){
    this.towers=this.physics.add.staticGroup();
    this.blockers=this.physics.add.staticGroup();
    this.drones=this.physics.add.staticGroup();
    this.enemies=this.physics.add.group();
    this.missiles=this.physics.add.group();
    this.bolts=this.physics.add.group();
    this.p3Shells=this.add.group();
    this.poisonBolts=this.add.group();
    this.droneHelpers=this.physics.add.group();
  },
  createMainReactor(){
    const rx=MAP.reactor.x;
    const ry=MAP.reactor.y;
    const rxSize=sd(MAIN_REACTOR.tSize);
    this.rxHP=RX_HP;
    this.rxSpr=this.add.image(rx,ry,'reactor').setDisplaySize(rxSize,rxSize).setDepth(1);
    this.rxSpr._hp=RX_HP;
    this.rxSpr._maxhp=RX_HP;
    this.rxSpr._isReactor=true;
    this.rxSpr._isMainReactor=true;
    this.rxSpr._type=MAIN_REACTOR;
    this.rxSpr._lv=0;
    this.rxSpr._size=rxSize;
    this.reactors=[this.rxSpr];
    this.rxBar=this.add.graphics().setDepth(11);
    this.rxSpr._label=this.add.text(rx,ry+rxSize*0.6,'主反应炉 Lv1',textStyle(18,'#7ec8e3'))
      .setOrigin(0.5)
      .setDepth(11);
    this.makeReactorInteractive(this.rxSpr);
  },
  createSpawnMarkers(){
    this.spawnMarkers=[];
    MAP.spawns.forEach((spawn,i)=>this.createSpawnMarker(spawn,i));
  },
  createSpawnMarker([sx,sy],i){
    this.spawnMarkers.push(this.add.image(sx,sy,'spawn').setAlpha(0.7).setDepth(1));
    this.add.text(sx,sy,'入口 '+(i+1),textStyle(13,'#e94560')).setOrigin(0.5).setDepth(1);
  },
  createShip(){
    const spawn=this.resolveShipSpawn();
    this.ship=this.physics.add.image(spawn.x,spawn.y,'ship').setDepth(10);
    this.ship.body.setCircle(24,6,6);
    this.ship.setCollideWorldBounds(true);
    this.physics.add.collider(this.ship,this.wallGrp);
    this.rng=this.add.image(0,0,'rng').setDepth(5).setAlpha(0.2).setScale(unitScale());
  },
  resolveShipSpawn(){
    const mw=mapW(),mh=mapH();
    const grid=this.gridPF?.length?this.gridPF:buildGrid(MAP);
    const candidates=[
      MAP.playerSpawn,
      {x:mw/2,y:mh/2},
      MAP.reactor,
      MAP.paths?.[0]?.at(-1),
      MAP.spawns?.[0]
    ].filter(Boolean).map(pathPoint);
    const maxRadius=Math.max(grid.length,grid[0]?.length||0);
    for(const preferred of candidates){
      const raw={
        c:Math.floor(preferred.x/CELL),
        r:Math.floor(preferred.y/CELL)
      };
      const cell=nearestOpenCell(grid,raw.c,raw.r,maxRadius);
      if(cell){
        return {
          x:Phaser.Math.Clamp(cell.c*CELL+CELL/2,80,mw-80),
          y:Phaser.Math.Clamp(cell.r*CELL+CELL/2,80,mh-80)
        };
      }
    }
    return {
      x:mw/2,
      y:mh/2
    };
  },
  createRuntimeGraphics(){
    this.ghost=this.add.image(0,0,'ghP1').setDepth(12).setAlpha(0.8).setVisible(false);
    this.ghostRng=this.add.graphics().setDepth(12);
    this.selectionGfx=this.add.graphics().setDepth(2);
    this.overlay=this.add.graphics().setDepth(15);
    this.upgradePreviewGfx=this.add.graphics().setDepth(14);
    this.fxLine=this.add.graphics().setDepth(16);
    this.channelGfx=this.add.graphics().setDepth(18);
  },
  setupPhysicsCollisions(){
    this.physics.add.collider(this.enemies,this.wallGrp);
    this.physics.add.collider(this.enemies,this.blockers);
    this.physics.add.collider(this.droneHelpers,this.wallGrp);
    this.physics.add.overlap(this.ship,this.enemies,()=>this.killShip());
  },
  resetRunState(){
    this.en=EN_START;
    this.wave=1;
    this.wC=0;
    this.wS=0;
    this.wActive=false;
    this.prepTimer=PREP_TIME;
    this.mslTmr=0;
    this.bld=false;
    this.sel=this.selTowers[0];
    this.selTw=null;
    this.channel=null;
    this.shipDead=false;
    this.isPaused=false;
    this._buildLatch=false;
    this.shipMoveTarget=null;
    this.enemySeq=0;
  }
};
