const META_UI_STATE={
  equipGroup:'tower',
  shopGroup:'ship',
  equipSelected:null,
  shopSelected:null,
  equipSlotKey:null
};

const META_GROUP_LABELS={
  ship:{
    title:'舰载系统',
    hint:'飞船与主反应炉芯片。适合先强化移动、导弹与前期经济节奏。'
  },
  tower:{
    title:'防御塔',
    hint:'先选择防御塔槽位，再将已拥有的专精芯片拖入槽位安装。每座塔只能装备一个芯片。'
  }
};

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function metaNodesByGroup(group){
  return META_NODES.filter(n=>n.group===group);
}

function towerByChip(node){
  return node.tower?ALL_TOWERS.find(t=>t.id===node.tower):null;
}

function nodeState(node){
  const owned=ownsChip(node.id);
  const equipped=isChipEquipped(node.id);
  const ready=chipRequirementsMet(node,ownsChip);
  const equipReady=chipRequirementsMet(node,isChipEquipped);
  return {
    owned,
    equipped,
    ready,
    equipReady,
    canBuy:!owned&&ready&&metaSave.cores>=node.cost,
    canEquip:owned&&!equipped&&equipReady
  };
}

function missingShopRequirements(node){
  return (node.req||[])
    .filter(id=>!ownsChip(id))
    .map(id=>META_NODES.find(n=>n.id===id)?.name||id);
}

function missingEquipRequirements(node){
  return (node.req||[])
    .filter(id=>!isChipEquipped(id))
    .map(id=>META_NODES.find(n=>n.id===id)?.name||id);
}

function shopNodeButtonText(state){
  if(state.owned)return '已拥有';
  if(!state.ready)return '前置未获得';
  return state.canBuy?'购买芯片':'星核不足';
}

function equipNodeButtonText(state){
  if(!state.owned)return '未拥有';
  if(state.equipped)return '卸下芯片';
  if(!state.equipReady)return '前置未装备';
  return '装备芯片';
}

function chipStatusText(state,mode){
  if(mode==='shop'){
    if(state.owned)return '已拥有';
    if(!state.ready)return '锁定';
    if(state.canBuy)return '可购买';
    return '星核不足';
  }
  if(!state.owned)return '未拥有';
  if(state.equipped)return '已装备';
  if(state.canEquip)return '可装备';
  return '前置未装备';
}

function chipStatusClass(state,mode){
  if(mode==='shop'){
    if(state.owned)return 'owned';
    if(!state.ready)return 'locked';
    if(state.canBuy)return 'ready';
    return 'locked';
  }
  if(state.equipped)return 'equipped';
  if(state.owned)return 'owned';
  return 'locked';
}

function chipKicker(node){
  const tower=towerByChip(node);
  if(tower)return `${tower.id} · ${tower.name}`;
  if(node.mutex==='poison')return '全局毒药协议';
  if(node.id.startsWith('reactor_'))return '主反应炉协议';
  return '飞船系统';
}

function chipMetaLine(node){
  const tower=towerByChip(node);
  if(tower)return `${towerTypeName(tower)} · 建造 ${tower.cost}能量`;
  if(node.mutex==='poison')return '毒系全局改造 · 三选一';
  return node.id.startsWith('reactor_')?'经济补给 · 波次收益':'舰载火控 · 飞船强化';
}

function chipIconText(node){
  const tower=towerByChip(node);
  if(tower)return tower.id;
  if(node.id.startsWith('reactor_'))return '炉';
  if(node.mutex==='poison')return '毒';
  if(node.id.includes('speed'))return '速';
  if(node.id.includes('damage'))return '弹';
  if(node.id.includes('cd'))return '填';
  if(node.id.includes('multi'))return '锁';
  if(node.id.includes('blast'))return '爆';
  return '芯';
}

