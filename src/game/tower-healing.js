const TowerHealingMethods={
  runHealTower(tw,up,range){
    if(tw._at<1000)return;
    tw._at=0;
    const hurt=this.findHealTarget(tw,range);
    if(hurt){
      if(hurt._owner)this.healDroneHelper(hurt,up.hl||3);
      else this.healBlocker(hurt,up.hl||3);
      return
    }
    if(this.meta.b5Overheal){
      const shieldTarget=this.findShieldTarget(tw,range);
      if(shieldTarget)this.grantTowerShield(shieldTarget,up.hl||3)
    }
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
    if(this.meta.b5DroneHeal){
      this.droneHelpers.children.iterate(o=>{
        if(!o||!o.active||o._noHeal||o._hp>=o._maxhp)return;
        const dist=Phaser.Math.Distance.Between(tw.x,tw.y,o.x,o.y);
        const hpRatio=o._hp/o._maxhp;
        if(dist<=range&&hpRatio<ratio){hurt=o;ratio=hpRatio}
      })
    }
    return hurt
  },
  canTowerHealTarget(tw,target){
    if(!target||!target.active||target===tw)return false;
    if(target._wreck&&!this.meta.b1Repair)return false;
    if(target._type.id==='B5')return false;
    if(target._type?.type==='drone'&&!this.meta.b5DroneHeal)return false;
    return target._wreck||target._hp<target._maxhp
  },
  healDroneHelper(d,amount){
    const before=d._hp;
    d._hp=Math.min(d._maxhp,d._hp+amount);
    return d._hp-before
  },
  findShieldTarget(tw,range){
    let target=null,shield=Infinity;
    const consider=o=>{
      if(!o||!o.active||o===tw||o._wreck||o._hp<o._maxhp)return;
      if(o._type?.id==='B5')return;
      if(o._type?.type==='drone'&&!this.meta.b5DroneHeal)return;
      if(Phaser.Math.Distance.Between(tw.x,tw.y,o.x,o.y)>range)return;
      const current=o._overShield||0;
      if(current<100&&current<shield){target=o;shield=current}
    };
    this.blockers.children.iterate(consider);
    this.drones.children.iterate(consider);
    return target
  },
  grantTowerShield(target,amount){
    target._overShield=Math.min(100,(target._overShield||0)+amount);
    this.flashArea(target.x,target.y,sd(45),0x44dd88)
  }
};
