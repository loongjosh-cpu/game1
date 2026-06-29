const ENEMY_TEST_MODE='enemyCombatTest';
const ENEMY_TEST_MAP={
  kind:'test-map',
  id:ENEMY_TEST_MODE,
  name:'怪物攻击沙盒',
  unitScale:1,
  worldSize:{w:1600,h:900},
  walls:[
    [0,0,1600,28],
    [0,872,1600,28],
    [0,0,28,900],
    [1572,0,28,900]
  ],
  spawns:[[120,450]],
  reactor:{x:1480,y:450},
  playerSpawn:{x:800,y:450},
  routes:[[[120,450],[1480,450]]]
};

const EnemyTestLabMethods={
  isEnemyTestMode(){
    return this.mode===ENEMY_TEST_MODE;
  },
  setupEnemyTestLab(){
    if(!this.isEnemyTestMode())return;
    this.configureEnemyTestSandbox();
    this.createEnemyTestLabels();
    this.bindEnemyTestPanel();
    this.rebuildPanel();
    this.updateEnemyTestPanel();
    this.applyEnemyTestCamera();
  },
  applyEnemyTestCamera(){
    const cam=this.cameras.main;
    cam.stopFollow();
    cam.setDeadzone(0,0);
    cam.setBounds(0,0,mapW(),mapH());
    cam.setZoom(1);
    cam.centerOn(mapW()/2,mapH()/2);
    if(this.miniMapWrap)this.miniMapWrap.style.display='none';
  },
  configureEnemyTestSandbox(){
    this.en=EN_CAP;
    this.prepTimer=999999999;
    this.wActive=false;
    this.completedWaves=0;
    this._enemyTestRunning=false;
    this._enemyTestSpawned=0;
    this._enemyTestTotal=0;
    this._enemyTestTimer=null;
    this._enemyTestUiClock=0;
    this.bld=true;
    this.sel=ALL_TOWERS[0];
    this.rxSpr._maxhp=Math.max(this.rxSpr._maxhp||0,99999);
    this.rxSpr._hp=this.rxSpr._maxhp;
    this.rxHP=this.rxSpr._hp;
    this.hideEnemyTestShip();
  },
  hideEnemyTestShip(){
    if(this.ship){
      this.ship.setVisible(false);
      this.ship.setAlpha(0);
      this.ship.setPosition(800,450);
      this.shipMoveTarget=null;
      if(this.ship.body){
        this.ship.body.setVelocity(0,0);
        this.ship.body.enable=false;
      }
    }
    if(this.rng)this.rng.setVisible(false);
  },
  updateEnemyTestLab(dt){
    if(!this.isEnemyTestMode())return;
    this.en=EN_CAP;
    this.hideEnemyTestShip();
    this.applyEnemyTestCamera();
    this._enemyTestUiClock+=dt;
    if(this._enemyTestUiClock<250)return;
    this._enemyTestUiClock=0;
    this.updateEnemyTestPanel();
  },
  enemyTestBuildChoices(){
    return [...ALL_TOWERS,SMALL_REACTOR];
  },
  createEnemyTestLabels(){
    this.add.text(82,82,'怪物攻击沙盒',textStyle(28,'#9fe8ff')).setDepth(20);
    this.add.text(82,118,'一条直线路径。无限能量，全塔可建；设置怪物类型与数量后点击开始。',textStyle(15,'#8aa7b8')).setDepth(20);
    this.add.text(120,488,'出生点',textStyle(14,'#e94560')).setOrigin(0.5).setDepth(20);
    this.add.text(1480,520,'主反应炉',textStyle(14,'#9fe8ff')).setOrigin(0.5).setDepth(20);
    const guide=this.add.graphics().setDepth(0);
    guide.lineStyle(8,0x4bc4ff,0.18);
    guide.lineBetween(120,450,1480,450);
    guide.lineStyle(1,0x9fe8ff,0.55);
    guide.lineBetween(120,450,1480,450);
  },
  bindEnemyTestPanel(){
    const panel=document.getElementById('enemyTestPanel');
    if(!panel)return;
    panel.style.display='block';
    this.resetEnemyTestPanelPosition(panel);
    this.bindEnemyTestPanelDrag(panel);
    this.fillEnemyTestSelects();
    document.getElementById('enemyTestStart').onclick=()=>this.startEnemyTestWave();
    document.getElementById('enemyTestStop').onclick=()=>this.stopEnemyTestWave(true);
    document.getElementById('enemyTestClear').onclick=()=>this.clearEnemyTestEnemies();
    document.getElementById('enemyTestReset').onclick=()=>this.resetEnemyTestSandbox();
    document.getElementById('enemyTestEnemy').onchange=()=>this.updateEnemyTestPanel();
    document.getElementById('enemyTestCount').oninput=()=>this.updateEnemyTestPanel();
  },
  resetEnemyTestPanelPosition(panel){
    panel.style.left='';
    panel.style.right='14px';
    panel.style.top='92px';
  },
  bindEnemyTestPanelDrag(panel){
    if(panel.dataset.dragReady)return;
    panel.dataset.dragReady='1';
    const handle=panel.querySelector('.enemyTestHead');
    if(!handle)return;
    let drag=null;
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const moveTo=(x,y)=>{
      const rect=panel.getBoundingClientRect();
      const maxX=Math.max(8,window.innerWidth-rect.width-8);
      const maxY=Math.max(8,window.innerHeight-rect.height-8);
      panel.style.left=clamp(x,8,maxX)+'px';
      panel.style.top=clamp(y,8,maxY)+'px';
      panel.style.right='auto';
    };
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const rect=panel.getBoundingClientRect();
      drag={dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      panel.classList.add('dragging');
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag)return;
      moveTo(event.clientX-drag.dx,event.clientY-drag.dy);
      event.preventDefault();
    });
    const stop=event=>{
      if(!drag)return;
      drag=null;
      panel.classList.remove('dragging');
      handle.releasePointerCapture?.(event.pointerId);
    };
    handle.addEventListener('pointerup',stop);
    handle.addEventListener('pointercancel',stop);
    window.addEventListener('resize',()=>{
      const rect=panel.getBoundingClientRect();
      moveTo(rect.left,rect.top);
    });
  },
  fillEnemyTestSelects(){
    const enemySel=document.getElementById('enemyTestEnemy');
    if(enemySel&&!enemySel.dataset.ready){
      enemySel.innerHTML=Object.keys(EC).map(id=>`<option value="${id}">${id} · ${EC[id].name}</option>`).join('');
      enemySel.dataset.ready='1';
    }
  },
  enemyTestType(){
    return document.getElementById('enemyTestEnemy')?.value||'E1';
  },
  enemyTestCount(){
    const raw=Number(document.getElementById('enemyTestCount')?.value||1);
    return Phaser.Math.Clamp(Math.floor(raw)||1,1,200);
  },
  enemyTestInterval(){
    const raw=Number(document.getElementById('enemyTestInterval')?.value||450);
    return Phaser.Math.Clamp(Math.floor(raw)||450,80,3000);
  },
  startEnemyTestWave(){
    if(this._enemyTestRunning)this.stopEnemyTestWave(false);
    const type=this.enemyTestType();
    const count=this.enemyTestCount();
    const interval=this.enemyTestInterval();
    this._enemyTestRunning=true;
    this._enemyTestSpawned=0;
    this._enemyTestTotal=count;
    this.spawnEnemyTestOne(type);
    this._enemyTestTimer=this.time.addEvent({
      delay:interval,
      loop:true,
      callback:()=>{
        if(!this._enemyTestRunning)return;
        if(this._enemyTestSpawned>=this._enemyTestTotal){
          this.stopEnemyTestWave(false);
          return;
        }
        this.spawnEnemyTestOne(type);
      }
    });
    this.logEnemyTest(`开始：${type} × ${count}`);
    this.updateEnemyTestPanel();
  },
  spawnEnemyTestOne(type){
    const e=this.spawnE(0,type);
    e._enemyTest=true;
    e._summoned=false;
    e._hp=e._maxhp=EC[type]?.hp||e._hp;
    this._enemyTestSpawned++;
    return e;
  },
  stopEnemyTestWave(clearEnemies=false){
    this._enemyTestRunning=false;
    if(this._enemyTestTimer){
      this._enemyTestTimer.remove();
      this._enemyTestTimer=null;
    }
    if(clearEnemies)this.clearEnemyTestEnemies(false);
    this.logEnemyTest(clearEnemies?'结束并清怪':'结束出怪');
    this.updateEnemyTestPanel();
  },
  clearEnemyTestEnemies(writeLog=true){
    this.enemies.children.iterate(e=>{if(e&&e.active)e.destroy()});
    if(writeLog)this.logEnemyTest('已清除所有怪物');
    this.updateEnemyTestPanel();
  },
  resetEnemyTestSandbox(){
    this.stopEnemyTestWave(false);
    this.clearEnemyTestEnemies(false);
    this.blockers.children.iterate(t=>{if(t&&t.active)t.destroy()});
    this.towers.children.iterate(t=>{if(t&&t.active)t.destroy()});
    this.drones.children.iterate(t=>{if(t&&t.active)t.destroy()});
    this.droneHelpers.children.iterate(d=>{if(d&&d.active)d.destroy()});
    this.reactors.filter(r=>!r._isMainReactor).forEach(r=>{if(r&&r.active)r.destroy()});
    this.reactors=[this.rxSpr];
    this.rxSpr._hp=this.rxSpr._maxhp;
    this.rxHP=this.rxSpr._hp;
    this.selTw=null;
    this.bld=true;
    this.rebuildPanel();
    this.logEnemyTest('沙盒已重置');
    this.updateEnemyTestPanel();
  },
  logEnemyTest(text){
    const log=document.getElementById('enemyTestLog');
    if(!log)return;
    const line=document.createElement('div');
    line.textContent=`${new Date().toLocaleTimeString()} ${text}`;
    log.prepend(line);
    while(log.children.length>6)log.lastChild.remove();
  },
  enemyTestActiveEnemyCount(){
    return this.enemies.countActive();
  },
  updateEnemyTestPanel(){
    if(!this.isEnemyTestMode())return;
    const info=document.getElementById('enemyTestInfo');
    const hp=document.getElementById('enemyTestHp');
    const type=this.enemyTestType();
    const cfg=EC[type];
    if(info&&cfg){
      const traits=[
        cfg.rangeAtk?'远程炮弹':null,
        cfg.droneRange?'优先无人机':null,
        cfg.selfDestruct?'自爆':null,
        cfg.split?'死亡分裂':null,
        cfg.hatch?'周期孵化':null,
        cfg.summons?'周期召唤':null,
        cfg.meleeSplash?'近战范围':null,
        cfg.leech?'吸血':null
      ].filter(Boolean).join(' / ')||'普通攻击';
      info.textContent=`${type} · HP ${cfg.hp} · 伤害 ${cfg.dmg} · 间隔 ${cfg.atk/1000}s · ${traits}`;
    }
    if(hp){
      const alive=this.enemyTestActiveEnemyCount();
      hp.innerHTML=[
        `状态：${this._enemyTestRunning?'出怪中':'待机'}`,
        `已生成：${this._enemyTestSpawned||0}/${this._enemyTestTotal||0}`,
        `场上怪物：${alive}`,
        `反应炉：${Math.max(0,Math.round(this.rxSpr._hp||0))}/${Math.round(this.rxSpr._maxhp||0)}`,
        `能量：无限`
      ].map(r=>`<div>${r}</div>`).join('');
    }
  }
};
