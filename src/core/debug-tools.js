const R32_BUILD_ID='build-20260630-3';
const R32_DEBUG_ENABLED=(()=>{try{return new URLSearchParams(location.search).get('debug')==='1'||localStorage.getItem('r32Debug')==='1'}catch(_){return false}})();

window.__r32Debug=window.__r32Debug||{
  errors:[],
  launches:[],
  lastScene:null,
  lastUpdateAt:0,
  frames:0
};

function r32DebugRecordError(label,error){
  if(!window.__r32Debug)return;
  const msg=error?.message||String(error||label);
  window.__r32Debug.errors.unshift({label,msg,time:new Date().toLocaleTimeString()});
  window.__r32Debug.errors=window.__r32Debug.errors.slice(0,5);
}

window.addEventListener('error',event=>r32DebugRecordError('error',event.error||event.message));
window.addEventListener('unhandledrejection',event=>r32DebugRecordError('promise',event.reason));

function r32DebugRecordLaunch(mode,selectedCount){
  if(!window.__r32Debug)return;
  window.__r32Debug.launches.unshift({mode,selectedCount,time:new Date().toLocaleTimeString()});
  window.__r32Debug.launches=window.__r32Debug.launches.slice(0,5);
}

function initDebugOverlay(){
  if(!R32_DEBUG_ENABLED)return;
  let panel=document.getElementById('r32DebugPanel');
  if(panel)return;
  panel=document.createElement('pre');
  panel.id='r32DebugPanel';
  panel.style.cssText=[
    'position:fixed',
    'right:10px',
    'bottom:10px',
    'z-index:9999',
    'max-width:420px',
    'max-height:44vh',
    'overflow:auto',
    'padding:10px 12px',
    'margin:0',
    'background:rgba(2,8,16,.88)',
    'color:#b7f3ff',
    'border:1px solid rgba(126,200,227,.55)',
    'border-radius:8px',
    'font:12px/1.45 Consolas,monospace',
    'white-space:pre-wrap',
    'pointer-events:none'
  ].join(';');
  panel.textContent='R-32 debug overlay initializing...';
  document.body.appendChild(panel);
}

function updateDebugOverlay(scene,t=0,dt=0){
  if(!R32_DEBUG_ENABLED)return;
  initDebugOverlay();
  const panel=document.getElementById('r32DebugPanel');
  if(!panel)return;
  const dbg=window.__r32Debug;
  dbg.lastScene=scene;
  dbg.lastUpdateAt=Date.now();
  dbg.frames++;
  const activeEnemies=scene.enemies?.countActive?.()??0;
  const launch=dbg.launches[0];
  const err=dbg.errors[0];
  panel.textContent=[
    `R-32 ${R32_BUILD_ID}`,
    `url=${location.href}`,
    `launch=${launch?`${launch.mode} towers=${launch.selectedCount} at ${launch.time}`:'-'}`,
    `sceneActive=${!!scene.scene?.isActive?.()} paused=${!!scene.isPaused} ended=${!!scene.ended} timePaused=${!!scene.time?.paused}`,
    `mode=${scene.mode} wave=${scene.wave} completed=${scene.completedWaves} prep=${((scene.prepTimer||0)/1000).toFixed(1)}s wActive=${!!scene.wActive}`,
    `dt=${Math.round(dt)}ms frames=${dbg.frames} energy=${Math.floor(scene.en||0)} enemies=${activeEnemies}`,
    `level=${scene.levelConfig?.id||'-'} allSpawned=${!!scene._allLevelWavesSpawned}`,
    `lastError=${err?`${err.time} ${err.label}: ${err.msg}`:'-'}`
  ].join('\n');
}
