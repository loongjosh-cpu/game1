function launch(sel,mode='endless1'){
  const selIds=sel.map(i=>ALL_TOWERS[i]);
  const levelConfig=LEVELS[mode]||null;
  const endlessConfig=ENDLESS_MAPS[mode]||null;
  MAP=cloneMap(levelConfig?.map||endlessConfig?.map||ENDLESS_MAP);
  const nav=buildNavigation(MAP);
  const enemyPaths=nav.enemyPaths;
  const enemyWaypoints=nav.enemyWaypoints;
  const gridPF=nav.gridPF;
  class GameScene extends Phaser.Scene{
    constructor(){
      super('Game');
      this.launchContext={selIds,mode,levelConfig,gridPF};
    }
    preload(){
      genTwTex(this);
      this.createShipTexture();
      this.createRangeTexture();
      this.createReactorTextures();
      this.createSpawnTexture();
      this.createEnemyTextures();
      this.createProjectileTextures();
    }
    create(){
      this.initSceneState();
      this.configureWorldBounds();
      this.createBackdrop();
      this.createWalls();
      this.createGameGroups();
      this.createMainReactor();
      this.createSpawnMarkers();
      this.createShip();
      this.createRuntimeGraphics();
      this.setupPhysicsCollisions();
      this.resetRunState();
      this.setupInputHandlers();
      this.bindTowerPanelButtons();
      this.rebuildPanel();
      this.initMiniMap();
      this.applyViewSettings();
    }
    smallReactorCount(){return this.reactors.filter(r=>this.reactorAlive(r)&&!r._isMainReactor).length}
    energyRate(){return this.reactors.reduce((sum,r)=>sum+(this.reactorAlive(r)?r._type.upg[r._lv||0].prod:0),0)}
    gainEnergy(v){this.en=Math.min(EN_CAP,this.en+v)}
    update(t,dt){
      if(this.isPaused||!dt)return;this.gainEnergy(this.energyRate()*dt/1000);
      this.updateShip(dt);
      this.updateChannel(dt);
      // Build ghost
      this.updateBuildGhost(t);
      // Ship missile
      this.updateShipMissiles(dt);
      this.drawSelectedTowerRange(t);
      // Tower attacks and support effects
      this.updateTowers(dt);
      // Drone cores accumulate units over time; first unit is created immediately.
      this.updateDroneCores(dt);
      this.updateDroneHelpers(dt);
      // Projectiles
      this.updateProjectiles(dt);

      this.updateEnemies(dt);

      // Waves
      this.updateWaves(dt);if(this.ended)return;
      // HP bars
      this.renderOverlayBars();
      this.updateHud(t,dt);
      this.updateMiniMap(dt);
    }

  }
  Object.assign(GameScene.prototype,TextureFactoryMethods,SceneSetupMethods,MiniMapMethods,InputControllerMethods,BuildPanelMethods,PlacementControllerMethods,TowerPanelMethods,DroneControllerMethods,CombatUtilMethods,TowerCombatMethods,ProjectileControllerMethods,EnemyControllerMethods,PlayerRuntimeMethods,HudOverlayMethods);
  const game=new Phaser.Game({type:Phaser.AUTO,width:W,height:H,backgroundColor:'#0d1219',parent:'gamePage',scale:{mode:Phaser.Scale.ENVELOP,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:GameScene});
  setTimeout(()=>document.querySelector('canvas')?.focus(),500);
  return game;
}
