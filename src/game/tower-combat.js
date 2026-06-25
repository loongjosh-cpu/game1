const TowerCombatMethods={
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
  },
  towerCannotAttack(td,up){
    if(td.id==='B1'||td.id==='B7')return true;
    return !up.d&&!td.poisonAura&&td.id!=='P6'
  },
  runSpecialTowerAttack(td,tw,up,range,targets){
    if(td.poisonAura){this.runPoisonAuraTower(tw,up,range,targets);return true}
    if(td.id==='P6'){this.runPoisonAlphaTower(tw,up,targets);return true}
    if(td.id==='B2'){this.areaAttack(tw,up,0xff7733);return true}
    if(td.id==='B4'){this.areaAttack(tw,up,0x66ccff);return true}
    if(td.id==='P4'){this.runCondenseTower(td,tw,up,targets);return true}
    if(td.id==='P7'){this.runPoisonBetaTower(td,tw,up,targets);return true}
    if(td.chain&&up.targets){this.fireElectricChain(tw,targets,up);return true}
    return false
  },
  runPoisonAuraTower(tw,up,range,targets){
    this.flashPoisonAura(tw.x,tw.y,range,targets);
    targets.forEach(e=>this.applyPoison(e,up.pa||1))
  },
  runPoisonAlphaTower(tw,up,targets){
    if((tw._lv||0)>=2){
      targets.sort((a,b)=>((a._poisons?.length||0)>0)-((b._poisons?.length||0)>0))
    }
    targets.slice(0,up.ps||2).forEach(e=>this.firePoisonBolt(tw.x,tw.y,e,1))
  },
  runCondenseTower(td,tw,up,targets){
    targets.sort((a,b)=>(b._slowT>0)-(a._slowT>0));
    const count=up.n||1,slow=this.meta.p4Slow?0.5:(up.sl||td.slow);
    targets.slice(0,count).forEach(e=>{
      this.fireBolt(tw.x,tw.y,e,up.d||0,{slow,duration:2000})
    })
  },
  runPoisonBetaTower(td,tw,up,targets){
    tw._metaShots++;
    targets.sort((a,b)=>((b._poisons?.length||0)>0)-((a._poisons?.length||0)>0));
    targets.slice(0,up.n||1).forEach(target=>{
      let dmg=up.d||0;
      if(target._poisons?.length)dmg+=up.pb||td.poisonBonus||5;
      this.fireBolt(tw.x,tw.y,target,dmg);
      if(this.meta.p7Poison&&tw._metaShots%3===0)this.applyPoison(target,1)
    })
  },
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
  },
  updateTowers(dt){
    this.fxLine.clear();
    this.towers.children.iterate(tw=>{if(tw&&tw.active&&tw._type)this.runTower(tw._type,tw,dt)});
    this.blockers.children.iterate(tw=>{if(tw&&tw.active&&tw._type)this.runTower(tw._type,tw,dt)})
  }
};
