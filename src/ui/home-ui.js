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

function modePaneForMode(mode){
  return isLevelMode(mode)?'homeLevelPane':mode&&mode.startsWith('endless')?'homeEndlessPane':'';
}

function setHomeFlowStage(paneId,stage='mode'){
  const pane=document.getElementById(paneId);
  if(!pane)return;
  pane.dataset.flowStage=stage;
  const title=pane.querySelector('[data-flow-selected-title]');
  if(title)title.textContent=modeLabel();
  refreshStartButton();
}

function prepareModeFlowPane(paneId){
  const pane=document.getElementById(paneId);
  if(!pane||pane.dataset.flowPrepared==='1')return;
  pane.dataset.flowPrepared='1';
  pane.dataset.flowStage='mode';
  const sections=[...pane.querySelectorAll('.homeStack > .homeSection')];
  const [modeSection,loadoutSection,startSection]=sections;
  if(modeSection){
    modeSection.dataset.flowStep='mode';
    modeSection.classList.add('homeStagePanel');
    const actions=document.createElement('div');
    actions.className='modeFlowActions';
    actions.innerHTML='<span class="modeFlowHint">选择作战地图后进入塔组整备。</span><button type="button" class="menuBtn modeNextBtn" data-flow-next>选择塔组</button>';
    modeSection.appendChild(actions);
    actions.querySelector('[data-flow-next]')?.addEventListener('click',()=>setHomeFlowStage(paneId,'loadout'));
  }
  if(loadoutSection){
    loadoutSection.dataset.flowStep='loadout';
    loadoutSection.classList.add('homeStagePanel','homeLoadoutPanel');
    const head=loadoutSection.querySelector('.sectionHead');
    if(head&&!head.querySelector('[data-flow-back]')){
      const back=document.createElement('button');
      back.type='button';
      back.className='menuBtn flowBackBtn';
      back.dataset.flowBack='1';
      back.textContent='重新选择地图';
      back.addEventListener('click',()=>setHomeFlowStage(paneId,'mode'));
      head.appendChild(back);
    }
  }
  if(startSection){
    startSection.dataset.flowStep='loadout';
    startSection.classList.add('homeConfirmPanel');
    const hint=startSection.querySelector('.modeHint');
    if(hint&&!startSection.querySelector('[data-flow-selected-title]')){
      const selected=document.createElement('div');
      selected.className='selectedModeBanner';
      selected.innerHTML='当前地图：<strong data-flow-selected-title></strong>';
      startSection.insertBefore(selected,startSection.firstChild);
    }
  }
}

function prepareModeFlowPanes(){
  prepareModeFlowPane('homeLevelPane');
  prepareModeFlowPane('homeEndlessPane');
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
  document.querySelectorAll('[data-flow-next]').forEach(btn=>{
    btn.disabled=locked;
    btn.textContent=locked?'关卡未解锁':'选择塔组';
  });
  document.querySelectorAll('[data-flow-selected-title]').forEach(el=>{el.textContent=label});
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

function renderLevelChapters(){
  const grid=document.querySelector('[data-mode-group="level"]');
  if(!grid||grid.dataset.chapterRendered==='1')return;
  grid.dataset.chapterRendered='1';
  grid.innerHTML='';
  for(let start=0;start<LEVEL_UI_ORDER.length;start+=5){
    const chapter=document.createElement('section');
    chapter.className='levelChapter';
    const chapterNo=Math.floor(start/5)+1;
    const end=Math.min(start+5,LEVEL_UI_ORDER.length);
    chapter.innerHTML=`<div class="levelChapterHead"><span>章节 ${chapterNo}</span><strong>关卡${String(start+1).padStart(2,'0')} - 关卡${String(end).padStart(2,'0')}</strong></div>`;
    const list=document.createElement('div');
    list.className='levelChapterGrid';
    LEVEL_UI_ORDER.slice(start,end).forEach(id=>list.appendChild(createLevelModeCard(id)));
    chapter.appendChild(list);
    grid.appendChild(chapter);
  }
}

function createLevelModeCard(id){
  const level=LEVELS[id]||{};
  const n=Number(id.replace('level',''))||levelIndex(id)+1;
  const card=document.createElement('div');
  card.className='modeCard';
  if(id===selectedMode)card.classList.add('active');
  card.dataset.mode=id;
  const title=level.name||`关卡${String(n).padStart(2,'0')}`;
  const summary=level.map?.summary||level.map?.notes?.[0]||level.summary||'固定关卡挑战。';
  card.innerHTML=`<strong>${title}</strong><span class="modeDesc"></span><span class="modeMeta" data-level-state>未解锁</span>`;
  card.querySelector('.modeDesc').textContent=summary;
  return card;
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
  const paneId=modePaneForMode(selectedMode);
  if(paneId)setHomeFlowStage(paneId,'loadout');
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
  if(paneId==='homeLevelPane'||paneId==='homeEndlessPane')setHomeFlowStage(paneId,'mode');
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
  renderLevelChapters();
  prepareModeFlowPanes();
  renderLoadoutGrids();
  bindModeCards();
}
