const META_SAVE_KEY='r32-meta-v1';
const META_SCHEMA_VERSION=2;
const META_BACKUP_KEYS=['r32-meta-backup-1','r32-meta-backup-2','r32-meta-backup-3','r32-meta-backup-4'];
const META_IDB_NAME='r32-save-db';
const META_IDB_STORE='meta';
const META_IDB_CURRENT='current';
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

function stableStringify(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function metaChecksum(data){
  const text=stableStringify(data);
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619)
  }
  return `r32-${(hash>>>0).toString(16).padStart(8,'0')}`
}

function packMetaSave(raw,updatedAt=Date.now()){
  const data=normalizeMetaSave(raw);
  if(data.equippedChips)data.nodes={...data.equippedChips};
  return {
    schemaVersion:META_SCHEMA_VERSION,
    updatedAt,
    checksum:metaChecksum(data),
    data
  }
}

function unpackMetaCandidate(raw,source='unknown'){
  if(!raw||typeof raw!=='object')return null;
  if(raw.data&&typeof raw.data==='object'){
    const data=normalizeMetaSave(raw.data);
    if(raw.checksum&&raw.checksum!==metaChecksum(data)){
      console.warn('存档校验失败，已忽略',source);
      return null
    }
    return {data,updatedAt:Math.max(0,Number(raw.updatedAt)||0),source,packaged:true}
  }
  return {data:normalizeMetaSave(raw),updatedAt:Math.max(0,Number(raw.updatedAt)||0),source,packaged:false}
}

function parseMetaCandidate(rawText,source){
  try{
    return unpackMetaCandidate(JSON.parse(rawText||'null'),source)
  }catch(err){
    console.warn('存档解析失败，已尝试使用其他备份',source,err);
    return null
  }
}

function chooseNewestValidMeta(candidates){
  return candidates.filter(Boolean).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0]||null
}

function loadMetaSave(){
  const candidates=[META_SAVE_KEY,...META_BACKUP_KEYS]
    .map(key=>parseMetaCandidate(safeStorageGet(key),key));
  const chosen=chooseNewestValidMeta(candidates);
  metaSaveLoadedAt=chosen?.updatedAt||0;
  if(chosen)return chosen.data;
  return emptyMetaSave();
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

let metaSaveLoadedAt=0;
let metaSave=loadMetaSave();

function rotateMetaBackups(){
  const current=safeStorageGet(META_SAVE_KEY);
  if(!parseMetaCandidate(current,META_SAVE_KEY))return;
  for(let i=META_BACKUP_KEYS.length-1;i>0;i--){
    const previous=safeStorageGet(META_BACKUP_KEYS[i-1]);
    if(previous)safeStorageSet(META_BACKUP_KEYS[i],previous);
  }
  safeStorageSet(META_BACKUP_KEYS[0],current);
}

function saveMeta(options={}){
  const normalized=normalizeMetaSave(metaSave);
  Object.keys(metaSave).forEach(key=>delete metaSave[key]);
  Object.assign(metaSave,normalized);
  if(metaSave?.equippedChips)metaSave.nodes={...metaSave.equippedChips};
  const packed=packMetaSave(metaSave,Date.now());
  metaSaveLoadedAt=packed.updatedAt;
  if(!options.skipBackup)rotateMetaBackups();
  safeStorageSet(META_SAVE_KEY,JSON.stringify(packed));
  writeMetaIndexedDb(packed);
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

function chipMutexKey(node){
  if(!node)return null;
  if(node.mutex)return `mutex:${node.mutex}`;
  if(node.group==='tower'&&node.tower)return `tower:${node.tower}`;
  return null;
}

function unequipConflictingChips(node){
  const key=chipMutexKey(node);
  if(!key)return;
  META_NODES.forEach(other=>{
    if(other.id!==node.id&&chipMutexKey(other)===key){
      delete metaSave.equippedChips[other.id];
    }
  });
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
  const keptByMutex={};
  META_NODES.forEach(node=>{
    if(!isChipEquipped(node.id))return;
    const key=chipMutexKey(node);
    if(!key)return;
    if(!keptByMutex[key]){
      keptByMutex[key]=node.id;
      return;
    }
    delete metaSave.equippedChips[node.id];
  });
  syncMetaNodeAlias();
}

enforceEquippedRequirements();

function openMetaIndexedDb(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){
      reject(new Error('IndexedDB unavailable'));
      return
    }
    const request=indexedDB.open(META_IDB_NAME,1);
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
    request.onupgradeneeded=()=>request.result.createObjectStore(META_IDB_STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result)
  })
}

