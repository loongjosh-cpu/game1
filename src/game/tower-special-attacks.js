const TowerSpecialAttackMethods={
  runSpecialTowerAttack(td,tw,up,range,targets){
    if(td.poisonAura){this.runPoisonAuraTower(tw,up,range,targets);return true}
    if(td.id==='P6'){this.runPoisonAlphaTower(tw,up,targets);return true}
    if(td.id==='B2'){this.runFlameTower(tw,up);return true}
    if(td.id==='B4'){this.areaAttack(tw,up,0x66ccff);return true}
    if(td.id==='P4'){this.runCondenseTower(td,tw,up,targets);return true}
    if(td.id==='P7'){this.runPoisonBetaTower(td,tw,up,targets);return true}
    if(td.chain&&up.targets){this.fireElectricChain(tw,targets,up);return true}
    return false
  },
  runFlameTower(tw,up){
    tw._metaShots++;
    if(this.meta.b2Surge&&tw._metaShots%3===0){
      const range=sd(1200),dmg=(up.d||0)*1.5;
      this.flashArea(tw.x,tw.y,range,0xff7733);
      this.findTargets(tw.x,tw.y,range).forEach(e=>this.damageEnemy(e,dmg));
      return
    }
    this.areaAttack(tw,up,0xff7733)
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
    targets.sort((a,b)=>{
      if(this.meta.p4Freeze){
        const af=a._frozenT>0,bf=b._frozenT>0;
        if(af!==bf)return af-bf
      }
      return (b._slowT>0)-(a._slowT>0)
    });
    const count=up.n||1,slow=this.meta.p4Slow?0.5:(up.sl||td.slow);
    targets.slice(0,count).forEach(e=>{
      this.fireBolt(tw.x,tw.y,e,up.d||0,{slow,duration:2000,freeze:this.meta.p4Freeze})
    })
  },
  runPoisonBetaTower(td,tw,up,targets){
    tw._metaShots++;
    targets.sort((a,b)=>((b._poisons?.length||0)>0)-((a._poisons?.length||0)>0));
    targets.slice(0,up.n||1).forEach(target=>{
      let dmg=up.d||0;
      const poisoned=this.poisonLayerCount(target)>0;
      if(poisoned)dmg+=up.pb||td.poisonBonus||5;
      if(this.meta.p7Burst&&poisoned){
        const layers=this.poisonLayerCount(target);
        dmg+=this.remainingPoisonDamage(target)+layers*2;
        this.consumePoison(target);
        this.applyPoison(target,1)
      }
      this.fireBolt(tw.x,tw.y,target,dmg);
      if(this.meta.p7Poison&&tw._metaShots%3===0)this.applyPoison(target,1)
    })
  }
};
