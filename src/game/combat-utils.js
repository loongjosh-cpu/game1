const CombatUtilMethods={
  damageEnemy(e,dmg){
    if(!e||!e.active)return;
    const amp=e._freezeAmpT>0?1.2:1;
    e._hp-=dmg*amp;
    if(e._hp<=0)this.killE(e)
  },
  flashArea(x,y,r,color){const g=this.add.graphics().setPosition(x,y).setDepth(16);g.fillStyle(color,0.07);g.fillCircle(0,0,r);g.lineStyle(4,color,0.75);g.strokeCircle(0,0,r);this.tweens.add({targets:g,alpha:0,scaleX:1.08,scaleY:1.08,duration:220,onComplete:()=>g.destroy()})},
  flashPoisonAura(x,y,r,targets){const g=this.add.graphics().setPosition(x,y).setDepth(16).setScale(0.88);g.fillStyle(0x8c3ec4,0.1);g.fillCircle(0,0,r);g.lineStyle(5,0xc96cff,0.78);g.strokeCircle(0,0,r);g.lineStyle(2,0x83ff9b,0.42);g.strokeCircle(0,0,r*0.68);g.strokeCircle(0,0,r*0.35);for(let i=0;i<12;i++){const a=Math.PI*2*i/12+0.2,rr=r*(0.18+(i%4)*0.17);g.fillStyle(i%2?0xb45cff:0x63e88c,0.34);g.fillCircle(Math.cos(a)*rr,Math.sin(a)*rr,5+(i%3)*2)}targets.forEach(e=>{const dx=e.x-x,dy=e.y-y;g.lineStyle(2,0xa852d4,0.45);g.lineBetween(0,0,dx,dy);g.fillStyle(0x91ff9f,0.3);g.fillCircle(dx,dy,18);g.lineStyle(3,0xd57aff,0.85);g.strokeCircle(dx,dy,14)});this.tweens.add({targets:g,alpha:0,scaleX:1.04,scaleY:1.04,duration:420,ease:'Quad.easeOut',onComplete:()=>g.destroy()})},
  createResidual(x,y){const radius=sd(150),g=this.add.graphics().setDepth(5);g.fillStyle(0x66ccff,0.08);g.fillCircle(x,y,radius);g.lineStyle(2,0x88ddff,0.35);g.strokeCircle(x,y,radius);let ticks=0;this.time.addEvent({delay:300,repeat:4,callback:()=>{ticks++;this.findTargets(x,y,radius).forEach(e=>this.damageEnemy(e,1));g.setAlpha(0.5+0.15*(ticks%2));if(ticks>=5)g.destroy()}})},
  areaAttack(tw,up,color){const range=sd(up.r||tw._type.range),tgts=this.findTargets(tw.x,tw.y,range);this.flashArea(tw.x,tw.y,range,color);tgts.forEach(e=>this.damageEnemy(e,up.d||0))},
  combatRadiusOf(target,fallback=32){
    if(!target)return fallback;
    const size=target._size||target.displayWidth||target.width||fallback*2;
    return Math.max(fallback,Number(size)/2||fallback)
  },
  enemyMeleeRange(e,target,base=CLOSE_ATTACK_RANGE){
    const enemyRadius=e?.body?.radius||16;
    const targetRadius=this.combatRadiusOf(target,24);
    return Math.max(sd(base),enemyRadius+targetRadius+sd(18))
  },
  enemyAttackDelay(e){return e._firstAttack?650:e._atk},
  enemyAttackReady(e,dt){e._at=(e._at||0)+dt;const delay=this.enemyAttackDelay(e);if(e._at<delay)return false;e._at=0;e._firstAttack=false;return true},
  enemyAttackEffect(e,mainTarget=null){const cfg=EC[e._type];if(cfg.leechPct)e._hp=Math.min(e._maxhp,e._hp+e._maxhp*cfg.leechPct);else if(cfg.leech)e._hp=Math.min(e._maxhp,e._hp+cfg.leech);if(cfg.summonEvery&&++e._hits%cfg.summonEvery===0)this.spawnAt('E4',e.x+30,e.y,e._si,true,e._waveNo);if(cfg.meleeSplash)this.enemySplash(e,mainTarget,e.x,e.y,e._dmg*cfg.meleeSplash,sd(cfg.meleeSplashRange||50),true,{kind:'aoe',aoe:true})},
  enemySelfDestruct(e,mainTarget=null){
    if(!e||!e.active||e._detonating)return;
    e._detonating=true;
    const cfg=EC[e._type],range=sd(cfg.selfRange||80),dmg=e._dmg,x=e.x,y=e.y;
    this.flashArea(x,y,range,cfg.color||0xff3355);
    if(mainTarget&&mainTarget.active)this.damageFriendly(mainTarget,dmg,e,{kind:'selfDestruct',aoe:false});
    this.enemySplash(e,mainTarget,x,y,dmg,range,true,{kind:'selfDestruct',aoe:true});
    const ex=this.add.image(x,y,'msl').setDepth(17).setTint(cfg.color||0xff3355).setScale(3.2);
    this.tweens.add({targets:ex,alpha:0,scaleX:7,scaleY:7,duration:220,onComplete:()=>ex.destroy()});
    e.destroy()
  },
  damageFriendly(t,dmg,source=null,options={}){return this.applyFriendlyDamage({source,target:t,amount:dmg,...options})},
  applyFriendlyDamage(ctx){
    const target=ctx?.target,source=ctx?.source||null;
    if(!target||!target.active)return 0;
    let damage=Math.max(0,Number(ctx.amount)||0);
    if(damage<=0)return 0;
    damage=this.applyFriendlyDamageModifiers(source,target,damage,ctx);
    if(damage<=0)return 0;
    const beforeShield=damage;
    damage=this.absorbFriendlyShield(target,damage);
    if(damage<beforeShield)this.playFriendlyHitEffect(target,0x8fe8ff,true);
    if(damage<=0)return 0;
    return this.commitFriendlyDamage(target,damage)
  },
  applyFriendlyDamageModifiers(source,target,damage,ctx={}){
    let result=damage;
    if(target._type?.id==='B6'&&this.meta.b6ToxicShell&&this.enemyIsPoisoned(source)){
      result*=0.7
    }
    if(target._owner?._type?.id==='D1'&&this.meta.d1ReactiveArmor&&source?._uid){
      target._enemyHitMemory=target._enemyHitMemory||new Set();
      if(!target._enemyHitMemory.has(source._uid)){
        target._enemyHitMemory.add(source._uid);
        result*=0.4
      }
    }
    if(target._type?.id==='B4'&&this.meta.b4Shield&&(target._shield||0)>0){
      target._shield--;
      result=Math.min(10,result);
      this.flashArea(target.x,target.y,sd(55),0xaaddff)
    }
    return Math.max(0,result)
  },
  enemyIsPoisoned(e){
    return !!(e&&e.active&&e._poisons?.some(p=>p.left>0))
  },
  absorbFriendlyShield(target,damage){
    if(!target._overShield||damage<=0)return damage;
    const absorbed=Math.min(target._overShield,damage);
    target._overShield-=absorbed;
    if(target._overShield<=0)target._overShield=0;
    return damage-absorbed
  },
  playFriendlyHitEffect(target,color=0xff6688,shield=false){
    if(!target||!target.active)return;
    const baseAlpha=Number.isFinite(target.alpha)?target.alpha:1;
    if(target.setAlpha&&this.tweens?.add){
      this.tweens.add({
        targets:target,
        alpha:shield?0.72:0.48,
        duration:80,
        yoyo:true,
        onComplete:()=>{if(target.active&&target.setAlpha)target.setAlpha(baseAlpha)}
      })
    }
    if(!this.add?.graphics||!this.tweens?.add)return;
    const size=Math.max(28,target._size||target.displayWidth||target.width||36);
    const r=size/2+(shield?14:9);
    const g=this.add.graphics().setPosition(target.x,target.y).setDepth(18);
    g.lineStyle(shield?4:3,color,shield?0.85:0.72);
    g.strokeCircle(0,0,r);
    g.fillStyle(color,shield?0.05:0.035);
    g.fillCircle(0,0,r);
    this.tweens.add({targets:g,alpha:0,scaleX:1.22,scaleY:1.22,duration:180,onComplete:()=>g.destroy()})
  },
  commitFriendlyDamage(target,damage){
    if(target._owner){
      this.playFriendlyHitEffect(target,0xff6688,false);
      target._hp-=damage;
      if(target._hp<=0)this.destroyDrone(target);
      return damage
    }
    if(target._isReactor){
      this.playFriendlyHitEffect(target,0xff6688,false);
      target._hp=Math.max(0,target._hp-damage);
      if(target._isMainReactor)this.rxHP=target._hp;
      if(target._hp<=0){
        if(target._isMainReactor)this.gameOver();
        else this.destroyReactor(target)
      }
      return damage
    }
    if(target._type&&(target._type.type==='block'||target._type.type==='drone')){
      this.playFriendlyHitEffect(target,0xff6688,false);
      target._hp-=damage;
      if(target._hp<=0)this.destroyB1(target);
      return damage
    }
    return 0
  },
  enemySplash(e,mainTarget,x,y,dmg,range,includeDrones=false,options={kind:'aoe',aoe:true}){
    this.flashArea(x,y,range,EC[e._type].color||0xff8844);
    this.blockers.children.iterate(t=>{if(t&&t.active&&t!==mainTarget&&Phaser.Math.Distance.Between(x,y,t.x,t.y)<=range)this.damageFriendly(t,dmg,e,options)});
    this.drones.children.iterate(t=>{if(t&&t.active&&t!==mainTarget&&Phaser.Math.Distance.Between(x,y,t.x,t.y)<=range)this.damageFriendly(t,dmg,e,options)});
    this.droneHelpers.children.iterate(d=>{if(d&&d.active&&d!==mainTarget&&Phaser.Math.Distance.Between(x,y,d.x,d.y)<=range)this.damageFriendly(d,dmg,e,options)});
    for(const r of this.reactors){if(r&&r.active&&r!==mainTarget&&Phaser.Math.Distance.Between(x,y,r.x,r.y)<=range)this.damageFriendly(r,dmg,e,options)}
    if(this.ship&&!this.shipDead&&this.ship.active!==false&&this.ship!==mainTarget&&Phaser.Math.Distance.Between(x,y,this.ship.x,this.ship.y)<=range)this.killShip()
  },
  chooseDroneInRange(e,range){let best=null,bd=Infinity;this.droneHelpers.children.iterate(d=>{if(!d||!d.active||d._hp<=0)return;const dist=Phaser.Math.Distance.Between(e.x,e.y,d.x,d.y);if(dist<=range&&dist<bd){best=d;bd=dist}});return best},
  fireEnemyDart(e,tgt,speed,dmg){const p=this.add.image(e.x,e.y,'bolt').setDepth(8).setTint(EC[e._type].color||0x66d8ff).setScale(2.2),dist=Phaser.Math.Distance.Between(e.x,e.y,tgt.x,tgt.y),tx=tgt.x,ty=tgt.y;p.setRotation(Math.atan2(ty-e.y,tx-e.x));this.tweens.add({targets:p,x:tx,y:ty,duration:Math.max(80,dist/sd(speed||700)*1000),onComplete:()=>{p.destroy();if(!tgt.active)return;if(tgt._owner)this.damageDrone(tgt,dmg,e,{kind:'ranged',projectile:true});else this.damageFriendly(tgt,dmg,e,{kind:'ranged',projectile:true})}})},
  fireEnemyShell(e,tgt){const cfg=EC[e._type],p=this.add.image(e.x,e.y,'msl').setDepth(8).setTint(cfg.color||0xcc7744).setScale(1.5),tx=tgt.x,ty=tgt.y,dist=Phaser.Math.Distance.Between(e.x,e.y,tx,ty);p.setRotation(Math.atan2(ty-e.y,tx-e.x)+Math.PI/2);this.tweens.add({targets:p,x:tx,y:ty,duration:Math.max(120,dist/sd(cfg.shotSpeed||400)*1000),onComplete:()=>{p.destroy();if(tgt.active&&Phaser.Math.Distance.Between(tx,ty,tgt.x,tgt.y)<sd(60))this.damageFriendly(tgt,e._dmg,e,{kind:'ranged',projectile:true});this.enemySplash(e,tgt,tx,ty,e._dmg*(cfg.splashRatio||0.5),sd(cfg.splash||100),false,{kind:'aoe',aoe:true})}})},
  moveEnemy(e,dx,dy,speed){const dist=Math.hypot(dx,dy);let bx=dist>0?dx/dist:0,by=dist>0?dy/dist:0,sx=0,sy=0,count=0;this.enemies.children.iterate(o=>{if(!o||!o.active||o===e)return;let ox=e.x-o.x,oy=e.y-o.y,d=Math.hypot(ox,oy);const desired=(e.body.radius||16)+(o.body.radius||16)+4;if(d>=desired)return;if(d<0.01){const a=((e._uid||1)*2.399+(o._uid||1)*0.73)%(Math.PI*2);ox=Math.cos(a);oy=Math.sin(a);d=1}const force=(desired-d)/desired;sx+=ox/d*force;sy+=oy/d*force;count++});if(count){sx/=count;sy/=count}let vx=bx+sx*0.7,vy=by+sy*0.7,vl=Math.hypot(vx,vy);if(vl<0.01){e.body.setVelocity(0,0);return}const moveSpeed=dist>0?speed:Math.min(55,speed||55);e.body.setVelocity(vx/vl*moveSpeed,vy/vl*moveSpeed)},
  nrEnemy(x,y,r){const t=this.findTargets(x,y,r);return t.length?t[0]:null},
  findTargets(x,y,r){const t=[];this.enemies.children.iterate(e=>{if(!e||!e.active)return;const d=Phaser.Math.Distance.Between(x,y,e.x,e.y);if(d<=r)t.push({e,d})});t.sort((a,b)=>a.d-b.d);return t.map(i=>i.e)},
  poisonTickDamage(){return 2+(this.meta.poisonDamage?1:0)},
  poisonDuration(){return this.meta.poisonLong?2500:2000},
  remainingPoisonDamage(e){
    if(!e?._poisons?.length)return 0;
    const fallback=this.poisonTickDamage();
    return e._poisons.reduce((sum,p)=>sum+Math.max(0,Math.ceil((p.left||0)/500))*(p.dmg||fallback),0)
  },
  poisonLayerCount(e){
    return e?._poisons?.filter(p=>p.left>0).length||0
  },
  consumePoison(e){
    if(e)e._poisons=[]
  },
  applyPoison(e,layers=1){
    if(!e||!e.active)return;
    e._poisons=e._poisons||[];
    for(let i=0;i<layers;i++)e._poisons.push({left:this.poisonDuration(),tick:500,dmg:this.poisonTickDamage()})
  }
};
