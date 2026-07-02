const ADDED_LEVEL_WAVE_COUNT=15;
const LEVEL_SAFE_EARLY_ROSTERS=[
  ['E1','E1','E2','E1'],
  ['E1','E2','E1','E2','E1']
];
const LEVEL_PRESSURE_SEQUENCE=['E4','E7','E6','E8','E12','E11','E9','E10','E13','E14'];

function levelEnemyDanger(type){
  return EC?.[type]?.danger??1
}

function levelSafeEarlyRoster(roster=[],waveIndex=0){
  const cap=waveIndex===0?4:5;
  const fallback=LEVEL_SAFE_EARLY_ROSTERS[waveIndex]||LEVEL_SAFE_EARLY_ROSTERS[1];
  const safe=roster.filter(type=>levelEnemyDanger(type)<=1).slice(0,cap);
  while(safe.length<Math.min(cap,fallback.length))safe.push(fallback[safe.length%fallback.length]);
  return safe.length?safe:fallback.slice(0,cap)
}

function levelPressureAddCount(waveIndex,totalWaves){
  if(waveIndex<5)return 0;
  const pressureIndex=waveIndex-5;
  if(totalWaves<=10)return Math.min(6,2+pressureIndex);
  return Math.min(12,2+pressureIndex)
}

function levelPressureAdds(waveIndex,totalWaves){
  const count=levelPressureAddCount(waveIndex,totalWaves);
  const start=(waveIndex*2)%LEVEL_PRESSURE_SEQUENCE.length;
  const out=[];
  for(let i=0;i<count;i++)out.push(LEVEL_PRESSURE_SEQUENCE[(start+i)%LEVEL_PRESSURE_SEQUENCE.length]);
  return out
}

function balanceLevelWaves(waves=[]){
  const total=waves.length;
  return cloneLevelWaves(waves).map((wave,index)=>{
    let roster=[...(wave.roster||[])];
    if(index<2)roster=levelSafeEarlyRoster(roster,index);
    if(index>=5)roster=roster.concat(levelPressureAdds(index,total));
    return {...wave,roster}
  })
}

function addedLevelWaves(seedId='level5'){
  return balanceLevelWaves(extendLevelWaves(LEVEL_WAVES[seedId]||LEVEL_TRIAL_1.waves,ADDED_LEVEL_WAVE_COUNT));
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
    const rosterSource=base[base.length-1]||source;
    const cycle=Math.floor(out.length/base.length)+1;
    out.push({
      ...source,
      scale:Number((source.scale+0.18*cycle+0.04*(out.length-base.length)).toFixed(2)),
      lanes:[...(source.lanes||[])],
      roster:[...(rosterSource.roster||[])]
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
    waves:balanceLevelWaves(LEVEL_WAVES[waveSeed]||LEVEL_TRIAL_1.waves)
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
