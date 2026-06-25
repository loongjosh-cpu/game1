function gridCellBlocked(map,c,r){
  const cx=c*CELL+CELL/2;
  const cy=r*CELL+CELL/2;
  return map.walls.some(w=>
    cx>=w[0]-NAV_CLEARANCE&&
    cx<=w[0]+w[2]+NAV_CLEARANCE&&
    cy>=w[1]-NAV_CLEARANCE&&
    cy<=w[1]+w[3]+NAV_CLEARANCE
  );
}

function buildGrid(map=MAP){
  const gw=Math.ceil(mapW(map)/CELL);
  const gh=Math.ceil(mapH(map)/CELL);
  const grid=[];
  for(let r=0;r<gh;r++){
    grid[r]=[];
    for(let c=0;c<gw;c++)grid[r][c]=gridCellBlocked(map,c,r)?1:0;
  }
  return grid;
}

function cellInGrid(g,c,r){
  return c>=0&&c<g[0].length&&r>=0&&r<g.length;
}

function nearestOpenCell(g,c,r,maxRadius=8){
  if(cellInGrid(g,c,r)&&!g[r][c])return {c,r};
  for(let radius=1;radius<=maxRadius;radius++){
    const found=nearestOpenCellOnRing(g,c,r,radius);
    if(found)return found;
  }
  return null;
}

function nearestOpenCellOnRing(g,c,r,radius){
  let best=null,bd=Infinity;
  for(let y=r-radius;y<=r+radius;y++){
    for(let x=c-radius;x<=c+radius;x++){
      if(!isSearchRingCell(g,c,r,x,y,radius))continue;
      const d=(x-c)*(x-c)+(y-r)*(y-r);
      if(d<bd){best={c:x,r:y};bd=d;}
    }
  }
  return best;
}

function isSearchRingCell(g,c,r,x,y,radius){
  return cellInGrid(g,x,y)&&
    !g[y][x]&&
    Math.max(Math.abs(x-c),Math.abs(y-r))===radius;
}

function astar(g,sx,sy,ex,ey){
  const ctx=createAstarContext(g,sx,sy,ex,ey);
  if(!ctx)return [];
  while(ctx.open.length){
    ctx.open.sort((a,b)=>a.f-b.f);
    const cur=ctx.open.shift();
    const curKey=ctx.key(cur.c,cur.r);
    if(ctx.closed.has(curKey))continue;
    if(cur.c===ctx.ec&&cur.r===ctx.er)return rebuildAstarPath(ctx,curKey);
    ctx.closed.add(curKey);
    expandAstarNode(ctx,cur,curKey);
  }
  return [];
}

function createAstarContext(g,sx,sy,ex,ey){
  const h=g.length,w=g[0].length;
  const startRaw={c:Math.floor(sx/CELL),r:Math.floor(sy/CELL)};
  const endRaw={c:Math.floor(ex/CELL),r:Math.floor(ey/CELL)};
  const start=nearestOpenCell(g,startRaw.c,startRaw.r);
  const end=nearestOpenCell(g,endRaw.c,endRaw.r);
  if(!start||!end)return null;
  const key=(c,r)=>r*w+c;
  const ctx={
    g,w,h,key,open:[],closed:new Set(),gScore:{},fScore:{},from:{},
    sc:start.c,sr:start.r,ec:end.c,er:end.r,
    ex,ey,endAdjusted:end.c!==endRaw.c||end.r!==endRaw.r
  };
  const startKey=key(ctx.sc,ctx.sr);
  ctx.gScore[startKey]=0;
  ctx.fScore[startKey]=astarHeuristic(ctx.sc,ctx.sr,ctx.ec,ctx.er);
  ctx.open.push({c:ctx.sc,r:ctx.sr,f:ctx.fScore[startKey]});
  return ctx;
}

function astarHeuristic(c,r,ec,er){
  return Math.abs(c-ec)+Math.abs(r-er);
}

function cellTouchesWall(ctx,c,r){
  return c>0&&c<ctx.w-1&&r>0&&r<ctx.h-1&&
    (ctx.g[r-1][c]||ctx.g[r+1][c]||ctx.g[r][c-1]||ctx.g[r][c+1]);
}

