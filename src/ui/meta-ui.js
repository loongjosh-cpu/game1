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

function shopNodeButtonText(state,node){
  if(state.owned)return '已拥有';
  if(!state.ready)return '前置未获得';
  return metaSave.cores>=node.cost?'购买':'星核不足';
}

function equipNodeButtonText(state,node){
  if(!state.owned)return '未拥有';
  if(state.equipped)return '已装备 · 点击卸下';
  if(!state.equipReady)return '前置未装备';
  return '装备';
}

function shopNodeHtml(node){
  const state=nodeState(node);
  const reqNames=missingShopRequirements(node);
  const reqHtml=reqNames.length?`<div class="req">前置：${reqNames.join('、')}</div>`:'';
  return [
    `<div class="metaNode ${state.owned?'owned':state.ready?'':'locked'}">`,
    `<h4>${node.name}</h4>`,
    `<div>${node.desc}</div>`,
    `<div class="price">◈ ${node.cost} 星核</div>`,
    `<div class="state">${state.owned?'已拥有':state.ready?'可购买':'需要前置芯片'}</div>`,
    reqHtml,
    `<button data-chip-buy="${node.id}" ${state.canBuy?'':'disabled'}>`,
    shopNodeButtonText(state,node),
    '</button>',
    '</div>'
  ].join('');
}

function equipNodeHtml(node){
  const state=nodeState(node);
  const reqNames=missingEquipRequirements(node);
  const reqHtml=reqNames.length&&!state.equipped?`<div class="req">需先装备：${reqNames.join('、')}</div>`:'';
  return [
    `<div class="metaNode ${state.equipped?'equipped':state.owned?'owned':'locked'}">`,
    `<h4>${node.name}</h4>`,
    `<div>${node.desc}</div>`,
    `<div class="state">${state.equipped?'已装备':state.owned?'已拥有 · 未装备':`未拥有 · ${node.cost} 星核`}</div>`,
    reqHtml,
    `<button data-chip-toggle="${node.id}" ${state.owned&&(state.equipped||state.canEquip)?'':'disabled'}>`,
    equipNodeButtonText(state,node),
    '</button>',
    '</div>'
  ].join('');
}

function towerMetaNodeCard(t){
  const node=META_NODES.find(n=>n.tower===t.id);
  if(!node)return [
    '<div class="metaNode locked">',
    `<h4>${t.id} · ${t.name}</h4>`,
    '<div>当前无专精芯片</div>',
    '</div>'
  ].join('');
  return [
    '<div class="archiveNode">',
    `<div class="archiveNodeTitle">${t.id} · ${t.name}</div>`,
    `<div>${towerTypeName(t)} · 建造 ${t.cost}⚡</div>`,
    equipNodeHtml(node),
    '</div>'
  ].join('');
}

function towerShopNodeCard(t){
  const node=META_NODES.find(n=>n.tower===t.id);
  if(!node)return [
    '<div class="metaNode locked">',
    `<h4>${t.id} · ${t.name}</h4>`,
    '<div>当前无专精芯片</div>',
    '</div>'
  ].join('');
  return [
    '<div class="archiveNode">',
    `<div class="archiveNodeTitle">${t.id} · ${t.name}</div>`,
    `<div>${towerTypeName(t)} · 建造 ${t.cost}⚡</div>`,
    shopNodeHtml(node),
    '</div>'
  ].join('');
}

function bindMetaButtons(){
  document
    .querySelectorAll('[data-chip-toggle]')
    .forEach(btn=>btn.onclick=()=>toggleChip(btn.dataset.chipToggle));
}

function bindShopButtons(){
  document
    .querySelectorAll('[data-chip-buy]')
    .forEach(btn=>btn.onclick=()=>buyChip(btn.dataset.chipBuy));
}

function renderMeta(){
  enforceEquippedRequirements();
  renderHome();
  const shipGrid=document.getElementById('shipMetaGrid');
  if(shipGrid)shipGrid.innerHTML=META_NODES
      .filter(n=>n.group==='ship')
      .map(equipNodeHtml)
      .join('');
  const towerMetaGrid=document.getElementById('towerMetaGrid');
  if(towerMetaGrid)towerMetaGrid.innerHTML=ALL_TOWERS
      .map(towerMetaNodeCard)
      .join('');
  bindMetaButtons();
}

function renderShop(){
  renderHome();
  const shipGrid=document.getElementById('shopShipGrid');
  if(shipGrid)shipGrid.innerHTML=META_NODES
      .filter(n=>n.group==='ship')
      .map(shopNodeHtml)
      .join('');
  const towerShopGrid=document.getElementById('shopTowerGrid');
  if(towerShopGrid)towerShopGrid.innerHTML=ALL_TOWERS
      .map(towerShopNodeCard)
      .join('');
  bindShopButtons();
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
  renderMeta();
  renderTowerArchive();
}
