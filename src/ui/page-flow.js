function initPageFlow(){
  document.getElementById('btnMeta').onclick=showMetaPage;
  document.getElementById('btnMetaBack').onclick=showSelectPage;
  document.getElementById('btnMetaArchive').onclick=showArchivePage;
  document.getElementById('btnShop').onclick=showShopPage;
  document.getElementById('btnShopBack').onclick=showSelectPage;
  document.getElementById('btnShopArchive').onclick=showArchivePage;
  const enemyTestBtn=document.getElementById('btnEnemyTest');
  if(enemyTestBtn)enemyTestBtn.onclick=startEnemyCombatTest;
  document.querySelectorAll('.btnStartMode').forEach(btn=>btn.addEventListener('click',startSelectedMode));
  document.getElementById('btnReturnHome').onclick=returnToHome;
  document.getElementById('btnPauseContinue').onclick=()=>gameInstance?.scene?.scenes?.[0]?.togglePause(false);
  document.getElementById('btnPauseHome').onclick=()=>{
    const scene=gameInstance?.scene?.scenes?.[0];
    if(scene)scene.gameOver('主动撤离');
    else returnToHome();
  };
  bindMetaOpenDelegates();
  initDraggablePanels();
  showHomePane('homeMainPane');
}

function bindMetaOpenDelegates(){
  if(bindMetaOpenDelegates._bound)return;
  bindMetaOpenDelegates._bound=true;
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-open-meta]');
    if(!btn)return;
    e.preventDefault();
    showMetaPage();
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-open-shop]');
    if(!btn)return;
    e.preventDefault();
    showShopPage();
  });
}

function showMetaPage(){
  hidePage('selectPage');
  hidePage('shopPage');
  document.getElementById('metaPage').style.display='flex';
  renderMeta();
}

function showShopPage(){
  hidePage('selectPage');
  hidePage('metaPage');
  document.getElementById('shopPage').style.display='flex';
  renderShop();
}

function showArchivePage(){
  hidePage('metaPage');
  hidePage('shopPage');
  document.getElementById('selectPage').style.display='flex';
  showHomePane('homeArchivePane');
}

function showSelectPage(){
  hidePage('metaPage');
  hidePage('shopPage');
  document.getElementById('selectPage').style.display='flex';
  showHomePane('homeMainPane');
}

let launchInProgress=false;

function finishLaunchAttempt(){
  launchInProgress=false;
}

function startSelectedMode(){
  if(launchInProgress||!selectedTowers.length||selectedModeLocked())return;
  destroyGameInstance();
  enableGameNavigationGuard();
  hidePage('selectPage');
  hidePage('gameOverPanel');
  hidePage('pausePanel');
  hideEnemyTestPanel();
  document.getElementById('gamePage').style.display='flex';
  setGameChromeVisible(true);
  if(typeof r32DebugRecordLaunch==='function')r32DebugRecordLaunch(selectedMode,selectedTowers.length);
  launchGameAfterPaint(selectedTowers.slice(),selectedMode);
}

function startEnemyCombatTest(){
  if(launchInProgress)return;
  destroyGameInstance();
  enableGameNavigationGuard();
  hidePage('selectPage');
  hidePage('gameOverPanel');
  hidePage('pausePanel');
  document.getElementById('gamePage').style.display='flex';
  setGameChromeVisible(true);
  if(typeof r32DebugRecordLaunch==='function')r32DebugRecordLaunch(ENEMY_TEST_MODE,0);
  launchGameAfterPaint([],ENEMY_TEST_MODE);
}

function launchGameAfterPaint(towers,mode){
  launchInProgress=true;
  if(typeof r32SetLoading==='function')r32SetLoading('准备启动',mode,0.08);
  const launchWatchdog=setTimeout(()=>{
    if(!launchInProgress)return;
    if(typeof r32SetLoading==='function')r32SetLoading('启动超时','请截图 debug 信息或刷新重试',1);
  },15000);
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      try{
        gameInstance=launch(towers,mode);
      }catch(err){
        finishLaunchAttempt();
        clearTimeout(launchWatchdog);
        if(typeof r32LoadingFailed==='function')r32LoadingFailed(err);
        else throw err;
      }
    },0);
  });
}

function returnToHome(){
  disableGameNavigationGuard();
  hidePage('gameOverPanel');
  hidePage('pausePanel');
  hidePage('gamePage');
  hidePage('metaPage');
  hidePage('shopPage');
  hideEnemyTestPanel();
  destroyGameInstance();
  document.getElementById('selectPage').style.display='flex';
  showHomePane('homeMainPane');
}

function hidePage(id){
  document.getElementById(id).style.display='none';
}

function hideEnemyTestPanel(){
  const panel=document.getElementById('enemyTestPanel');
  if(panel)panel.style.display='none';
}

function destroyGameInstance(){
  launchInProgress=false;
  if(!gameInstance)return;
  gameInstance.destroy(true);
  gameInstance=null;
  const gamePage=document.getElementById('gamePage');
  if(gamePage)gamePage.querySelectorAll('canvas:not(#miniMap)').forEach(canvas=>canvas.remove());
}

let gameNavigationGuardActive=false;
let gameNavigationGuardInstalled=false;

function gameSessionActive(){
  const gamePage=document.getElementById('gamePage');
  return !!gameInstance&&gamePage?.style.display!=='none';
}

function enableGameNavigationGuard(){
  installGameNavigationGuard();
  if(gameNavigationGuardActive)return;
  gameNavigationGuardActive=true;
  try{
    if(typeof history!=='undefined'&&history.pushState)history.pushState({r32GameGuard:true},'',location.href);
  }catch(_){}
}

function disableGameNavigationGuard(){
  gameNavigationGuardActive=false;
}

function installGameNavigationGuard(){
  if(gameNavigationGuardInstalled)return;
  gameNavigationGuardInstalled=true;
  if(typeof window==='undefined')return;
  window.addEventListener('popstate',event=>{
    if(!gameNavigationGuardActive||!gameSessionActive())return;
    try{
      if(typeof history!=='undefined'&&history.pushState)history.pushState({r32GameGuard:true},'',location.href);
    }catch(_){}
    const scene=activeGameScene();
    scene?.togglePause?.(true);
    const hud=document.getElementById('hudPhase');
    if(hud)hud.textContent='已拦截浏览器返回 · 游戏已暂停';
    event.preventDefault?.();
  });
  window.addEventListener('beforeunload',event=>{
    if(!gameNavigationGuardActive||!gameSessionActive())return;
    event.preventDefault();
    event.returnValue='';
  });
  document.addEventListener('mousedown',blockBrowserNavigationMouseButton,true);
  document.addEventListener('mouseup',blockBrowserNavigationMouseButton,true);
  document.addEventListener('auxclick',blockBrowserNavigationMouseButton,true);
  document.addEventListener('wheel',blockHorizontalNavigationWheel,{capture:true,passive:false});
}

function blockBrowserNavigationMouseButton(event){
  if(!gameNavigationGuardActive||!gameSessionActive())return;
  if(event.button!==3&&event.button!==4)return;
  event.preventDefault();
  event.stopPropagation();
}

function blockHorizontalNavigationWheel(event){
  if(!gameNavigationGuardActive||!gameSessionActive())return;
  const horizontal=Math.abs(event.deltaX||0)>Math.abs(event.deltaY||0)*1.2;
  if(!horizontal)return;
  event.preventDefault();
  event.stopPropagation();
}
