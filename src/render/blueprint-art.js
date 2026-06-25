const BLUEPRINT_ART={
  bg:0x08131f,
  bgGrid:0x6fe7ff,
  panel:0x0b2234,
  panelDeep:0x06111b,
  cyan:0x6fe7ff,
  cyanSoft:0x2fb8e6,
  white:0xeafcff,
  wall:0x142a3d,
  wallEdge:0x66d9ff,
  enemy:0xff4f6d,
  enemyCore:0xffd1dc
};

function textStyle(size,color){
  return {fontSize:size+'px',color,fontFamily:'monospace'};
}

function genTwTex(scene){
  const cm={
    P1:0x22cc66,P2:0x2288ff,P3:0x88ccff,P4:0x88ddff,P5:0xffaa44,
    P6:0xaa44ff,P7:0xcc66ff,B1:0x8899aa,B2:0xff6622,B3:0xcc8844,
    B4:0x4488cc,B5:0x44dd88,B6:0xaa44cc,B7:0xff4444,
    D1:0xffcc44,D2:0xff8844,D3:0x44ff88
  };
  const sm={B1:55,B2:45,B3:45,B4:45,B5:45,B6:45,B7:35,D1:40,D2:40,D3:40};
  ALL_TOWERS.forEach(t=>createTowerTextures(scene,t,cm,sm));
}

function towerTextureSize(t,sm){
  if(t.type==='block')return sm[t.id]||45;
  if(t.type==='drone')return sm[t.id]||40;
  return 40;
}

function createTowerTextures(scene,t,colors,sizes){
  const s=towerTextureSize(t,sizes);
  const color=colors[t.id]||0x888888;
  const g=scene.make.graphics({add:false});
  drawTowerTextureShape(g,t,s,color);
  g.generateTexture('tw'+t.id,s,s);
  g.destroy();

  const gg=scene.make.graphics({add:false});
  drawTowerGhostShape(gg,t,s,color);
  gg.generateTexture('gh'+t.id,s,s);
  gg.destroy();
}

function drawTowerTextureShape(g,t,s,color){
  const c=s/2;
  const r=s*0.44;
  if(t.type==='block'){
    drawBlueprintBlock(g,s,color);
    drawTowerGlyph(g,t.id,c,c,r*0.72,color);
    return;
  }
  if(t.type==='drone')drawBlueprintDroneCore(g,s,color);
  else drawBlueprintRoundTower(g,s,color);
  drawTowerGlyph(g,t.id,c,c,r*0.72,color);
}

function drawTowerGhostShape(g,t,s,color){
  const c=s/2;
  g.lineStyle(2,color,0.68);
  if(t.type==='drone'||t.type==='path')g.strokeCircle(c,c,s*0.43);
  else g.strokeRect(3,3,s-6,s-6);
  g.lineStyle(1,BLUEPRINT_ART.white,0.36);
  g.strokeCircle(c,c,s*0.23);
}

function drawBlueprintRoundTower(g,s,color){
  const c=s/2;
  g.fillStyle(BLUEPRINT_ART.panelDeep,0.92);
  g.fillCircle(c,c,s*0.46);
  g.lineStyle(5,color,0.2);
  g.strokeCircle(c,c,s*0.43);
  g.lineStyle(2,color,0.95);
  g.strokeCircle(c,c,s*0.39);
  g.lineStyle(1,BLUEPRINT_ART.white,0.35);
  g.strokeCircle(c,c,s*0.24);
  drawCompassTicks(g,c,c,s*0.43,color);
}

function drawBlueprintBlock(g,s,color){
  g.fillStyle(BLUEPRINT_ART.panel,0.94);
  g.fillRect(3,3,s-6,s-6);
  g.lineStyle(5,color,0.18);
  g.strokeRect(3,3,s-6,s-6);
  g.lineStyle(2,color,0.95);
  g.strokeRect(6,6,s-12,s-12);
  g.lineStyle(1,BLUEPRINT_ART.white,0.35);
  g.strokeRect(s*0.23,s*0.23,s*0.54,s*0.54);
  const k=s*0.22;
  g.lineStyle(2,BLUEPRINT_ART.white,0.5);
  g.lineBetween(6,6,k,6);g.lineBetween(6,6,6,k);
  g.lineBetween(s-6,6,s-k,6);g.lineBetween(s-6,6,s-6,k);
  g.lineBetween(6,s-6,k,s-6);g.lineBetween(6,s-6,6,s-k);
  g.lineBetween(s-6,s-6,s-k,s-6);g.lineBetween(s-6,s-6,s-6,s-k);
}

