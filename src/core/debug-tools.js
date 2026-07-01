const R32_BUILD_ID='build-20260630-12';
const R32_DEBUG_ENABLED=(()=>{try{return new URLSearchParams(location.search).get('debug')==='1'||localStorage.getItem('r32Debug')==='1'}catch(_){return false}})();

window.__r32Debug=window.__r32Debug||{
  errors:[],
  launches:[],
  loading:[],
  runtime:{},
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

function r32DebugRecordRuntime(info={}){
  if(!window.__r32Debug)return;
  window.__r32Debug.runtime={...window.__r32Debug.runtime,...info};
  r32RenderLoadingDebug();
}

function r32EnsureLoadingPanel(){
  let panel=document.getElementById('r32LoadingPanel');
  if(panel)return panel;
  panel=document.createElement('div');
  panel.id='r32LoadingPanel';
  panel.innerHTML=[
    '<div class="r32LoadingCard">',
    '<div class="r32LoadingKicker">R-32 DEFENSE TERMINAL</div>',
    '<div class="r32LoadingTitle">正在进入战区</div>',
    '<div class="r32LoadingStage" id="r32LoadingStage">准备启动...</div>',
    '<div class="r32LoadingBar"><span id="r32LoadingBarFill"></span></div>',
    '<pre class="r32LoadingDebug" id="r32LoadingDebug"></pre>',
    '</div>'
  ].join('');
  const style=document.createElement('style');
  style.id='r32LoadingStyle';
  style.textContent=[
    '#r32LoadingPanel{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%,rgba(19,65,92,.55),rgba(3,8,16,.96) 58%);color:#d8f6ff}',
    '#r32LoadingPanel.active{display:flex}',
    '.r32LoadingCard{width:min(520px,86vw);padding:28px;border:1px solid rgba(126,200,227,.55);border-radius:18px;background:rgba(7,18,31,.88);box-shadow:0 20px 80px rgba(0,0,0,.45),inset 0 0 30px rgba(66,180,230,.08)}',
    '.r32LoadingKicker{font:11px/1.4 Georgia,serif;letter-spacing:.32em;color:#7ec8e3;margin-bottom:12px}',
    '.r32LoadingTitle{font-size:28px;letter-spacing:.08em;margin-bottom:10px}',
    '.r32LoadingStage{color:#9fb8c8;font-size:14px;margin-bottom:16px}',
    '.r32LoadingBar{height:8px;border-radius:999px;background:rgba(126,200,227,.14);overflow:hidden;border:1px solid rgba(126,200,227,.22)}',
    '#r32LoadingBarFill{display:block;width:12%;height:100%;border-radius:999px;background:linear-gradient(90deg,#44ff88,#7ec8e3);transition:width .18s ease}',
    '.r32LoadingDebug{display:none;margin:16px 0 0;max-height:28vh;overflow:auto;color:#b7f3ff;font:12px/1.45 Consolas,monospace;white-space:pre-wrap}',
    '#r32LoadingPanel.debug .r32LoadingDebug{display:block}'
  ].join('\n');
  document.head.appendChild(style);
  document.body.appendChild(panel);
  return panel;
}

function r32SetLoading(stage,detail='',progress=0.12){
  const panel=r32EnsureLoadingPanel();
  panel.classList.add('active');
  panel.classList.toggle('debug',R32_DEBUG_ENABLED);
  const stageEl=document.getElementById('r32LoadingStage');
  const fill=document.getElementById('r32LoadingBarFill');
  if(stageEl)stageEl.textContent=detail?`${stage} · ${detail}`:stage;
  if(fill)fill.style.width=`${Math.max(8,Math.min(100,Math.round(progress*100)))}%`;
  if(window.__r32Debug){
    window.__r32Debug.loading.push({stage,detail,progress,time:Date.now()});
    window.__r32Debug.loading=window.__r32Debug.loading.slice(-20);
    r32RenderLoadingDebug();
  }
}

function r32RenderLoadingDebug(){
  if(!R32_DEBUG_ENABLED)return;
  const el=document.getElementById('r32LoadingDebug');
  if(!el||!window.__r32Debug)return;
  const first=window.__r32Debug.loading[0]?.time||Date.now();
  const lines=window.__r32Debug.loading.map(item=>{
    const ms=String(item.time-first).padStart(5,' ');
    return `${ms}ms ${item.stage}${item.detail?' · '+item.detail:''}`;
  });
  const err=window.__r32Debug.errors[0];
  if(err)lines.push(`lastError ${err.time} ${err.label}: ${err.msg}`);
  const rt=window.__r32Debug.runtime||{};
  if(Object.keys(rt).length)lines.push(`runtime ${Object.entries(rt).map(([k,v])=>`${k}=${v}`).join(' ')}`);
  el.textContent=lines.join('\n');
}

function r32HideLoading(){
  const panel=document.getElementById('r32LoadingPanel');
  if(panel)panel.classList.remove('active');
}

function r32LoadingFailed(error){
  r32DebugRecordError('launch',error);
  r32SetLoading('启动失败',error?.message||String(error),1);
  const panel=document.getElementById('r32LoadingPanel');
  if(panel)panel.classList.add('debug');
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

function r32EnemyCombatSummary(scene){
  const counts={};
  scene.enemies?.children?.iterate?.(e=>{
    if(!e||!e.active)return;
    const dbg=e._combatDebug;
    const key=dbg?`${dbg.phase}:${dbg.reason}`:'no-debug';
    counts[key]=(counts[key]||0)+1;
  });
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return entries.length?entries.map(([k,v])=>`${k}=${v}`).join(' '):'-'
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
  const loading=dbg.loading.at?.(-1)||dbg.loading[dbg.loading.length-1];
  const rt=dbg.runtime||{};
  panel.textContent=[
    `R-32 ${R32_BUILD_ID}`,
    `url=${location.href}`,
    `launch=${launch?`${launch.mode} towers=${launch.selectedCount} at ${launch.time}`:'-'}`,
    `runtime=${Object.keys(rt).length?Object.entries(rt).map(([k,v])=>`${k}=${v}`).join(' '):'-'}`,
    `loading=${loading?`${loading.stage} ${loading.detail}`:'-'}`,
    `sceneActive=${!!scene.scene?.isActive?.()} paused=${!!scene.isPaused} ended=${!!scene.ended} timePaused=${!!scene.time?.paused}`,
    `mode=${scene.mode} wave=${scene.wave} completed=${scene.completedWaves} prep=${((scene.prepTimer||0)/1000).toFixed(1)}s wActive=${!!scene.wActive}`,
    `dt=${Math.round(dt)}ms frames=${dbg.frames} energy=${Math.floor(scene.en||0)} enemies=${activeEnemies}`,
    `combat=${r32EnemyCombatSummary(scene)}`,
    `level=${scene.levelConfig?.id||'-'} allSpawned=${!!scene._allLevelWavesSpawned}`,
    `lastError=${err?`${err.time} ${err.label}: ${err.msg}`:'-'}`
  ].join('\n');
}
