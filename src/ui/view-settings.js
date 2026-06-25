const ViewModeController={
  buttonIds:['btnViewToggle','btnPauseViewToggle'],
  labelIds:['homeViewMode','homeSettingsViewMode','pauseViewMode'],
  normalize(mode){
    return mode==='global'?'global':'local';
  },
  current(){
    metaSave=normalizeMetaSave(metaSave);
    metaSave.settings.cameraMode=this.normalize(metaSave.settings.cameraMode);
    return metaSave.settings.cameraMode;
  },
  label(mode=this.current()){
    return this.normalize(mode)==='global'?'全局视角':'局部视角';
  },
  next(mode=this.current()){
    return this.normalize(mode)==='local'?'global':'local';
  },
  set(mode){
    metaSave=normalizeMetaSave(metaSave);
    const nextMode=this.normalize(mode);
    metaSave.settings={...metaSave.settings,cameraMode:nextMode};
    saveMeta();
    this.sync();
    activeGameScene()?.applyViewSettings?.();
    window.dispatchEvent(new CustomEvent('r32:view-mode-change',{detail:{cameraMode:nextMode}}));
    return nextMode;
  },
  toggle(){
    return this.set(this.next());
  },
  handleButton(btn,e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
    if(!btn)return false;
    if(Object.prototype.hasOwnProperty.call(btn.dataset,'viewToggle')){
      this.toggle();
      return true;
    }
    if(btn.dataset.viewCamera){
      this.set(btn.dataset.viewCamera);
      return true;
    }
    return false;
  },
  bindButton(id){
    const btn=document.getElementById(id);
    if(!btn||btn.dataset.viewBound==='1')return;
    btn.dataset.viewBound='1';
    btn.onclick=e=>this.handleButton(btn,e);
    btn.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        this.handleButton(btn,e);
      }
    });
  },
  init(){
    this.buttonIds.forEach(id=>this.bindButton(id));
    this.sync();
  },
  sync(){
    const mode=this.current();
    const label=this.label(mode);
    this.labelIds.forEach(id=>setText(id,label));
    this.buttonIds.forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.classList.toggle('active',mode==='local');
      el.setAttribute('aria-pressed',mode==='local'?'true':'false');
      el.title=mode==='local'?'切换到全局视角':'切换到局部视角';
      el.textContent='视角切换';
    });
  }
};

window.ViewModeController=ViewModeController;

function viewSettings(){
  metaSave=normalizeMetaSave(metaSave);
  return metaSave.settings;
}

function setViewSettings(patch){
  const next={...viewSettings(),...patch};
  return ViewModeController.set(next.cameraMode);
}

function viewModeLabel(mode=ViewModeController.current()){
  return ViewModeController.label(mode);
}

function toggleViewMode(){
  return ViewModeController.toggle();
}

function activateViewControl(btn,e){
  return ViewModeController.handleButton(btn,e);
}

function bindViewSettingsUI(){
  if(bindViewSettingsUI._bound)return;
  bindViewSettingsUI._bound=true;
  ViewModeController.init();
  document.querySelectorAll('[data-settings-tab]').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const key=tab.dataset.settingsTab;
      document.querySelectorAll('[data-settings-tab]').forEach(t=>t.classList.toggle('active',t===tab));
      document.querySelectorAll('[data-settings-panel]').forEach(panel=>{
        panel.classList.toggle('active',panel.dataset.settingsPanel===key);
      });
    });
  });
}

function syncViewSettingsUI(){
  ViewModeController.sync();
}

function syncHomeViewSummary(){
  syncViewSettingsUI();
}

window.activateViewControl=activateViewControl;