function chipCardHtml(node,mode){
  const state=nodeState(node);
  const selected=(mode==='shop'?META_UI_STATE.shopSelected:META_UI_STATE.equipSelected)===node.id;
  const reqNames=mode==='shop'?missingShopRequirements(node):missingEquipRequirements(node);
  const reqText=reqNames.length?`前置：${reqNames.join('、')}`:'前置满足';
  return [
    `<button type="button" class="metaNode ${chipStatusClass(state,mode)} ${selected?'selected':''}" data-chip-select="${mode}" data-chip-id="${node.id}">`,
    `<span class="metaNodeIcon">${escapeHtml(chipIconText(node))}</span>`,
    '<span class="metaNodeBody">',
    `<strong>${escapeHtml(node.name)}</strong>`,
    `<em>${escapeHtml(chipKicker(node))}</em>`,
    `<small>${escapeHtml(reqText)}</small>`,
    '</span>',
    `<span class="metaNodeState">${escapeHtml(chipStatusText(state,mode))}</span>`,
    '</button>'
  ].join('');
}

function emptyDetailHtml(mode){
  return [
    '<div class="metaDetailEmpty">',
    `<strong>${mode==='shop'?'选择商品':'选择芯片'}</strong>`,
    '<span>查看芯片效果、前置条件与当前状态。</span>',
    '</div>'
  ].join('');
}

function chipDetailHtml(node,mode){
  if(!node)return emptyDetailHtml(mode);
  const state=nodeState(node);
  const reqNames=mode==='shop'?missingShopRequirements(node):missingEquipRequirements(node);
  const reqHtml=reqNames.length
    ?`<div class="metaDetailReq">尚缺：${escapeHtml(reqNames.join('、'))}</div>`
    :'<div class="metaDetailReq ok">前置条件已满足</div>';
  const action=mode==='shop'
    ?`<button class="metaActionBtn" data-chip-buy="${node.id}" ${state.canBuy?'':'disabled'}>${shopNodeButtonText(state)}</button>`
    :`<button class="metaActionBtn" data-chip-toggle="${node.id}" ${state.owned&&(state.equipped||state.canEquip)?'':'disabled'}>${equipNodeButtonText(state)}</button>`;
  return [
    '<div class="metaDetailTitle">',
    `<span class="metaDetailIcon">${escapeHtml(chipIconText(node))}</span>`,
    '<div>',
    `<h3>${escapeHtml(node.name)}</h3>`,
    `<p>${escapeHtml(chipKicker(node))}</p>`,
    '</div>',
    '</div>',
    `<div class="metaDetailDesc">${escapeHtml(node.desc)}</div>`,
    '<div class="metaDetailStats">',
    `<div><b>状态</b><span>${escapeHtml(chipStatusText(state,mode))}</span></div>`,
    `<div><b>消耗</b><span>◇ ${node.cost} 星核</span></div>`,
    `<div><b>归属</b><span>${escapeHtml(chipMetaLine(node))}</span></div>`,
    '</div>',
    reqHtml,
    action
  ].join('');
}

function towerEquipUnits(){
  const units=ALL_TOWERS
    .map(tower=>({
      id:tower.id,
      slotKey:`tower:${tower.id}`,
      name:tower.name,
      type:towerTypeName(tower),
      desc:tower.desc,
      icon:tower.id,
      nodes:META_NODES.filter(node=>node.group==='tower'&&node.tower===tower.id)
    }))
    .filter(unit=>unit.nodes.length);
  const poisonNodes=META_NODES.filter(node=>node.group==='tower'&&node.mutex==='poison');
  if(poisonNodes.length){
    units.push({
      id:'poison',
      slotKey:'mutex:poison',
      name:'毒药协议',
      type:'全局毒系规则',
      desc:'所有毒系塔共享一个毒药槽位；三种毒药芯片只能装备一个。',
      icon:'毒',
      nodes:poisonNodes
    });
  }
  return units;
}

function equippedChipForUnit(unit){
  return unit.nodes.find(node=>isChipEquipped(node.id))||null;
}

function selectedEquipUnit(){
  const units=towerEquipUnits();
  if(!units.length)return null;
  if(!units.some(unit=>unit.slotKey===META_UI_STATE.equipSlotKey)){
    META_UI_STATE.equipSlotKey=units[0].slotKey;
  }
  return units.find(unit=>unit.slotKey===META_UI_STATE.equipSlotKey)||units[0];
}

function ensureTowerEquipSelection(){
  const unit=selectedEquipUnit();
  if(!unit)return;
  const selected=META_NODES.find(node=>node.id===META_UI_STATE.equipSelected);
  if(!selected||chipMutexKey(selected)!==unit.slotKey){
    META_UI_STATE.equipSelected=equippedChipForUnit(unit)?.id||unit.nodes[0]?.id||null;
  }
}

