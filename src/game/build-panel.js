const BuildPanelMethods={
  buildChoices(){return[...this.selTowers,SMALL_REACTOR]},
  rebuildPanel(){
    const bp=document.getElementById('buildPanel');
    bp.innerHTML='';
    this.buildChoices().forEach((t,i)=>bp.appendChild(this.createBuildButton(t,i)));
    this.updPanel();
  },
  createBuildButton(t,i){
    const btn=document.createElement('button');
    btn.className='build-btn';
    btn.textContent=this.buildButtonText(t,i);
    btn.title=t.name+' — '+t.desc;
    btn.addEventListener('click',()=>this.selectBuildChoice(t,i));
    return btn;
  },
  buildButtonText(t,i){
    if(t===SMALL_REACTOR)return `R · ${t.name} ${this.smallReactorCount()}/${t.maxCount} ${t.cost}⚡`;
    return (i+1)+' · '+t.name+' '+t.cost+'⚡';
  },
  selectBuildChoice(t,i){
    this.sel=t;
    this.updPanel();
    this.scrollBtnIntoView(i);
  },
  updPanel(){
    const bp=document.getElementById('buildPanel');
    const choices=this.buildChoices();
    bp.querySelectorAll('.build-btn').forEach((btn,i)=>this.updateBuildButton(btn,choices[i],i));
    bp.style.display=this.bld?'flex':'none';
  },
  updateBuildButton(btn,t,i){
    const atLimit=t===SMALL_REACTOR&&this.smallReactorCount()>=SMALL_REACTOR.maxCount;
    const cant=this.en<t.cost||atLimit||this.channel;
    btn.className='build-btn'+(this.sel===t?' active':cant?' cant':'');
    if(t===SMALL_REACTOR)btn.textContent=this.buildButtonText(t,i);
  },
  scrollBtnIntoView(idx){
    const bp=document.getElementById('buildPanel');
    const btn=bp.children[idx];
    if(btn)btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }
};