function drawBlueprintDroneCore(g,s,color){
  const c=s/2;
  g.fillStyle(BLUEPRINT_ART.panelDeep,0.9);
  g.fillCircle(c,c,s*0.42);
  g.lineStyle(2,color,0.96);
  drawDiamond(g,c,c,s*0.37);
  g.lineStyle(1,BLUEPRINT_ART.white,0.42);
  g.strokeCircle(c,c,s*0.22);
  for(let i=0;i<4;i++){
    const a=Math.PI/2*i+Math.PI/4;
    const x=c+Math.cos(a)*s*0.35;
    const y=c+Math.sin(a)*s*0.35;
    g.fillStyle(color,0.35);
    g.fillCircle(x,y,s*0.055);
  }
}

function drawCompassTicks(g,cx,cy,r,color){
  g.lineStyle(1,color,0.65);
  for(let i=0;i<8;i++){
    const a=Math.PI*2*i/8;
    const r1=r*0.84,r2=r*1.02;
    g.lineBetween(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);
  }
}

function drawDiamond(g,cx,cy,r){
  g.beginPath();
  g.moveTo(cx,cy-r);
  g.lineTo(cx+r,cy);
  g.lineTo(cx,cy+r);
  g.lineTo(cx-r,cy);
  g.closePath();
  g.strokePath();
}

function strokeTrianglePath(g,x1,y1,x2,y2,x3,y3){
  g.beginPath();
  g.moveTo(x1,y1);
  g.lineTo(x2,y2);
  g.lineTo(x3,y3);
  g.closePath();
  g.strokePath();
}

function drawTowerGlyph(g,id,cx,cy,r,color){
  const glyph=towerIconSpec(id).glyph;
  drawSharedIconGlyph(g,glyph,cx,cy,r,color);
}

function drawSharedIconGlyph(g,glyph,cx,cy,r,color){
  const def=ICON_GLYPH_DEFS[glyph]||ICON_GLYPH_DEFS.core;
  def.forEach(cmd=>drawSharedIconCommand(g,cmd,cx,cy,r,color));
}

function iconScalePoint(cx,cy,r,x,y){
  const scale=r/20;
  return {x:cx+(x-20)*scale,y:cy+(y-20)*scale};
}

function drawSharedIconCommand(g,cmd,cx,cy,r,color){
  const strokeColor=cmd.useTowerColor?color:(cmd.color??BLUEPRINT_ART.white);
  g.lineStyle(2,strokeColor,0.96);
  g.fillStyle(strokeColor,0.22);
  if(cmd.type==='circle'){
    const p=iconScalePoint(cx,cy,r,cmd.cx,cmd.cy);
    if(cmd.fill){
      g.fillStyle(strokeColor,cmd.opacity??.18);
      g.fillCircle(p.x,p.y,cmd.r*r/20);
    }else{
      g.strokeCircle(p.x,p.y,cmd.r*r/20);
    }
    return;
  }
  if(cmd.type==='line'){
    const a=iconScalePoint(cx,cy,r,cmd.x1,cmd.y1);
    const b=iconScalePoint(cx,cy,r,cmd.x2,cmd.y2);
    g.lineBetween(a.x,a.y,b.x,b.y);
    return;
  }
  if(cmd.type==='polygon'||cmd.type==='polyline'){
    const pts=cmd.points.map(p=>iconScalePoint(cx,cy,r,p[0],p[1]));
    if(!pts.length)return;
    g.beginPath();
    g.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);
    if(cmd.type==='polygon')g.closePath();
    g.strokePath();
  }
}