function chipCanInstallToUnit(node,unit){
  if(!node||!unit)return false;
  return ownsChip(node.id)&&chipRequirementsMet(node,isChipEquipped)&&chipMutexKey(node)===unit.slotKey;
}

function unitSlotState(unit){
  const equipped=equippedChipForUnit(unit);
  if(equipped)return {label:'已安装',className:'filled',chip:equipped};
  const ownedReady=unit.nodes.filter(node=>chipCanInstallToUnit(node,unit));
  if(ownedReady.length)return {label:'空槽 · 可安装',className:'ready',chip:null};
  const owned=unit.nodes.some(node=>ownsChip(node.id));
  return {label:owned?'空槽 · 前置未满足':'空槽',className:owned?'blocked':'empty',chip:null};
}

function unitButtonHtml(unit){
  const slot=unitSlotState(unit);
  const selected=unit.slotKey===META_UI_STATE.equipSlotKey;
  return [
    `<button type="button" class="loadoutUnit ${selected?'selected':''}" data-equip-unit="${unit.slotKey}">`,
    `<span class="loadoutUnitIcon">${escapeHtml(unit.icon)}</span>`,
    '<span class="loadoutUnitBody">',
    `<strong>${escapeHtml(unit.id)} · ${escapeHtml(unit.name)}</strong>`,
    `<small>${escapeHtml(unit.type)}</small>`,
    '</span>',
    `<span class="loadoutUnitState ${slot.className}">${escapeHtml(slot.label)}</span>`,
    '</button>'
  ].join('');
}

function loadoutChipHtml(node,unit){
  const state=nodeState(node);
  const selected=META_UI_STATE.equipSelected===node.id;
  const canInstall=chipCanInstallToUnit(node,unit);
  const lockedText=!state.owned?'未拥有':(!state.equipReady?'前置未装备':(state.equipped?'已安装':'可安装'));
  return [
    `<button type="button" class="loadoutChip ${chipStatusClass(state,'equip')} ${selected?'selected':''}" data-chip-select="equip" data-chip-id="${node.id}" ${canInstall?'draggable="true" data-chip-drag="true"':''}>`,
    `<span class="loadoutChipIcon">${escapeHtml(chipIconText(node))}</span>`,
    '<span class="loadoutChipBody">',
    `<strong>${escapeHtml(node.name)}</strong>`,
    `<small>${escapeHtml(lockedText)} · ◇${node.cost}</small>`,
    '</span>',
    `${canInstall&&!state.equipped?`<span class="loadoutChipAction" data-chip-install="${node.id}">安装</span>`:''}`,
    '</button>'
  ].join('');
}

function loadoutSlotHtml(unit){
  const equipped=equippedChipForUnit(unit);
  if(!equipped){
    return [
      `<div class="loadoutSlot empty" data-equip-slot="${unit.slotKey}">`,
      '<span class="loadoutSlotIcon">＋</span>',
      '<strong>空槽位</strong>',
      '<p>将下方已拥有芯片拖入此处，或点击芯片上的“安装”。</p>',
      '</div>'
    ].join('');
  }
  return [
    `<div class="loadoutSlot filled" data-equip-slot="${unit.slotKey}">`,
    `<span class="loadoutSlotIcon">${escapeHtml(chipIconText(equipped))}</span>`,
    '<div>',
    `<strong>${escapeHtml(equipped.name)}</strong>`,
    `<p>${escapeHtml(equipped.desc)}</p>`,
    '</div>',
    `<button type="button" class="loadoutUnequipBtn" data-chip-toggle="${equipped.id}">卸下</button>`,
    '</div>'
  ].join('');
}

function renderTowerEquipLoadout(grid){
  ensureTowerEquipSelection();
  const units=towerEquipUnits();
  const unit=selectedEquipUnit();
  if(!unit){
    grid.innerHTML='<div class="metaDetailEmpty"><strong>暂无塔芯片</strong><span>购买芯片后可在此安装。</span></div>';
    return;
  }
  grid.innerHTML=[
    '<div class="loadoutShell">',
    '<div class="loadoutUnits" aria-label="防御塔槽位">',
    units.map(unitButtonHtml).join(''),
    '</div>',
    '<div class="loadoutPanel">',
    '<div class="loadoutPanelHead">',
    '<div>',
    `<h4>${escapeHtml(unit.id)} · ${escapeHtml(unit.name)}</h4>`,
    `<p>${escapeHtml(unit.desc)}</p>`,
    '</div>',
    `<span>${escapeHtml(unit.type)}</span>`,
    '</div>',
    loadoutSlotHtml(unit),
    '<div class="loadoutTrayTitle">可用芯片</div>',
    '<div class="loadoutTray">',
    unit.nodes.map(node=>loadoutChipHtml(node,unit)).join(''),
    '</div>',
    '</div>',
    '</div>'
  ].join('');
}

