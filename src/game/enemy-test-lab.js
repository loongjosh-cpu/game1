const ENEMY_TEST_MODE='enemyCombatTest';
const ENEMY_TEST_MAP={
  kind:'test-map',
  id:ENEMY_TEST_MODE,
  name:'怪物攻击测试场',
  unitScale:1,
  worldSize:{w:1600,h:960},
  walls:[
    [40,40,1520,24],
    [40,896,1520,24],
    [40,40,24,880],
    [1536,40,24,880],
    [700,170,24,620],
    [1050,170,24,620]
  ],
  spawns:[[260,480]],
  reactor:{x:1280,y:480},
  playerSpawn:{x:820,y:480},
  routes:[[[260,480],[600,480],[880,480],[1280,480]]]
};

const ENEMY_TEST_TARGETS=[
  {id:'B1',label:'钢塔靶标',kind:'block',tower:'B1',x:820,y:300},
  {id:'B3',label:'重型炮塔靶标',kind:'block',tower:'B3',x:820,y:480},
  {id:'D1',label:'无人机靶标',kind:'drone',tower:'D1',x:820,y:660},
  {id:'reactor',label:'主反应炉',kind:'reactor',x:1280,y:480}
];

const EnemyTestLabMethods={
  isEnemyTestMode(){
    return this.mode===ENEMY_TEST_MODE;
  },
  setupEnemyTestLab(){
    if(!this.isEnemyTestMode())return;
    this.en=9999;
    this.prepTimer=999999999;
    this.wActive=false;
    this.completedWaves=0;
    this._enemyTestTarget='B1';
    this._enemyTestSpawnCount=0;
    this._enemyTestTargets=[];
    this.createEnemyTestTargets();
    this.createEnemyTestLabels();
    this.bindEnemyTestPanel();
    this.updateEnemyTestPanel();
    this.cameras.main.centerOn(800,480);
    this.cameras.main.setZoom(0.95);
  },
  updateEnemyTestLab(dt){
    if(!this.isEnemyTestMode())return;
    this._enemyTestUiClock=(this._enemyTestUiClock||0)+dt;
    if(this._enemyTestUiClock<250)return;
    this._enemyTestUiClock=0;
    this.updateEnemyTestPanel();
  },
  createEnemyTestTargets(){
    ENEMY_TEST_TARGETS.forEach(spec=>{
      if(spec.kind==='reactor')return;
      const td=ALL_TOWERS.find(t=>t.id===spec.tower);
      if(!td)return;
      const tw=this.createTowerSprite(td,spec.x,spec.y);
      tw._enemyTestId=spec.id;
      tw._enemyTestLabel=spec.label;
      tw._buildCost=0;
      this.registerTowerByType(tw,td);
      tw._maxhp=Math.max(tw._maxhp||0,9999);
      tw._hp=tw._maxhp;
      this.makeTowerInteractive(tw);
      this._enemyTestTargets.push(tw);
      if(td.type==='drone'){
        this.ensureEnemyTestDrone(tw);
      }
    });
    this.rxSpr._enemyTestId='reactor';
    this.rxSpr._enemyTestLabel='主反应炉';
    this.rxSpr._maxhp=Math.max(this.rxSpr._maxhp||0,9999);
    this.rxSpr._hp=this.rxSpr._maxhp;
    this.rxHP=this.rxSpr._hp;
  },
  ensureEnemyTestDrone(core){
    let helper=null;
    this.droneHelpers.children.iterate(d=>{
      if(!helper&&d&&d.active&&d._owner===core)helper=d;
    });
    if(!helper)this.spawnDrone(core);
    this.droneHelpers.children.iterate(d=>{
      if(d&&d.active&&d._owner===core){
        d.setPosition(core.x-70,core.y);
        d._patrol={x:d.x,y:d.y};
        d._maxhp=Math.max(d._maxhp||0,999);
        d._hp=d._maxhp;
        d._target=null;
        d._engaged=false;
      }
    });
  },
  createEnemyTestLabels(){
    this.add.text(96,92,'怪物攻击测试场',textStyle(26,'#9fe8ff')).setDepth(20);
    this.add.text(96,126,'选择怪物与靶标后生成。不会自动出波，适合复现攻击、弹道、分裂、自爆和反应炉伤害。',textStyle(14,'#8aa7b8')).setDepth(20);
    ENEMY_TEST_TARGETS.forEach(spec=>{
      this.add.text(spec.x,spec.y+62,spec.label,textStyle(14,'#9fe8ff')).setOrigin(0.5).setDepth(20);
    });
  },
  bindEnemyTestPanel(){
    const panel=document.getElementById('enemyTestPanel');
    if(!panel)return;
    panel.style.display='block';
    this.fillEnemyTestSelects();
    document.getElementById('enemyTestSpawn').onclick=()=>this.spawnEnemyTestSelection(1);
    document.getElementById('enemyTestSpawnPack').onclick=()=>this.spawnEnemyTestSelection(5);
    document.getElementById('enemyTestResetTargets').onclick=()=>this.resetEnemyTestTargets();
    document.getElementById('enemyTestClear').onclick=()=>this.clearEnemyTestEnemies();
    document.getElementById('enemyTestEnemy').onchange=()=>this.updateEnemyTestPanel();
    document.getElementById('enemyTestTarget').onchange=e=>{
      this._enemyTestTarget=e.target.value;
      this.updateEnemyTestPanel();
    };
  },
  fillEnemyTestSelects(){
    const enemySel=document.getElementById('enemyTestEnemy');
    const targetSel=document.getElementById('enemyTestTarget');
    if(enemySel&&!enemySel.dataset.ready){
      enemySel.innerHTML=Object.keys(EC).map(id=>`<option value="${id}">${id} · ${EC[id].name}</option>`).join('');
      enemySel.dataset.ready='1';
    }
    if(targetSel&&!targetSel.dataset.ready){
      targetSel.innerHTML=ENEMY_TEST_TARGETS.map(t=>`<option value="${t.id}">${t.label}</option>`).join('');
      targetSel.dataset.ready='1';
    }
  },
  spawnEnemyTestSelection(count=1){
    const enemySel=document.getElementById('enemyTestEnemy');
    const type=enemySel?.value||'E1';
    for(let i=0;i<count;i++){
      const offset=(i-(count-1)/2)*34;
      const e=this.spawnAt(type,260,480+offset,0,false);
      e._enemyTest=true;
      e._enemyTestSerial=++this._enemyTestSpawnCount;
      this.assignEnemyTestTarget(e,this._enemyTestTarget||'B1');
    }
    this.logEnemyTest(`生成 ${count} 个 ${type}，目标：${this.enemyTestTargetLabel(this._enemyTestTarget)}`);
    this.updateEnemyTestPanel();
  },
  assignEnemyTestTarget(e,targetId){
    const target=this.enemyTestTargetById(targetId);
    if(!target)return;
    e._b1tgt=null;
    e._droneTarget=null;
    e._reactorTarget=null;
    if(targetId==='reactor'){
      e._reactorTarget=this.rxSpr;
      this.setRoute(e,this.makeRoute(e.x,e.y,this.rxSpr.x,this.rxSpr.y));
      return;
    }
    if(target._type?.type==='drone'){
      const helper=this.enemyTestFirstDrone(target);
      e._droneTarget=helper||target;
      if(e._droneTarget)this.setRoute(e,this.makeRoute(e.x,e.y,e._droneTarget.x,e._droneTarget.y));
      return;
    }
    e._b1tgt=target;
    this.setRoute(e,this.makeRoute(e.x,e.y,target.x,target.y));
  },
  enemyTestFirstDrone(core){
    let helper=null;
    this.droneHelpers.children.iterate(d=>{
      if(!helper&&d&&d.active&&d._owner===core)helper=d;
    });
    return helper;
  },
  enemyTestTargetById(id){
    if(id==='reactor')return this.rxSpr;
    let found=null;
    [...this.blockers.children.entries,...this.drones.children.entries].forEach(t=>{
      if(!found&&t&&t.active&&t._enemyTestId===id)found=t;
    });
    return found;
  },
  enemyTestTargetLabel(id){
    return ENEMY_TEST_TARGETS.find(t=>t.id===id)?.label||id;
  },
  resetEnemyTestTargets(){
    this.blockers.children.iterate(t=>{
      if(t&&t.active&&t._enemyTestId){
        t._hp=t._maxhp;
        t._shield=0;
      }
    });
    this.drones.children.iterate(t=>{
      if(t&&t.active&&t._enemyTestId){
        t._hp=t._maxhp;
        this.ensureEnemyTestDrone(t);
      }
    });
    this.droneHelpers.children.iterate(d=>{
      if(d&&d.active){
        d._hp=d._maxhp;
        d._target=null;
        d._engaged=false;
      }
    });
    this.rxSpr._hp=this.rxSpr._maxhp;
    this.rxHP=this.rxSpr._hp;
    this.logEnemyTest('靶标血量已重置');
    this.updateEnemyTestPanel();
  },
  clearEnemyTestEnemies(){
    this.enemies.children.iterate(e=>{if(e&&e.active)e.destroy()});
    this.logEnemyTest('已清除所有怪物');
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
  updateEnemyTestPanel(){
    if(!this.isEnemyTestMode())return;
    const enemySel=document.getElementById('enemyTestEnemy');
    const info=document.getElementById('enemyTestInfo');
    const hp=document.getElementById('enemyTestHp');
    const type=enemySel?.value||'E1';
    const cfg=EC[type];
    if(info&&cfg){
      const traits=[
        cfg.rangeAtk?'远程炮弹':null,
        cfg.droneRange?'优先无人机':null,
        cfg.selfDestruct?'自爆':null,
        cfg.split?'死亡分裂':null,
        cfg.hatch?'周期孵化':null,
        cfg.summons?'周期召唤':null,
        cfg.meleeSplash?'近战附带范围':null,
        cfg.leech?'吸血':null
      ].filter(Boolean).join(' / ')||'普通攻击';
      info.textContent=`${type} · HP ${cfg.hp} · 伤害 ${cfg.dmg} · 间隔 ${cfg.atk/1000}s · ${traits}`;
    }
    if(hp){
      const rows=[];
      ENEMY_TEST_TARGETS.forEach(spec=>{
        const target=this.enemyTestTargetById(spec.id);
        if(!target)return;
        rows.push(`${spec.label}: ${Math.max(0,Math.round(target._hp||0))}/${Math.round(target._maxhp||0)}`);
        if(spec.id==='D1'){
          const helper=this.enemyTestFirstDrone(target);
          if(helper)rows.push(`无人机个体: ${Math.max(0,Math.round(helper._hp||0))}/${Math.round(helper._maxhp||0)}`);
        }
      });
      hp.innerHTML=rows.map(r=>`<div>${r}</div>`).join('');
    }
  }
};
