function pathPoint(p){return Array.isArray(p)?[p[0],p[1]]:[p.x,p.y]}

function clonePaths(paths=[]){return paths.map(route=>route.map(p=>pathPoint(p)))}

function distToSegment(px,py,a,b){
  const ax=a[0],ay=a[1],bx=b[0],by=b[1];
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  if(!l2)return Math.hypot(px-ax,py-ay);
  const t=Phaser.Math.Clamp(((px-ax)*dx+(py-ay)*dy)/l2,0,1);
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}

function pointNearPaths(x,y,paths,radius){
  for(const route of paths){
    if(pointNearRoute(x,y,route,radius))return true;
  }
  return false;
}

function pointNearRoute(x,y,route,radius){
  for(let i=0;i<route.length-1;i++){
    if(distToSegment(x,y,pathPoint(route[i]),pathPoint(route[i+1]))<=radius)return true;
  }
  return false;
}

function corridorWalls(paths,radius=220,step=140){
  const walls=[],cols=Math.ceil(W/step),rows=Math.ceil(H/step);
  for(let r=0;r<rows;r++)addCorridorWallRuns(walls,paths,radius,step,r,cols);
  return walls;
}

function addCorridorWallRuns(walls,paths,radius,step,row,cols){
  let run=-1;
  for(let c=0;c<=cols;c++){
    const blocked=c<cols&&!corridorCellOpen(paths,radius,step,c,row);
    if(blocked&&run<0)run=c;
    if((!blocked||c===cols)&&run>=0){
      walls.push([run*step,row*step,(c-run)*step,step]);
      run=-1;
    }
  }
}

function corridorCellOpen(paths,radius,step,c,row){
  const cx=c*step+step/2;
  const cy=row*step+step/2;
  const inside=cx>80&&cx<W-80&&cy>80&&cy<H-80;
  return inside&&pointNearPaths(cx,cy,paths,radius);
}

function makeLevel(id,name,unitScale,paths,radius,reactor,extraWalls=[]){
  const cleanPaths=clonePaths(paths);
  return {
    id,
    name,
    map:makeLevelMap(id,name,unitScale,cleanPaths,radius,reactor,extraWalls),
    waves:LEVEL_TRIAL_1.waves
  };
}

function makeLevelMap(id,name,unitScale,paths,radius,reactor,extraWalls=[]){
  return {
    schemaVersion:1,
    kind:'level-map',
    id,
    name,
    unitScale,
    w:W,
    h:H,
    worldSize:{w:W,h:H},
    walls:[...corridorWalls(paths,radius,160),...extraWalls],
    spawns:paths.map(r=>[...r[0]]),
    reactor:{...reactor},
    paths,
    pockets:[]
  };
}

function mapW(map=MAP){return map.w||W}
function mapH(map=MAP){return map.h||H}
function unitScale(map=MAP){return map.unitScale||1}
function sd(v,map=MAP){return v*unitScale(map)}

function cloneMap(m){
  const world=m.worldSize||{w:m.w||W,h:m.h||H};
  return {
    schemaVersion:m.schemaVersion||1,
    kind:m.kind||'runtime-map',
    id:m.id,
    name:m.name,
    unitScale:m.unitScale||1,
    w:world.w,
    h:world.h,
    worldSize:{w:world.w,h:world.h},
    walls:(m.walls||[]).map(w=>[...w]),
    spawns:(m.spawns||[]).map(s=>pathPoint(s)),
    reactor:{...m.reactor},
    paths:clonePaths(m.paths||m.routes||[]),
    pockets:(m.pockets||[]).map(p=>({...p}))
  };
}
