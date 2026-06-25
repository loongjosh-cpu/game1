function activateHomePane(btn,e){
  const paneId=btn?.dataset?.homePane;
  if(!paneId)return false;
  if(e){
    e.preventDefault();
    e.stopPropagation();
  }
  showHomePane(paneId);
  return true;
}

window.activateHomePane=activateHomePane;

function setGameChromeVisible(visible){
  const hud=document.getElementById('hud');
  const hints=document.getElementById('controlHints');
  if(hud)hud.style.display=visible?'flex':'none';
  if(hints)hints.style.display=visible?'block':'none';
  if(!visible){
    ['miniMapWrap','buildPanel','twPanel','channelPanel'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.style.display='none';
    });
  }
}

function bindHomePaneNavigation(){
  if(bindHomePaneNavigation._bound)return;
  bindHomePaneNavigation._bound=true;
  document.querySelectorAll('[data-home-pane]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      activateHomePane(btn,e);
    });
  });
}

function renderHome(){
  setGameChromeVisible(false);
  syncViewSettingsUI();
  setText('homeCoreCount',metaSave.cores);
  setText('homeBestWave',metaSave.bestWave);
  setText('metaCoreCount',metaSave.cores);
  setText('shopCoreCount',metaSave.cores);
  setText('homeCurrentMode',modeLabel());
  syncHomeViewSummary();
}

function setText(id,value){
  const el=document.getElementById(id);
  if(el)el.textContent=value;
}

let selectedTowers=[],selectedMode='level1';

function isLevelMode(mode){return LEVEL_UI_ORDER.includes(mode)}
function levelIndex(mode){return LEVEL_UI_ORDER.indexOf(mode)}
function isLevelCleared(mode){return !!metaSave.levelClears?.[mode]}

function isLevelUnlocked(mode){
  const idx=levelIndex(mode);
  return idx<0||idx===0||isLevelCleared(LEVEL_UI_ORDER[idx-1]);
}

function selectedModeLocked(){return isLevelMode(selectedMode)&&!isLevelUnlocked(selectedMode)}
function modeLabel(){return document.querySelector(`[data-mode="${selectedMode}"] strong`)?.textContent||'关卡模式'}

function setTextAll(selector,value){
  document.querySelectorAll(selector).forEach(el=>{el.textContent=value});
}

function refreshModeLocks(){
  document.querySelectorAll('[data-mode]').forEach(card=>{
    const mode=card.dataset.mode,locked=isLevelMode(mode)&&!isLevelUnlocked(mode),cleared=isLevelMode(mode)&&isLevelCleared(mode);
    card.classList.toggle('locked',locked);
    card.setAttribute('aria-disabled',locked?'true':'false');
    const state=card.querySelector('[data-level-state]');
    if(state)state.textContent=cleared?'已通关':locked?'通关上一关后解锁':'可挑战';
  });
}

function refreshStartButton(){
  refreshModeLocks();
  const label=modeLabel();
  const locked=selectedModeLocked();
  setTextAll('.selCount',selectedTowers.length);
  setTextAll('.homeStartTowerCount',selectedTowers.length);
  setText('homeCurrentMode',label);
  document.querySelectorAll('.btnStartMode').forEach(btn=>{
    btn.disabled=selectedTowers.length===0||locked;
    btn.textContent=locked?'关卡未解锁':startButtonText(label);
  });
  setTextAll('.modeHint',locked?'该关卡尚未解锁，请先通关上一关。':'选择'+label+'出击塔（最多10个）');
  syncTowerSelectionCards();
}

function startButtonText(label){
  return selectedTowers.length
    ?'开始 '+label+'（已选 '+selectedTowers.length+' 个）'
    :'开始 '+label;
}

function renderLoadoutGrids(){
  document.querySelectorAll('[data-loadout-grid]').forEach(grid=>{
    if(grid.dataset.rendered==='1')return;
    grid.dataset.rendered='1';
    ALL_TOWERS.forEach((t,i)=>grid.appendChild(createTowerSelectCard(t,i)));
    grid.addEventListener('wheel',e=>{
      e.preventDefault();
      document.getElementById('selectPage').scrollTop+=e.deltaY;
    },{passive:false});
  });
}

function createTowerSelectCard(t,i){
  const card=document.createElement('div');
  card.className='twCard';
  card.dataset.towerIndex=i;
  card.innerHTML=towerSelectCardHtml(t);
  card.addEventListener('click',()=>toggleTowerSelection(i));
  return card;
}

function towerSelectCardHtml(t){
  return `<span class="ttype type-${t.type}">${towerCardTypeName(t)}</span><div class="tname">${t.name}</div><div class="tcost">${t.cost}⚡</div><div class="tstat">${t.desc}</div>`;
}

function towerCardTypeName(t){
  return t.type==='path'?'路径':t.type==='block'?'阻挡':'无人机';
}

function syncTowerSelectionCards(){
  document.querySelectorAll('[data-tower-index]').forEach(card=>{
    card.classList.toggle('selected',selectedTowers.includes(Number(card.dataset.towerIndex)));
  });
}

function toggleTowerSelection(i){
  const idx=selectedTowers.indexOf(i);
  if(idx>=0){
    selectedTowers.splice(idx,1);
  }else if(selectedTowers.length<10){
    selectedTowers.push(i);
  }
  syncTowerSelectionCards();
  refreshStartButton();
}

function bindModeCards(){
  if(bindModeCards._bound)return;
  bindModeCards._bound=true;
  document.querySelectorAll('[data-mode]').forEach(card=>card.addEventListener('click',()=>selectModeCard(card)));
}

function selectModeCard(card){
  if(card.classList.contains('locked'))return;
  selectedMode=card.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(c=>c.classList.toggle('active',c.dataset.mode===selectedMode));
  refreshStartButton();
}

function ensureModeForPane(paneId){
  if(paneId==='homeLevelPane'&&!isLevelMode(selectedMode)){
    selectedMode=LEVEL_UI_ORDER.find(isLevelUnlocked)||'level1';
  }
  if(paneId==='homeEndlessPane'&&isLevelMode(selectedMode)){
    selectedMode='endless1';
  }
  document.querySelectorAll('[data-mode]').forEach(c=>c.classList.toggle('active',c.dataset.mode===selectedMode));
}

function showHomePane(paneId='homeMainPane'){
  document.querySelectorAll('.homePane').forEach(p=>p.classList.toggle('active',p.id===paneId));
  ensureModeForPane(paneId);
  const selectPage=document.getElementById('selectPage');
  const homeShell=document.querySelector('.homeShell');
  if(homeShell)homeShell.classList.toggle('subPaneShell',paneId!=='homeMainPane');
  if(selectPage)selectPage.scrollTop=0;
  try{
    renderHome();
    refreshStartButton();
    if(paneId==='homeArchivePane'){
      renderTowerArchive();
      resetArchiveScroll({list:true});
    }
  }catch(err){
    console.warn('主界面刷新失败，已保留页面切换结果',err);
  }
}

function initHomeUi(){
  bindHomePaneNavigation();
  bindViewSettingsUI();
  bindArchiveTabs();
  renderLoadoutGrids();
  bindModeCards();
}
