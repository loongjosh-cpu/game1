const META_SAVE_KEY='r32-meta-v1';
const DEFAULT_VIEW_SETTINGS={cameraMode:'local'};

function safeStorageGet(key){
  try{
    return localStorage.getItem(key);
  }catch(err){
    console.warn('本地存储读取失败，使用默认数据',key,err);
    return null;
  }
}

function safeStorageSet(key,value){
  try{
    localStorage.setItem(key,value);
    return true;
  }catch(err){
    console.warn('本地存储写入失败，本次设置仅在当前页面生效',key,err);
    return false;
  }
}

function loadMetaSave(){
  try{
    const raw=JSON.parse(safeStorageGet(META_SAVE_KEY)||'null');
    return normalizeMetaSave(raw);
  }catch(err){
    console.warn('专精芯片存档读取失败',err);
    return emptyMetaSave();
  }
}

function emptyMetaSave(){
  return {cores:0,bestWave:0,nodes:{},ownedChips:{},equippedChips:{},levelClears:{},settings:{...DEFAULT_VIEW_SETTINGS}};
}

function normalizeChipFlags(rawFlags){
  const flags={},validIds=new Set(META_NODES.map(n=>n.id));
  if(rawFlags&&typeof rawFlags==='object'){
    Object.keys(rawFlags).forEach(id=>{
      if(validIds.has(id)&&rawFlags[id])flags[id]=true;
    });
  }
  return flags;
}

function normalizeMetaSave(raw){
  const settings={
    ...DEFAULT_VIEW_SETTINGS,
    ...(raw?.settings&&typeof raw.settings==='object'?raw.settings:{})
  };
  if(!['local','global'].includes(settings.cameraMode))settings.cameraMode=DEFAULT_VIEW_SETTINGS.cameraMode;
  delete settings.miniMap;
  const levelClears={};
  if(raw?.levelClears&&typeof raw.levelClears==='object'){
    Object.keys(raw.levelClears).forEach(id=>{if(raw.levelClears[id])levelClears[id]=true});
  }
  const oldNodes=normalizeChipFlags(raw?.nodes);
  const ownedChips={
    ...oldNodes,
    ...normalizeChipFlags(raw?.ownedChips)
  };
  const equippedChips={
    ...oldNodes,
    ...normalizeChipFlags(raw?.equippedChips)
  };
  Object.keys(equippedChips).forEach(id=>{
    if(!ownedChips[id])delete equippedChips[id];
  });
  return {
    cores:Math.max(0,Number(raw?.cores)||0),
    bestWave:Math.max(0,Number(raw?.bestWave)||0),
    nodes:{...equippedChips},
    ownedChips,
    equippedChips,
    levelClears,
    settings
  };
}

let metaSave=loadMetaSave();

function saveMeta(){
  if(metaSave?.equippedChips)metaSave.nodes={...metaSave.equippedChips};
  safeStorageSet(META_SAVE_KEY,JSON.stringify(metaSave));
}

function syncMetaNodeAlias(){
  metaSave.nodes={...metaSave.equippedChips};
}

function ownsChip(id){return !!metaSave.ownedChips?.[id]}
function isChipEquipped(id){return !!metaSave.equippedChips?.[id]}
function hasMeta(id){return isChipEquipped(id)}

function chipRequirementsMet(node,predicate){
  return (node.req||[]).every(predicate);
}

function enforceEquippedRequirements(){
  let changed=true;
  while(changed){
    changed=false;
    META_NODES.forEach(node=>{
      if(isChipEquipped(node.id)&&!chipRequirementsMet(node,isChipEquipped)){
        delete metaSave.equippedChips[node.id];
        changed=true;
      }
    });
  }
  syncMetaNodeAlias();
}

function metaEffects(){
  const shipSpeedFlat=500
    +(hasMeta('ship_speed_1')?50:0)
    +(hasMeta('ship_speed_2')?50:0);
  const shipSpeedMult=(hasMeta('ship_speed_3')?1.1:1)
    *(hasMeta('ship_speed_4')?1.1:1);

  return {
    shipSpeed:shipSpeedFlat*shipSpeedMult,
    missileDamage:20+(hasMeta('ship_damage_1')?5:0)+(hasMeta('ship_damage_2')?8:0),
    missileCd:8000-(hasMeta('ship_cd_1')?1000:0)-(hasMeta('ship_cd_2')?1000:0),
    missileTargets:1+(hasMeta('ship_multi_1')?1:0)+(hasMeta('ship_multi_2')?1:0),
    missileBlast:hasMeta('ship_blast'),
    p1Double:hasMeta('tower_p1'),
    p2Stop:hasMeta('tower_p2'),
    p3Residual:hasMeta('tower_p3'),
    p4Slow:hasMeta('tower_p4'),
    p5Focus:hasMeta('tower_p5'),
    p7Poison:hasMeta('tower_p7'),
    b1Repair:hasMeta('tower_b1'),
    b3Leech:hasMeta('tower_b3'),
    b4Shield:hasMeta('tower_b4')
  };
}
