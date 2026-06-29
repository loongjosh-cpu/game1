let SAVED_EDITOR_MAP=null;

try{
  loadSavedEditorMap();
}catch(err){
  console.warn('地图存档读取失败，使用内置地图',err);
}

function loadSavedEditorMap(){
  const saved=JSON.parse(safeStorageGet('r32-map')||'null');
  const src=saved?.map||saved;
  const world=src?.worldSize||saved?.worldSize;
  if(!validSavedMap(src,world))return;
  SAVED_EDITOR_MAP=src;
  applySavedMapToEndless(src,world);
}

function validSavedMap(src,world){
  return !!(src?.walls&&src?.spawns&&src?.reactor&&(!world||(world.w===W&&world.h===H)));
}

function applySavedMapToEndless(src,world){
  ENDLESS_MAP.unitScale=src.unitScale||ENDLESS_MAP.unitScale;
  ENDLESS_MAP.w=world?.w||src.w||W;
  ENDLESS_MAP.h=world?.h||src.h||H;
  ENDLESS_MAP.worldSize={w:ENDLESS_MAP.w,h:ENDLESS_MAP.h};
  ENDLESS_MAP.walls=src.walls;
  ENDLESS_MAP.spawns=src.spawns;
  ENDLESS_MAP.reactor=src.reactor;
  ENDLESS_MAP.paths=src.paths||src.routes||[];
  ENDLESS_MAP.pockets=src.pockets||[];
}

const ADDED_LEVEL_WAVE_COUNT=15;

function addedLevelWaves(seedId='level5'){
  return extendLevelWaves(LEVEL_WAVES[seedId]||LEVEL_TRIAL_1.waves,ADDED_LEVEL_WAVE_COUNT);
}

function extendLevelWaves(waves=[],targetCount=15){
  const base=cloneLevelWaves(waves);
  if(!base.length)return base;
  const out=cloneLevelWaves(base);
  while(out.length<targetCount){
    const source=base[(out.length-base.length)%base.length];
    const cycle=Math.floor(out.length/base.length)+1;
    out.push({
      ...source,
      scale:Number((source.scale+0.18*cycle+0.04*(out.length-base.length)).toFixed(2)),
      lanes:[...(source.lanes||[])],
      roster:[...(source.roster||[])]
    });
  }
  return out.slice(0,targetCount);
}

function addedImportedLevel(id,waveSeed=id){
  const imported=typeof IMPORTED_LEVEL_MAPS!=='undefined'?IMPORTED_LEVEL_MAPS[id]:null;
  if(!imported)return null;
  return {
    id,
    name:imported.levelName||imported.name||id,
    map:cloneMap(imported),
    waves:cloneLevelWaves(LEVEL_WAVES[waveSeed]||LEVEL_TRIAL_1.waves)
  };
}

const LEVELS={};
const IMPORTED_LEVEL_WAVE_SEEDS={level6:'level5',level7:'level5',level8:'level5',level9:'level5'};

for(const id of LEVEL_UI_ORDER){
  const level=addedImportedLevel(id,IMPORTED_LEVEL_WAVE_SEEDS[id]||id);
  if(level&&IMPORTED_LEVEL_WAVE_SEEDS[id])level.waves=addedLevelWaves(IMPORTED_LEVEL_WAVE_SEEDS[id]);
  if(level)LEVELS[id]=level;
}

const ENDLESS_MAPS={
  endless1:{id:'endless1',name:'无尽模式一',map:{
    schemaVersion:1,
    kind:'endless-map',
    id:'endless1',
    name:'无尽模式一',
    unitScale:0.48,
    w:W,
    h:H,
    worldSize:{w:W,h:H},
    walls:corridorWalls(TRIAL_LARGE_ROUTES,220,140),
    spawns:[[180,520],[180,2000],[180,3620],[7176,520],[7176,2080],[7176,3620],[3678,180],[3678,3964]],
    reactor:{x:3678,y:2072},
    paths:clonePaths(TRIAL_LARGE_ROUTES),
    pockets:[]}}
};

if(SAVED_EDITOR_MAP)applySavedEditorMapOverride(SAVED_EDITOR_MAP);

function applySavedEditorMapOverride(savedMap){
  const world=savedMap.worldSize||{w:savedMap.w||W,h:savedMap.h||H};
  ENDLESS_MAPS.endless1.map={
    schemaVersion:savedMap.schemaVersion||1,
    kind:savedMap.kind||'endless-map',
    id:savedMap.id||'endless1',
    name:savedMap.name||ENDLESS_MAPS.endless1.name,
    unitScale:savedMap.unitScale||1,
    w:world.w,
    h:world.h,
    worldSize:{w:world.w,h:world.h},
    walls:(savedMap.walls||[]).map(w=>[...w]),
    spawns:(savedMap.spawns||[]).map(p=>pathPoint(p)),
    reactor:{...savedMap.reactor},
    paths:clonePaths(savedMap.paths||savedMap.routes||[]),
    pockets:(savedMap.pockets||[]).map(p=>({...p}))
  };
}

let MAP=ENDLESS_MAPS.endless1.map;
