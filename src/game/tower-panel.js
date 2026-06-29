const TowerPanelMethods={
  towerStats(td,up,lv,tw=null){
    const rows=[];
    const add=(key,label,value)=>{
      if(value!==undefined&&value!==null&&value!=='')rows.push({key,label,value:String(value)})
    };
    if(td.type==='reactor'){
      this.addReactorStats(td,up,add);
      return rows
    }
    add('type','类型',this.towerTypeLabel(td));
    this.addTowerDamageStats(td,up,add);
    this.addTowerCommonStats(td,up,add,tw);
    this.addTowerTargetStats(td,up,add);
    this.addTowerSpecialStats(td,up,add);
    if(td.type==='drone')this.addDroneStats(td,up,add);
    add('special','定位',td.desc);
    return rows
  },
  addReactorStats(td,up,add){
    add('type','类型',td.id==='R0'?'主目标':'经济建筑');
    add('hp','HP上限',up.hp);
    add('production','能源产出',`${up.prod}/秒`);
    add('aggro','仇恨','全图兜底');
    add('danger','标称危险等级',3);
    add('repair','维修 / 出售','均不可');
    add('special','规则',td.desc)
  },
  towerTypeLabel(td){
    if(td.type==='path')return'路径塔';
    if(td.type==='block')return'阻挡塔';
    return'无人机核心'
  },
  addTowerDamageStats(td,up,add){
    if(td.id==='P6')add('damage','效果','每目标叠1层毒');
    else if(td.poisonAura)add('damage','效果','全范围叠毒');
    else if(td.id==='D3'){
      add('heal','单机维修',`${up.hl}/次`);
      add('selfCost','维修代价','治疗1HP＝自身-1HP')
    }else if(td.heal)add('heal','治疗',`${up.hl||td.heal}/秒`);
    else if((up.d||0)>0)add('damage','伤害',up.d);
    if(td.id==='B7')add('damage','自爆伤害',up.bm||td.boom)
  },
  displayTowerDanger(td,up,tw=null){
    if(tw&&td.id==='B3'&&this.meta?.b3Taunt&&typeof this.towerDanger==='function')return this.towerDanger(tw);
    return up.danger??td.danger
  },
  addTowerCommonStats(td,up,add,tw=null){
    if(up.i)add('interval',td.id==='D3'?'维修间隔':'攻击间隔',`${(up.i/1000).toFixed(1)}秒`);
    if(up.r)add('range','作用范围',up.r);
    if(up.hp)add('hp',td.type==='drone'?'无人机HP':'HP上限',up.hp);
    if(td.type==='block')add('danger','危险等级',this.displayTowerDanger(td,up,tw))
  },
  addTowerTargetStats(td,up,add){
    if(td.chain){
      add('targets','总目标',up.targets);
      add('chainRange','分叉半径',up.cr);
      return
    }
    if(td.id==='P4')add('targets','目标数',up.n||1);
    else if(td.id==='P6')add('targets','挂毒目标',up.ps||1);
    else if(td.id==='P7')add('targets','目标数',up.n||1);
    else if(td.splash)add('aoe','AOE半径',up.s||td.splash);
    else if(['B2','B4','B6','B7'].includes(td.id))add('targets','作用目标','范围内全部')
  },
  addTowerSpecialStats(td,up,add){
    if(td.id==='P4')add('slow','减速','40% / 2秒');
    if(td.id==='P5')add('focus','同目标增伤',`+${up.focus}/发`);
    if(td.id==='P6'||td.id==='B6')add('poison','毒伤','2/跳×4＝8/层');
    if(td.id==='P7')add('poisonBonus','中毒追加',`+${up.pb||td.poisonBonus}`);
    if(td.id==='B1')add('wreck','残骸','200HP / 20秒重生');
    if(td.id==='B2')add('mode','攻击方式','持续范围灼烧');
    if(td.id==='B4')add('mode','攻击方式','主动脉冲＋受击反击')
  },
  addDroneStats(td,up,add){
    add('coreHp','核心HP',up.coreHp);
    add('danger','危险等级',up.danger);
    add('capacity','无人机上限',up.md);
    add('production','生产间隔',`${(up.prod/1000).toFixed(0)}秒`);
    add('replacementCost','补员耗能',`${td.droneCost} / 架`);
    if(td.id!=='D3')add('first','首次出手',`${(td.first/1000).toFixed(1)}秒`);
    add('regen','脱战回血','2/秒')
  },
  updTwPanel(){
    const panel=document.getElementById('twPanel');
    this.upgradePreviewGfx.clear();
    const ctx=this.selectedTowerContext();
    if(!ctx){
      panel.style.display='none';
      return
    }
    panel.style.display='block';
    document.getElementById('twName').textContent=ctx.td.name+' Lv'+(ctx.lv+1);
    this.renderTowerStats(ctx);
    this.renderDroneEnergyButton(ctx);
    this.renderUpgradePreview(ctx);
    this.renderSellButton(ctx)
  },
  selectedTowerContext(){
    const tw=this.selTw;
    if(!tw||!tw.active)return null;
    const td=tw._type,lv=tw._lv||0,up=td.upg[lv],nextLevel=lv+1,nx=td.upg[nextLevel];
    const rows=this.towerStats(td,up,lv,tw);
    if(td.type==='block'||td.type==='reactor'){
      rows.splice(1,0,{key:'currentHp',label:'当前耐久',value:`${Math.ceil(tw._hp||0)} / ${tw._maxhp||up.hp}`})
    }
    if(td.type==='drone'){
      rows.splice(1,0,{key:'coreHpNow',label:'核心耐久',value:`${Math.ceil(tw._hp||0)} / ${tw._maxhp||up.coreHp}`});
      rows.splice(1,0,{key:'currentUnits',label:'现有无人机',value:`${this.droneCount(tw)} / ${up.md}`})
    }
    return{tw,td,lv,up,nextLevel,nx,rows}
  },
  renderTowerStats(ctx){
    const html='<div class="tw-section">'+ctx.rows.map(row=>this.towerStatRowHtml(row)).join('')+'</div>';
    const statsEl=document.getElementById('twStats');
    if(statsEl.innerHTML!==html)statsEl.innerHTML=html
  },
  towerStatRowHtml(row){
    return `<div class="tw-row"><span>${row.label}</span><span class="v">${row.value}</span></div>`
  },
  renderDroneEnergyButton(ctx){
    const btn=document.getElementById('btnDroneEnergy');
    btn.style.display=ctx.td.type==='drone'?'block':'none';
    if(ctx.td.type!=='drone')return;
    const allowed=ctx.tw._energySpend!==false;
    btn.textContent=`自动补员耗能：${allowed?'允许':'拒绝'}`;
    btn.className=`drone-energy ${allowed?'on':'off'}`
  },
  renderUpgradePreview(ctx){
    const previewEl=document.getElementById('twUpgradePreview'),btn=document.getElementById('btnUpgrade');
    if(!ctx.nx){
      const max='<div class="tw-preview tw-max">已达到最高等级</div>';
      if(previewEl.innerHTML!==max)previewEl.innerHTML=max;
      btn.style.display='none';
      return
    }
    const html=this.upgradePreviewHtml(ctx);
    if(previewEl.innerHTML!==html)previewEl.innerHTML=html;
    btn.style.display='block';
    document.getElementById('twUpCost').textContent=ctx.nx.c+'⚡';
    btn.className='upg'+(this.en>=ctx.nx.c&&!this.channel?'':' cant');
    this.drawUpgradeRangePreview(ctx)
  },
  upgradePreviewHtml(ctx){
    const current=new Map(ctx.rows.map(row=>[row.key,row.value]));
    const nextRows=this.towerStats(ctx.td,ctx.nx,ctx.nextLevel,ctx.tw);
    const changes=nextRows.filter(row=>current.get(row.key)!==row.value);
    const rows=changes.map(row=>{
      const oldValue=current.get(row.key)??'-';
      return `<div class="tw-row"><span>${row.label}</span><span class="v">${oldValue} <span class="tw-next">→ ${row.value}</span></span></div>`
    }).join('');
    return '<div class="tw-preview"><div class="tw-preview-title">升级预览 · Lv'+(ctx.nextLevel+1)+'</div>'+rows+'</div>'
  },
  drawUpgradeRangePreview(ctx){
    if(ctx.td.type==='reactor')return;
    const nextRange=sd(this.effectiveTowerRange?this.effectiveTowerRange(ctx.td,ctx.nx):(ctx.nx.r||ctx.td.range)),tw=ctx.tw;
    this.upgradePreviewGfx.lineStyle(2,0x44ff88,0.45);
    for(let a=0;a<Math.PI*2;a+=0.3){
      this.upgradePreviewGfx.lineBetween(
        tw.x+Math.cos(a)*nextRange,
        tw.y+Math.sin(a)*nextRange,
        tw.x+Math.cos(a+0.16)*nextRange,
        tw.y+Math.sin(a+0.16)*nextRange
      )
    }
  },
  renderSellButton(ctx){
    const sell=document.getElementById('btnSell');
    sell.style.display=ctx.td.type==='reactor'?'none':'block';
    sell.className='sell'+(this.channel?' cant':'');
    if(ctx.td.type!=='reactor')document.getElementById('twSell').textContent=this.sellRefund(ctx.tw)+'⚡'
  },
  toggleDroneEnergy(){
    const tw=this.selTw;
    if(this.isPaused||!tw||!tw.active||tw._type.type!=='drone')return;
    tw._energySpend=tw._energySpend===false;
    this.updTwPanel();
  },
  upgradeBlockReason(){
    if(!this.selTw||!this.selTw.active)return'未选择可升级建筑';
    if(this.channel)return this.channel.kind==='upgrade'?'升级读条进行中':'已有建造读条进行中';
    if(this.isPaused)return'暂停时不能开始升级';
    if(this.shipDead)return'飞船重生后才能升级';

    const tw=this.selTw,td=tw._type,nl=(tw._lv||0)+1;
    if(nl>=td.upg.length)return'已达到最高等级';
    if(this.en<td.upg[nl].c)return`能量不足，还需 ${Math.ceil(td.upg[nl].c-this.en)}⚡`;
    if(this.isEnemyTestMode?.())return'';
    if(Phaser.Math.Distance.Between(this.ship.x,this.ship.y,tw.x,tw.y)>sd(SHIP_RNG)){
      return'距离过远，请进入 1200 码操作范围';
    }
    return'';
  },
  updUpgradeHint(message){
    const hint=document.getElementById('twActionHint');
    const btn=document.getElementById('btnUpgrade');
    if(!hint||!btn)return;

    const reason=message??this.upgradeBlockReason();
    hint.textContent=reason;
    hint.className='tw-action-hint'+(reason&&this.channel?.kind==='upgrade'?' ok':'');
    if(btn.style.display!=='none')btn.className='upg'+(reason?' cant':'');
  },
  upgradeTower(){
    const reason=this.upgradeBlockReason();
    if(reason){
      this.updUpgradeHint(reason);
      return
    }

    const tw=this.selTw,td=tw._type,lv=tw._lv||0,nl=lv+1;
    if(this.isEnemyTestMode?.()){
      this.applyUpgrade(tw);
      this.updPanel();
      this.updTwPanel();
      this.updUpgradeHint('沙盒模式：升级已立即完成');
      return
    }
    this.channel={
      kind:'upgrade',
      tw,
      fromLevel:lv,
      cost:td.upg[nl].c,
      elapsed:0,
      duration:UPGRADE_TIME[nl]||2500,
      label:`升级 ${td.name} → Lv${nl+1}`
    };
    this.updChannelPanel();
    this.updPanel();
    this.updTwPanel();
    this.updUpgradeHint('升级读条进行中');
  },
  applyUpgrade(tw){
    const td=tw._type,lv=tw._lv||0,nl=lv+1,nxt=td.upg[nl];
    if(!nxt)return;
    this.en-=nxt.c;
    tw._lv=nl;
    this.applyTowerHpUpgrade(tw,td,lv,nxt);
    this.applyDroneCoreHpUpgrade(tw,td,lv,nxt);
    this.applyDroneHpUpgrade(tw,td,nxt);
    this.refreshTowerRangeGraphic(tw,td,nxt);
    if(td.type==='reactor'&&tw._label)tw._label.setText(td.name+' Lv'+(nl+1));
    this.tweens.add({targets:tw,scaleX:1.5,scaleY:1.5,duration:200,yoyo:true})
  },
  applyTowerHpUpgrade(tw,td,lv,nxt){
    if((td.type!=='block'&&td.type!=='reactor')||!nxt.hp)return;
    const oldHp=this.effectiveTowerHp?this.effectiveTowerHp(td,td.upg[lv]):td.upg[lv].hp||0;
    const nextHp=this.effectiveTowerHp?this.effectiveTowerHp(td,nxt):nxt.hp;
    tw._hp=Math.min((tw._hp||0)+(nextHp-oldHp),nextHp);
    tw._maxhp=nextHp
  },
  applyDroneCoreHpUpgrade(tw,td,lv,nxt){
    if(td.type!=='drone'||!nxt.coreHp)return;
    const oldHp=td.upg[lv].coreHp||tw._maxhp||nxt.coreHp;
    tw._hp=Math.min((tw._hp||0)+(nxt.coreHp-oldHp),nxt.coreHp);
    tw._maxhp=nxt.coreHp
  },
  applyDroneHpUpgrade(tw,td,nxt){
    if(td.type!=='drone')return;
    this.droneHelpers.children.iterate(d=>{
      if(!d||!d.active||d._owner!==tw)return;
      const ratio=d._maxhp?d._hp/d._maxhp:1;
      d._maxhp=nxt.hp;
      d._hp=Math.max(1,nxt.hp*ratio)
    })
  },
  refreshTowerRangeGraphic(tw,td,up){
    if(!tw._rngGfx)return;
    tw._rngGfx.clear();
    tw._rngGfx.lineStyle(1,this.towerRangeColor(td),0.12);
    tw._rngGfx.strokeCircle(tw.x,tw.y,sd(this.effectiveTowerRange?this.effectiveTowerRange(td,up):(up.r||td.range)))
  },
  sellTower(){
    const tw=this.selTw;
    if(!this.canSellTower(tw))return;
    if(tw._type?.id==='B7'&&this.meta.b7Manual){
      this.explodeB7(tw);
      if(tw._rngGfx)tw._rngGfx.destroy();
      tw.destroy();
      this.selTw=null;
      this.selectionGfx.clear();
      this.updTwPanel();
      return
    }
    this.gainEnergy(this.sellRefund(tw));
    if(tw._type?.type==='drone'){
      this.destroyDroneCore(tw);
      this.selTw=null;
      this.selectionGfx.clear();
      this.updTwPanel();
      return
    }
    if(tw._rngGfx)tw._rngGfx.destroy();
    tw.destroy();
    this.selTw=null;
    this.selectionGfx.clear();
    this.updTwPanel()
  },
  canSellTower(tw){
    return !this.isPaused&&!this.channel&&tw&&tw.active&&tw._type.type!=='reactor'
  },
  sellRefund(tw){
    const td=tw._type,lv=tw._lv||0;
    if(td.id==='B7'&&this.meta.b7Manual)return 0;
    const buildCost=tw._buildCost??td.cost;
    const invested=td.upg.slice(0,lv+1).reduce((sum,up)=>sum+(up.c||0),buildCost);
    const ratio=td.id==='P1'&&this.meta.p1Recycle?0.9:0.5;
    return Math.floor(invested*ratio)
  }
};
