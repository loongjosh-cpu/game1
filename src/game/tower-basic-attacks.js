const TowerBasicAttackMethods={
  runBasicTowerAttack(td,tw,up,targets){
    if(td.id==='P5')targets.sort((a,b)=>(EC[b._type].danger-EC[a._type].danger));
    const target=targets[0];
    tw._metaShots++;
    const dmg=this.basicTowerDamage(td,tw,up,target);
    if(td.id==='P3'&&td.splash&&up.s){
      this.fireP3Shell(tw.x,tw.y,target,dmg,sd(up.s))
    }else if(td.splash&&up.s){
      this.applyInstantSplash(targets,target,dmg,sd(up.s))
    }else{
      this.fireBasicBolt(td,tw,target,dmg)
    }
    if(td.id==='B3'&&this.meta.b3Leech)this.healBlocker(tw,2)
  },
  basicTowerDamage(td,tw,up,target){
    let dmg=up.d||0;
    if(td.id!=='P5')return dmg;
    if(tw._focusTarget===target){
      tw._focus=(tw._focus||0)+(up.focus||10)+(this.meta.p5Focus&&tw._metaShots%2===0?1:0)
    }else{
      tw._focusTarget=target;
      tw._focus=0
    }
    return dmg+tw._focus
  },
  applyInstantSplash(targets,target,dmg,radius){
    targets
      .filter(e=>Phaser.Math.Distance.Between(target.x,target.y,e.x,e.y)<=radius)
      .forEach(e=>this.damageEnemy(e,dmg))
  },
  fireBasicBolt(td,tw,target,dmg){
    this.fireBolt(tw.x,tw.y,target,dmg);
    if(td.id==='P1'&&this.meta.p1Double&&Math.random()<0.33){
      this.fireBolt(tw.x,tw.y,target,dmg)
    }
  }
};
