function launch(sel,mode='endless1'){
  if(typeof r32SetLoading==='function')r32SetLoading('读取配置',mode,0.14);
  const selIds=sel.map(i=>ALL_TOWERS[i]);
  const levelConfig=LEVELS[mode]||null;
  const endlessConfig=ENDLESS_MAPS[mode]||null;
  const testMap=mode===ENEMY_TEST_MODE?ENEMY_TEST_MAP:null;
  if(typeof r32SetLoading==='function')r32SetLoading('准备地图',mode,0.22);
  MAP=cloneMap(testMap||levelConfig?.map||endlessConfig?.map||ENDLESS_MAP);
  if(typeof r32SetLoading==='function')r32SetLoading('计算寻路',`${MAP.spawns?.length||0} 入口`,0.34);
  const nav=buildNavigation(MAP);
  if(typeof r32SetLoading==='function')r32SetLoading('寻路完成',`${nav.enemyWaypoints?.length||0} 路线`,0.5);
  const enemyPaths=nav.enemyPaths;
  const enemyWaypoints=nav.enemyWaypoints;
  const gridPF=nav.gridPF;
  class GameScene extends Phaser.Scene{
    constructor(){
      super('Game');
      this.launchContext={selIds,mode,levelConfig,gridPF,enemyWaypoints};
    }
    launchStep(stage,detail,progress,fn){
      if(typeof r32SetLoading==='function')r32SetLoading(stage,detail,progress);
      try{
        return fn();
      }catch(err){
        if(typeof r32LoadingFailed==='function')r32LoadingFailed(err);
        if(typeof finishLaunchAttempt==='function')finishLaunchAttempt();
        throw err;
      }
    }
    preload(){
      this.launchStep('生成纹理','防御塔',0.6,()=>genTwTex(this));
      this.launchStep('生成纹理','飞船/范围/反应炉',0.63,()=>{
        this.createShipTexture();
        this.createRangeTexture();
        this.createReactorTextures();
      });
      this.launchStep('生成纹理','出生点/怪物/弹体',0.66,()=>{
        this.createSpawnTexture();
        this.createEnemyTextures();
        this.createProjectileTextures();
      });
    }
    create(){
      this.launchStep('创建场景','初始化状态',0.68,()=>{
        this.initSceneState();
        this.time.paused=false;
        this.tweens.resumeAll();
        if(typeof initDebugOverlay==='function')initDebugOverlay();
      });
      this.launchStep('创建场景','世界边界/背景',0.72,()=>{
        this.configureWorldBounds();
        this.createBackdrop();
      });
      this.launchStep('创建场景','墙体/物理组',0.76,()=>{
        this.createWalls();
        this.createGameGroups();
      });
      this.launchStep('创建场景','反应炉/出生点',0.8,()=>{
        this.createMainReactor();
        this.createSpawnMarkers();
      });
      this.launchStep('创建场景','飞船/运行图层',0.84,()=>{
        this.createShip();
        this.createRuntimeGraphics();
        this.setupPhysicsCollisions();
      });
      this.launchStep('创建场景','输入与面板',0.88,()=>{
        this.resetRunState();
        this.setupInputHandlers();
        this.bindTowerPanelButtons();
        this.rebuildPanel();
      });
      this.launchStep('创建场景','视角/小地图/沙盒',0.92,()=>{
        this.initMiniMap();
        this.applyViewSettings();
        this.setupEnemyTestLab();
      });
      if(typeof r32SetLoading==='function')r32SetLoading('等待首帧','启动主循环',0.96);
    }
    smallReactorCount(){return this.reactors.filter(r=>this.reactorAlive(r)&&!r._isMainReactor).length}
    energyRate(){return this.reactors.reduce((sum,r)=>sum+(this.reactorAlive(r)?r._type.upg[r._lv||0].prod:0),0)}
    gainEnergy(v){this.en=Math.min(EN_CAP,this.en+v)}
    update(t,dt){
      if(!this._firstFrameSeen){
        this._firstFrameSeen=true;
        if(typeof r32SetLoading==='function')r32SetLoading('启动完成','进入战区',1);
        if(typeof r32HideLoading==='function')setTimeout(()=>r32HideLoading(),120);
        if(typeof finishLaunchAttempt==='function')finishLaunchAttempt();
      }
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
      if(!this.isEnemyTestMode())this.updateWaves(dt);if(this.ended)return;
      // HP bars
      this.renderOverlayBars();
      this.updateHud(t,dt);
      this.updateMiniMap(dt);
      this.updateEnemyTestLab(dt);
      if(typeof updateDebugOverlay==='function')updateDebugOverlay(this,t,dt);
    }

  }
  Object.assign(GameScene.prototype,TextureFactoryMethods,SceneSetupMethods,MiniMapMethods,InputControllerMethods,BuildPanelMethods,PlacementControllerMethods,TowerPanelMethods,DroneControllerMethods,CombatUtilMethods,TowerCombatMethods,ProjectileControllerMethods,EnemyControllerMethods,PlayerRuntimeMethods,HudOverlayMethods,EnemyTestLabMethods);
  const gameWidth=testMap?.worldSize?.w||W;
  const gameHeight=testMap?.worldSize?.h||H;
  const scaleMode=testMap?Phaser.Scale.FIT:Phaser.Scale.ENVELOP;
  if(typeof r32SetLoading==='function')r32SetLoading('创建渲染器',`${gameWidth}×${gameHeight}`,0.56);
  const game=new Phaser.Game({type:Phaser.AUTO,width:gameWidth,height:gameHeight,backgroundColor:'#0d1219',parent:'gamePage',scale:{mode:scaleMode,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'arcade',arcade:{gravity:{y:0}}},scene:GameScene});
  setTimeout(()=>document.querySelector('canvas')?.focus(),500);
  return game;
}
