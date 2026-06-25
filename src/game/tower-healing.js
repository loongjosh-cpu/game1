const TowerHealingMethods={
  runHealTower(tw,up,range){
    if(tw._at<1000)return;
    tw._at=0;
    const hurt=this.findHealTarget(tw,range);
    if(hurt)this.healBlocker(hurt,up.hl||3)
  },
  findHealTarget(tw,range){
    let hurt=null,ratio=1;
    this.blockers.children.iterate(o=>{
      if(!this.canTowerHealTarget(tw,o))return;
      const dist=Phaser.Math.Distance.Between(tw.x,tw.y,o.x,o.y);
      const hpRatio=o._wreck?(o._repair||0)/200:o._hp/o._maxhp;
      if(dist<=range&&hpRatio<ratio){hurt=o;ratio=hpRatio}
    });
    this.drones.children.iterate(o=>{
      if(!this.canTowerHealTarget(tw,o))return;
      const dist=Phaser.Math.Distance.Between(tw.x,tw.y,o.x,o.y);
      const hpRatio=o._hp/o._maxhp;
      if(dist<=range&&hpRatio<ratio){hurt=o;ratio=hpRatio}
    });
    return hurt
  },
  canTowerHealTarget(tw,target){
    if(!target||!target.active||target===tw)return false;
    if(target._wreck&&!this.meta.b1Repair)return false;
    if(target._type.id==='B5')return false;
    return target._wreck||target._hp<target._maxhp
  }
};