function ensureSelected(mode){
  const group=mode==='shop'?META_UI_STATE.shopGroup:META_UI_STATE.equipGroup;
  const key=mode==='shop'?'shopSelected':'equipSelected';
  if(mode==='equip'&&group==='tower'){
    ensureTowerEquipSelection();
    return;
  }
  const nodes=metaNodesByGroup(group);
  if(!nodes.some(n=>n.id===META_UI_STATE[key])){
    META_UI_STATE[key]=nodes[0]?.id||null;
  }
}

function updateMetaGroupChrome(mode){
  const group=mode==='shop'?META_UI_STATE.shopGroup:META_UI_STATE.equipGroup;
  const labels=META_GROUP_LABELS[group];
  const titleId=mode==='shop'?'metaShopTitle':'metaEquipTitle';
  const hintId=mode==='shop'?'metaShopHint':'metaEquipHint';
  const summaryId=mode==='shop'?'metaShopSummary':'metaEquipSummary';
  const title=document.getElementById(titleId);
  const hint=document.getElementById(hintId);
  const summary=document.getElementById(summaryId);
  if(title)title.textContent=labels.title;
  if(hint)hint.textContent=labels.hint;
  const nodes=metaNodesByGroup(group);
  let summaryText='';
  if(mode==='shop'){
    summaryText=`${nodes.filter(n=>nodeState(n).canBuy).length} 可购买`;
  }else if(group==='tower'){
    const units=towerEquipUnits();
    summaryText=`${units.filter(unit=>equippedChipForUnit(unit)).length}/${units.length} 槽已安装`;
  }else{
    summaryText=`${nodes.filter(n=>nodeState(n).equipped).length} 已装备`;
  }
  if(summary)summary.textContent=summaryText;
  document.querySelectorAll(`[data-meta-screen="${mode}"]`).forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.metaGroup===group);
  });
}

function setMetaGroup(mode,group){
  if(!META_GROUP_LABELS[group])return;
  if(mode==='shop')META_UI_STATE.shopGroup=group;
  else META_UI_STATE.equipGroup=group;
  ensureSelected(mode);
  renderMetaScreen(mode);
}

function renderMetaScreen(mode){
  ensureSelected(mode);
  updateMetaGroupChrome(mode);
  const group=mode==='shop'?META_UI_STATE.shopGroup:META_UI_STATE.equipGroup;
  const gridId=mode==='shop'?(group==='ship'?'shopShipGrid':'shopTowerGrid'):(group==='ship'?'shipMetaGrid':'towerMetaGrid');
  const otherGridIds=mode==='shop'?['shopShipGrid','shopTowerGrid']:['shipMetaGrid','towerMetaGrid'];
  otherGridIds.forEach(id=>{
    const grid=document.getElementById(id);
    if(!grid)return;
    grid.classList.toggle('active',id===gridId);
    grid.classList.toggle('loadoutGrid',mode==='equip'&&group==='tower'&&id===gridId);
  });
  const grid=document.getElementById(gridId);
  if(grid){
    if(mode==='equip'&&group==='tower')renderTowerEquipLoadout(grid);
    else grid.innerHTML=metaNodesByGroup(group).map(node=>chipCardHtml(node,mode)).join('');
  }
  const selectedId=mode==='shop'?META_UI_STATE.shopSelected:META_UI_STATE.equipSelected;
  const detail=document.getElementById(mode==='shop'?'metaShopDetail':'metaEquipDetail');
  if(detail)detail.innerHTML=chipDetailHtml(META_NODES.find(n=>n.id===selectedId),mode);
  bindMetaUiButtons();
}

