const META_UI_STATE={
  equipGroup:'ship',
  shopGroup:'ship',
  equipSelected:null,
  shopSelected:null
};

const META_GROUP_LABELS={
  ship:{title:'舰载系统',hint:'飞船与主反应炉芯片。适合先强化移动、导弹与前期经济节奏。'},
  tower:{title:'防御塔',hint:'防御塔专精芯片。购买后在整备舱装备，对应塔才会获得效果。'}
};

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
  return metaSave.cores>=0&&state.canBuy?'购买芯片':'星核不足';
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
  if(node.id.startsWith('reactor_'))return '主反应炉协议';
  return '飞船系统';
}

function chipMetaLine(node){
  const tower=towerByChip(node);
  if(tower)return `${towerTypeName(tower)} · 建造 ${tower.cost}⚡`;
  return node.id.startsWith('reactor_')?'经济补给 · 波次收益':'舰载火控 · 飞船强化';
}

function chipIconText(node){
  const tower=towerByChip(node);
  if(tower)return tower.id;
  if(node.id.startsWith('reactor_'))return '炉';
  if(node.id.includes('speed'))return '速';
  if(node.id.includes('damage'))return '弹';
  if(node.id.includes('cd'))return '装';
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
    `<span class="metaNodeIcon">${chipIconText(node)}</span>`,
    '<span class="metaNodeBody">',
    `<strong>${node.name}</strong>`,
    `<em>${chipKicker(node)}</em>`,
    `<small>${reqText}</small>`,
    '</span>',
    `<span class="metaNodeState">${chipStatusText(state,mode)}</span>`,
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
    ?`<div class="metaDetailReq">尚缺：${reqNames.join('、')}</div>`
    :'<div class="metaDetailReq ok">前置条件已满足</div>';
  const action=mode==='shop'
    ?`<button class="metaActionBtn" data-chip-buy="${node.id}" ${state.canBuy?'':'disabled'}>${shopNodeButtonText(state)}</button>`
    :`<button class="metaActionBtn" data-chip-toggle="${node.id}" ${state.owned&&(state.equipped||state.canEquip)?'':'disabled'}>${equipNodeButtonText(state)}</button>`;
  return [
    '<div class="metaDetailTitle">',
    `<span class="metaDetailIcon">${chipIconText(node)}</span>`,
    '<div>',
    `<h3>${node.name}</h3>`,
    `<p>${chipKicker(node)}</p>`,
    '</div>',
    '</div>',
    `<div class="metaDetailDesc">${node.desc}</div>`,
    '<div class="metaDetailStats">',
    `<div><b>状态</b><span>${chipStatusText(state,mode)}</span></div>`,
    `<div><b>消耗</b><span>◈ ${node.cost} 星核</span></div>`,
    `<div><b>归属</b><span>${chipMetaLine(node)}</span></div>`,
    '</div>',
    reqHtml,
    action
  ].join('');
}

function ensureSelected(mode){
  const group=mode==='shop'?META_UI_STATE.shopGroup:META_UI_STATE.equipGroup;
  const key=mode==='shop'?'shopSelected':'equipSelected';
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
  const summaryText=mode==='shop'
    ?`${nodes.filter(n=>nodeState(n).canBuy).length} 可购买`
    :`${nodes.filter(n=>nodeState(n).equipped).length} 已装备`;
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
    if(grid)grid.classList.toggle('active',id===gridId);
  });
  const grid=document.getElementById(gridId);
  if(grid)grid.innerHTML=metaNodesByGroup(group).map(node=>chipCardHtml(node,mode)).join('');
  const selectedId=mode==='shop'?META_UI_STATE.shopSelected:META_UI_STATE.equipSelected;
  const detail=document.getElementById(mode==='shop'?'metaShopDetail':'metaEquipDetail');
  if(detail)detail.innerHTML=chipDetailHtml(META_NODES.find(n=>n.id===selectedId),mode);
  bindMetaUiButtons();
}

function bindMetaUiButtons(){
  document.querySelectorAll('[data-meta-screen][data-meta-group]').forEach(btn=>{
    btn.onclick=()=>setMetaGroup(btn.dataset.metaScreen,btn.dataset.metaGroup);
  });
  document.querySelectorAll('[data-chip-select]').forEach(btn=>{
    btn.onclick=()=>{
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

function toggleChip(id){
  const node=META_NODES.find(n=>n.id===id);
  if(!node||!ownsChip(id))return;
  if(isChipEquipped(id)){
    delete metaSave.equippedChips[id];
  }else{
    const state=nodeState(node);
    if(!state.canEquip)return;
    metaSave.equippedChips[id]=true;
  }
  enforceEquippedRequirements();
  saveMeta();
  META_UI_STATE.equipSelected=id;
  renderMeta();
  renderTowerArchive();
}
