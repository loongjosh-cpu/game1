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

function startSelectedMode(){
  if(!selectedTowers.length||selectedModeLocked())return;
  destroyGameInstance();
  hidePage('selectPage');
  hidePage('gameOverPanel');
  hidePage('pausePanel');
  hideEnemyTestPanel();
  document.getElementById('gamePage').style.display='flex';
  setGameChromeVisible(true);
  if(typeof r32DebugRecordLaunch==='function')r32DebugRecordLaunch(selectedMode,selectedTowers.length);
  gameInstance=launch(selectedTowers,selectedMode);
}

function startEnemyCombatTest(){
  destroyGameInstance();
  hidePage('selectPage');
  hidePage('gameOverPanel');
  hidePage('pausePanel');
  document.getElementById('gamePage').style.display='flex';
  setGameChromeVisible(true);
  if(typeof r32DebugRecordLaunch==='function')r32DebugRecordLaunch(ENEMY_TEST_MODE,0);
  gameInstance=launch([],ENEMY_TEST_MODE);
}

function returnToHome(){
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
  if(!gameInstance)return;
  gameInstance.destroy(true);
  gameInstance=null;
  const gamePage=document.getElementById('gamePage');
  if(gamePage)gamePage.replaceChildren();
}
