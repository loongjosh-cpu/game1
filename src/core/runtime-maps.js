const ADDED_LEVEL_WAVE_COUNT=15;

function addedLevelWaves(seedId='level5'){
  return extendLevelWaves(LEVEL_WAVES[seedId]||LEVEL_TRIAL_1.waves,ADDED_LEVEL_WAVE_COUNT);
}

function levelLaneUnlockCount(waveIndex,totalWaves,laneCount){
  if(laneCount<=1)return 1;
  const progress=(waveIndex+1)/Math.max(1,totalWaves);
  if(progress<=0.2)return 1;
  if(progress<=0.4)return Math.min(laneCount,2);
  if(progress<=0.6)return Math.min(laneCount,Math.ceil(laneCount*0.5));
  if(progress<=0.8)return Math.min(laneCount,Math.ceil(laneCount*0.75));
  return laneCount
}

function levelLaneUnlockOrder(waves=[],laneCount=1){
  const seen=new Set(),order=[];
  const add=lane=>{
    const normalized=((lane%laneCount)+laneCount)%laneCount;
    if(!seen.has(normalized)){seen.add(normalized);order.push(normalized)}
  };
  waves.forEach(w=>(w.lanes||[]).forEach(add));
  for(let lane=0;lane<laneCount;lane++)add(lane);
  return order
}

function normalizeLevelWaveLanes(waves=[],map=null){
  const laneCount=map?.spawns?.length||0;
  if(laneCount<=1)return waves;
  const order=levelLaneUnlockOrder(waves,laneCount);
  return waves.map((wave,index)=>{
    const count=levelLaneUnlockCount(index,waves.length,laneCount);
    const unlocked=new Set(order.slice(0,count));
    const fallback=order[0]??0;
    const lanes=(wave.lanes?.length?wave.lanes:[fallback])
      .map(lane=>((lane%laneCount)+laneCount)%laneCount)
      .filter(lane=>unlocked.has(lane));
    return {...wave,lanes:lanes.length?lanes:[fallback]}
  })
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
  const level={
    id,
    name:imported.levelName||imported.name||id,
    map:cloneMap(imported),
    waves:cloneLevelWaves(LEVEL_WAVES[waveSeed]||LEVEL_TRIAL_1.waves)
  };
  level.waves=normalizeLevelWaveLanes(level.waves,level.map);
  return level;
}

const LEVELS={};

for(const id of LEVEL_UI_ORDER){
  const n=Number(id.replace('level',''));
  const added=n>5;
  const level=addedImportedLevel(id,added?'level5':id);
  if(level&&added)level.waves=normalizeLevelWaveLanes(addedLevelWaves('level5'),level.map);
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

let MAP=ENDLESS_MAPS.endless1.map;