function idbRequest(request){
  return new Promise((resolve,reject)=>{
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result)
  })
}

async function readMetaIndexedDb(){
  const db=await openMetaIndexedDb();
  try{
    const tx=db.transaction(META_IDB_STORE,'readonly');
    const record=await idbRequest(tx.objectStore(META_IDB_STORE).get(META_IDB_CURRENT));
    return unpackMetaCandidate(record?.payload||record,'indexedDB')
  }finally{
    db.close()
  }
}

async function writeMetaIndexedDb(packed){
  try{
    const db=await openMetaIndexedDb();
    try{
      const tx=db.transaction(META_IDB_STORE,'readwrite');
      await idbRequest(tx.objectStore(META_IDB_STORE).put({id:META_IDB_CURRENT,payload:packed}));
    }finally{
      db.close()
    }
  }catch(err){
    if(String(err?.message||err).includes('unavailable'))return;
    console.warn('IndexedDB存档写入失败，已保留localStorage存档',err)
  }
}

function refreshMetaUiAfterRestore(){
  try{
    if(typeof refreshStartButton==='function')refreshStartButton();
    if(typeof renderLoadoutGrids==='function')renderLoadoutGrids();
    if(typeof renderMeta==='function')renderMeta();
    if(typeof renderShop==='function')renderShop();
  }catch(err){
    console.warn('存档恢复后刷新界面失败',err)
  }
}

async function reconcileIndexedDbMetaSave(){
  try{
    const candidate=await readMetaIndexedDb();
    if(!candidate||candidate.updatedAt<=metaSaveLoadedAt)return;
    const normalized=normalizeMetaSave(candidate.data);
    Object.keys(metaSave).forEach(key=>delete metaSave[key]);
    Object.assign(metaSave,normalized);
    enforceEquippedRequirements();
    saveMeta({skipBackup:true});
    refreshMetaUiAfterRestore();
    console.info('已从IndexedDB恢复较新的玩家存档')
  }catch(err){
    if(String(err?.message||err).includes('unavailable'))return;
    console.warn('IndexedDB存档读取失败，继续使用localStorage存档',err)
  }
}

function installMetaLifecycleSaveHandlers(){
  if(typeof window==='undefined'||!window.addEventListener||installMetaLifecycleSaveHandlers.installed)return;
  installMetaLifecycleSaveHandlers.installed=true;
  const persist=()=>saveMeta({skipBackup:true});
  window.addEventListener('pagehide',persist);
  window.addEventListener('beforeunload',persist);
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')persist()
    })
  }
}

reconcileIndexedDbMetaSave();
installMetaLifecycleSaveHandlers();

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
    reactorWaveBonus:hasMeta('reactor_wave_supply')?120:0,
    reactorWaveBonusLimit:REACTOR_WAVE_BONUS_LIMIT,
    p1Double:hasMeta('tower_p1'),
    p1Recycle:hasMeta('tower_p1_recycle'),
    p2Stop:hasMeta('tower_p2'),
    p2Superchain:hasMeta('tower_p2_superchain'),
    p3Residual:hasMeta('tower_p3'),
    p4Slow:hasMeta('tower_p4'),
    p4Freeze:hasMeta('tower_p4_freeze'),
    p5Focus:hasMeta('tower_p5'),
    p6Range:hasMeta('tower_p6'),
    p7Poison:hasMeta('tower_p7'),
    p7Burst:hasMeta('tower_p7_burst'),
    b1Repair:hasMeta('tower_b1'),
    b1LowWreck:hasMeta('tower_b1_low_wreck'),
    b2Surge:hasMeta('tower_b2'),
    b3Leech:hasMeta('tower_b3'),
    b3Taunt:hasMeta('tower_b3_taunt'),
    b4Shield:hasMeta('tower_b4'),
    b4Resonance:hasMeta('tower_b4_resonance'),
    b5DroneHeal:hasMeta('tower_b5'),
    b5Overheal:hasMeta('tower_b5_overheal'),
    b6ToxicShell:hasMeta('tower_b6'),
    b7Hp:hasMeta('tower_b7'),
    b7Manual:hasMeta('tower_b7_manual'),
    b7Damage:hasMeta('tower_b7_damage'),
    d1ReactiveArmor:hasMeta('tower_d1'),
    d1DeathBlast:hasMeta('tower_d1_death_blast'),
    d2Revive:hasMeta('tower_d2'),
    d3Retreat:hasMeta('tower_d3'),
    poisonLong:hasMeta('poison_long'),
    poisonDamage:hasMeta('poison_damage'),
    poisonSlow:hasMeta('poison_slow')
  };
}
