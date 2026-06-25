const TowerRuntimeMethods={
  runTower(td,tw,dt){
    if(tw._wreck)return;
    const up=td.upg[tw._lv||0],range=sd(up.r||td.range);
    tw._at=(tw._at||0)+dt;
    this.updateTowerPassive(td,tw,dt);
    if(td.heal){this.runHealTower(tw,up,range);return}
    if(this.towerCannotAttack(td,up))return;

    const interval=up.i||1000;
    if(tw._at<interval)return;
    const targets=this.findTargets(tw.x,tw.y,range);
    if(!targets.length)return;
    tw._at=0;
    if(this.runSpecialTowerAttack(td,tw,up,range,targets))return;
    this.runBasicTowerAttack(td,tw,up,targets)
  },
  updateTowerPassive(td,tw,dt){
    if(td.id!=='B4'||!this.meta.b4Shield)return;
    tw._shieldClock=(tw._shieldClock||0)+dt;
    while(tw._shieldClock>=10000){
      tw._shieldClock-=10000;
      tw._shield=Math.min(5,(tw._shield||0)+1)
    }
  },
  towerCannotAttack(td,up){
    if(td.id==='B1'||td.id==='B7')return true;
    return !up.d&&!td.poisonAura&&td.id!=='P6'
  },
  updateTowers(dt){
    this.fxLine.clear();
    this.towers.children.iterate(tw=>{if(tw&&tw.active&&tw._type)this.runTower(tw._type,tw,dt)});
    this.blockers.children.iterate(tw=>{if(tw&&tw.active&&tw._type)this.runTower(tw._type,tw,dt)})
  }
};
