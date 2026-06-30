const MiniMapMethods={
  initMiniMap(){
    this.miniMapWrap=document.getElementById('miniMapWrap');
    this.miniMapCanvas=document.getElementById('miniMap');
    this.miniMapCtx=this.miniMapCanvas?.getContext?.('2d')||null;
    this.miniMapTimer=0;
  },
  applyViewSettings(){
    this.view=viewSettings();
    this.applyCameraMode();
    this.updateMiniMapVisibility();
    this.drawMiniMap(true);
  },
  applyCameraMode(){
    if(!this.ship)return;
    const cam=this.cameras.main;
    if(this.view.cameraMode==='local'){
      cam.setBounds(0,0,mapW(),mapH());
      cam.setZoom(LOCAL_CAMERA_ZOOM);
      cam.startFollow(this.ship,true,0.12,0.12);
      cam.setDeadzone(cam.width*0.08,cam.height*0.08);
    }else{
      cam.stopFollow();
      cam.setDeadzone(0,0);
      cam.setZoom(GLOBAL_CAMERA_ZOOM);
      const visibleW=cam.width/GLOBAL_CAMERA_ZOOM;
      const visibleH=cam.height/GLOBAL_CAMERA_ZOOM;
      const padX=Math.max(0,(visibleW-mapW())/2);
      const padY=Math.max(0,(visibleH-mapH())/2);
      cam.setBounds(-padX,-padY,mapW()+padX*2,mapH()+padY*2);
      cam.centerOn(mapW()/2,mapH()/2);
    }
  },
  shouldShowMiniMap(){
    return this.view?.cameraMode==='local';
  },
  updateMiniMapVisibility(){
    if(this.miniMapWrap)this.miniMapWrap.style.display=this.shouldShowMiniMap()?'block':'none';
  },
  updateMiniMap(dt,force=false){
    if(!this.shouldShowMiniMap()||!this.miniMapCtx)return;
    this.miniMapTimer=(this.miniMapTimer||0)+dt;
    if(!force&&this.miniMapTimer<MINIMAP_REFRESH)return;
    this.miniMapTimer=0;
    this.drawMiniMap(force);
  },
  drawMiniMap(){
    const ctx=this.miniMapCtx,canvas=this.miniMapCanvas;
    if(!ctx||!canvas||!this.shouldShowMiniMap())return;
    const w=canvas.width,h=canvas.height,pad=7,mw=mapW(),mh=mapH();
    const scale=Math.min((w-pad*2)/mw,(h-pad*2)/mh);
    const ox=(w-mw*scale)/2,oy=(h-mh*scale)/2;
    const px=x=>ox+x*scale,py=y=>oy+y*scale;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#07101a';
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(126,200,227,.45)';
    ctx.lineWidth=1;
    ctx.strokeRect(ox,oy,mw*scale,mh*scale);
    ctx.fillStyle='rgba(64,104,130,.72)';
    MAP.walls.forEach(([x,y,ww,hh])=>ctx.fillRect(px(x),py(y),Math.max(1,ww*scale),Math.max(1,hh*scale)));
    ctx.fillStyle='#e94560';
    MAP.spawns.forEach(([x,y])=>{
      ctx.beginPath();
      ctx.arc(px(x),py(y),3,0,Math.PI*2);
      ctx.fill();
    });
    this.drawMiniMapGroup(ctx,px,py,this.towers,2.2,'#66e0ff');
    this.drawMiniMapGroup(ctx,px,py,this.blockers,3,'#aeb8c4');
    this.drawMiniMapGroup(ctx,px,py,this.drones,3,'#ffcc44');
    this.drawMiniMapGroup(ctx,px,py,this.droneHelpers,1.7,'#ffe08a');
    this.drawMiniMapGroup(ctx,px,py,this.enemies,2.2,'#ff5570');
    for(const r of this.reactors||[]){
      if(!this.reactorAlive(r))continue;
      ctx.fillStyle=r._isMainReactor?'#7ec8e3':'#44ff88';
      ctx.beginPath();
      ctx.arc(px(r.x),py(r.y),r._isMainReactor?5:3.5,0,Math.PI*2);
      ctx.fill();
    }
    if(this.ship&&!this.shipDead){
      ctx.fillStyle='#ffffff';
      ctx.beginPath();
      ctx.arc(px(this.ship.x),py(this.ship.y),4,0,Math.PI*2);
      ctx.fill();
    }
    const cam=this.cameras.main;
    const vw=cam.width/cam.zoom,vh=cam.height/cam.zoom;
    ctx.strokeStyle=this.view.cameraMode==='local'?'rgba(255,255,255,.9)':'rgba(126,200,227,.7)';
    ctx.lineWidth=1;
    ctx.strokeRect(px(cam.scrollX),py(cam.scrollY),vw*scale,vh*scale);
  },
  drawMiniMapGroup(ctx,px,py,group,radius,color){
    if(!group)return;
    ctx.fillStyle=color;
    group.children.iterate(obj=>{
      if(!obj||!obj.active)return;
      ctx.beginPath();
      ctx.arc(px(obj.x),py(obj.y),radius,0,Math.PI*2);
      ctx.fill();
    });
  }
};
