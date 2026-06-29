function clampFloatingPanel(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function resetFloatingPanel(panel,defaults={}){
  if(!panel)return;
  panel.style.left=defaults.left??'';
  panel.style.right=defaults.right??'';
  panel.style.top=defaults.top??'';
  panel.style.bottom=defaults.bottom??'';
  panel.style.transform=defaults.transform??'';
}

function makePanelDraggable(panel,handle,options={}){
  if(!panel||!handle||panel.dataset.dragReady)return;
  panel.dataset.dragReady='1';
  handle.classList.add('floatingDragHandle');
  let drag=null;
  const margin=options.margin??8;
  const moveTo=(x,y)=>{
    const rect=panel.getBoundingClientRect();
    const maxX=Math.max(margin,window.innerWidth-rect.width-margin);
    const maxY=Math.max(margin,window.innerHeight-rect.height-margin);
    panel.style.position='fixed';
    panel.style.left=clampFloatingPanel(x,margin,maxX)+'px';
    panel.style.top=clampFloatingPanel(y,margin,maxY)+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    panel.style.transform='none';
  };
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(event.target.closest('button,input,select,textarea'))return;
    const rect=panel.getBoundingClientRect();
    drag={dx:event.clientX-rect.left,dy:event.clientY-rect.top};
    panel.classList.add('dragging');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag)return;
    moveTo(event.clientX-drag.dx,event.clientY-drag.dy);
    event.preventDefault();
  });
  const stop=event=>{
    if(!drag)return;
    drag=null;
    panel.classList.remove('dragging');
    handle.releasePointerCapture?.(event.pointerId);
  };
  handle.addEventListener('pointerup',stop);
  handle.addEventListener('pointercancel',stop);
  window.addEventListener('resize',()=>{
    if(panel.style.display==='none')return;
    const rect=panel.getBoundingClientRect();
    moveTo(rect.left,rect.top);
  });
}

function initDraggablePanels(){
  const twPanel=document.getElementById('twPanel');
  makePanelDraggable(twPanel,twPanel?.querySelector('.twPanelHead'));
}