function bindMetaUiButtons(){
  document.querySelectorAll('[data-meta-screen][data-meta-group]').forEach(btn=>{
    btn.onclick=()=>setMetaGroup(btn.dataset.metaScreen,btn.dataset.metaGroup);
  });
  document.querySelectorAll('[data-equip-unit]').forEach(btn=>{
    btn.onclick=()=>{
      META_UI_STATE.equipSlotKey=btn.dataset.equipUnit;
      ensureTowerEquipSelection();
      renderMetaScreen('equip');
    };
  });
  document.querySelectorAll('[data-chip-select]').forEach(btn=>{
    btn.onclick=event=>{
      if(event.target?.dataset?.chipInstall)return;
      const mode=btn.dataset.chipSelect;
      if(mode==='shop')META_UI_STATE.shopSelected=btn.dataset.chipId;
      else META_UI_STATE.equipSelected=btn.dataset.chipId;
      renderMetaScreen(mode);
    };
  });
  document.querySelectorAll('[data-chip-toggle]').forEach(btn=>{
    btn.onclick=()=>toggleChip(btn.dataset.chipToggle);
  });
  document.querySelectorAll('[data-chip-buy]').forEach(btn=>{
    btn.onclick=()=>buyChip(btn.dataset.chipBuy);
  });
  document.querySelectorAll('[data-chip-install]').forEach(btn=>{
    btn.onclick=event=>{
      event.stopPropagation();
      installChipToSelectedSlot(btn.dataset.chipInstall);
    };
  });
  document.querySelectorAll('[data-chip-drag]').forEach(btn=>{
    btn.ondragstart=event=>{
      event.dataTransfer?.setData('text/plain',btn.dataset.chipId);
      event.dataTransfer?.setData('application/x-r32-chip',btn.dataset.chipId);
      btn.classList.add('dragging');
    };
    btn.ondragend=()=>btn.classList.remove('dragging');
  });
  document.querySelectorAll('[data-equip-slot]').forEach(slot=>{
    slot.ondragover=event=>{
      event.preventDefault();
      slot.classList.add('dragOver');
    };
    slot.ondragleave=()=>slot.classList.remove('dragOver');
    slot.ondrop=event=>{
      event.preventDefault();
      slot.classList.remove('dragOver');
      const id=event.dataTransfer?.getData('application/x-r32-chip')||event.dataTransfer?.getData('text/plain');
      if(id)installChipToSelectedSlot(id,slot.dataset.equipSlot);
    };
  });
}

function renderMeta(){
  enforceEquippedRequirements();
  renderHome();
  renderMetaScreen('equip');
}

function renderShop(){
  renderHome();
  renderMetaScreen('shop');
}

function buyChip(id){
  const node=META_NODES.find(n=>n.id===id);
  if(!node)return;
  const state=nodeState(node);
  if(!state.canBuy)return;
  metaSave.cores-=node.cost;
  metaSave.ownedChips[id]=true;
  syncMetaNodeAlias();
  saveMeta();
  META_UI_STATE.shopSelected=id;
  renderShop();
  renderTowerArchive();
}

function installChipToSelectedSlot(id,slotKey=META_UI_STATE.equipSlotKey){
  const node=META_NODES.find(n=>n.id===id);
  if(!node||!ownsChip(id))return;
  const unit=towerEquipUnits().find(unit=>unit.slotKey===slotKey);
  if(!unit||chipMutexKey(node)!==unit.slotKey)return;
  if(!chipRequirementsMet(node,isChipEquipped))return;
  unequipConflictingChips(node);
  metaSave.equippedChips[id]=true;
  enforceEquippedRequirements();
  saveMeta();
  META_UI_STATE.equipSlotKey=unit.slotKey;
  META_UI_STATE.equipSelected=id;
  renderMeta();
  renderTowerArchive();
}

function toggleChip(id){
  const node=META_NODES.find(n=>n.id===id);
  if(!node||!ownsChip(id))return;
  if(isChipEquipped(id)){
    delete metaSave.equippedChips[id];
  }else{
    const state=nodeState(node);
    if(!state.canEquip)return;
    unequipConflictingChips(node);
    metaSave.equippedChips[id]=true;
    if(node.group==='tower')META_UI_STATE.equipSlotKey=chipMutexKey(node);
  }
  enforceEquippedRequirements();
  saveMeta();
  META_UI_STATE.equipSelected=id;
  renderMeta();
  renderTowerArchive();
}