function expandAstarNode(ctx,cur,curKey){
  for(const [dc,dr] of [[0,-1],[0,1],[-1,0],[1,0]]){
    const nc=cur.c+dc,nr=cur.r+dr;
    if(!cellInGrid(ctx.g,nc,nr)||ctx.g[nr][nc])continue;
    const nextKey=ctx.key(nc,nr);
    if(ctx.closed.has(nextKey))continue;
    const cost=ctx.gScore[curKey]+1+(cellTouchesWall(ctx,nc,nr)?0.4:0);
    if(cost>=(ctx.gScore[nextKey]??Infinity))continue;
    ctx.gScore[nextKey]=cost;
    ctx.fScore[nextKey]=cost+astarHeuristic(nc,nr,ctx.ec,ctx.er);
    ctx.from[nextKey]={c:cur.c,r:cur.r};
    ctx.open.push({c:nc,r:nr,f:ctx.fScore[nextKey]});
  }
}

function rebuildAstarPath(ctx,endKey){
  const startKey=ctx.key(ctx.sc,ctx.sr);
  const path=[[ctx.ec*CELL+CELL/2,ctx.er*CELL+CELL/2]];
  let k=endKey;
  while(k!==startKey){
    const prev=ctx.from[k];
    if(!prev)break;
    if(ctx.key(prev.c,prev.r)!==startKey){
      path.unshift([prev.c*CELL+CELL/2,prev.r*CELL+CELL/2]);
    }
    k=ctx.key(prev.c,prev.r);
  }
  if(!ctx.endAdjusted)path.push([ctx.ex,ctx.ey]);
  return path;
}

function buildNavigation(map=MAP){
  const enemyPaths=[],enemyWaypoints=[],gridPF=buildGrid(map);
  map.spawns.forEach(([sx,sy],i)=>{
    const wp=astar(gridPF,sx,sy,map.reactor.x,map.reactor.y);
    if(!wp.length)console.error(`入口 ${i+1} 无法连接反应炉`);
    enemyWaypoints.push([[sx,sy],...wp]);
    enemyPaths.push(makeEnemyPath(sx,sy,wp));
  });
  return {enemyPaths,enemyWaypoints,gridPF};
}

function makeEnemyPath(sx,sy,waypoints){
  const path=new Phaser.Curves.Path(sx,sy);
  for(let j=0;j<waypoints.length;j++)path.lineTo(waypoints[j][0],waypoints[j][1]);
  return path;
}

function pointRectDistance(px,py,w){
  const dx=Math.max(w[0]-px,0,px-(w[0]+w[2]));
  const dy=Math.max(w[1]-py,0,py-(w[1]+w[3]));
  return Math.hypot(dx,dy);
}

function nearestWallDistance(x,y){
  let best=Infinity;
  for(const w of MAP.walls)best=Math.min(best,pointRectDistance(x,y,w));
  return best;
}

function snapToWallEdge(px,py,radius){
  let best={x:px,y:py,snapped:false};
  let bestDist=sd(PATH_SNAP_DISTANCE);
  for(const wall of MAP.walls){
    for(const p of wallSnapCandidates(px,py,radius,wall)){
      if(!validWallSnapPoint(p,radius))continue;
      const d=Phaser.Math.Distance.Between(px,py,p.x,p.y);
      if(d>bestDist)continue;
      best={x:p.x,y:p.y,snapped:true};
      bestDist=d;
    }
  }
  return best;
}

function wallSnapCandidates(px,py,radius,wall){
  const [wx,wy,ww,wh]=wall,off=radius+2;
  return [
    {x:wx-off,y:Phaser.Math.Clamp(py,wy,wy+wh)},
    {x:wx+ww+off,y:Phaser.Math.Clamp(py,wy,wy+wh)},
    {x:Phaser.Math.Clamp(px,wx,wx+ww),y:wy-off},
    {x:Phaser.Math.Clamp(px,wx,wx+ww),y:wy+wh+off}
  ];
}

function validWallSnapPoint(p,radius){
  const mw=mapW(),mh=mapH();
  if(p.x<radius||p.x>mw-radius||p.y<radius||p.y>mh-radius)return false;
  const wallDistance=nearestWallDistance(p.x,p.y);
  return wallDistance>=radius&&wallDistance<=radius+4;
}
