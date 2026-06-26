const EnemyStructureMethods={
  destroyReactor(r){if(!r||!r.active||r._isMainReactor)return;if(this.selTw===r){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}if(r._label)r._label.destroy();r.destroy();this.enemies.children.iterate(e=>{if(e&&e.active&&e._reactorTarget===r)this.rejoinPath(e)});this.updPanel()},
  destroyB1(b1){
    if(b1._type?.type==='drone'){
      this.destroyDroneCore(b1);
      return
    }
    const isSteel=b1._type.id==='B1';
    if(b1._type.id==='B7')this.explodeB7(b1);
    if(b1._type.id==='B4'&&this.meta.b4Resonance)this.createB4Resonance(b1);
    if(isSteel&&!b1._wreck){b1._hp=200;b1._maxhp=200;b1._repair=0;b1._wreck=true;b1.setAlpha(0.4);b1.setTint(0x666666);this.time.delayedCall(20000,()=>{if(b1.active&&b1._wreck)this.reviveSteel(b1)})}else{if(this.selTw===b1){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}if(b1._rngGfx)b1._rngGfx.destroy();b1.destroy()}this.enemies.children.iterate(e=>{if(e&&e.active&&e._b1tgt===b1)this.rejoinPath(e)})},
  explodeB7(tw){
    const dmg=(tw._type.boom||50)*(this.meta.b7Damage?1.5:1),range=sd(tw._type.range);
    this.flashArea(tw.x,tw.y,range,0xff4444);
    this.findTargets(tw.x,tw.y,range).forEach(e=>this.damageEnemy(e,dmg))
  },
  createB4Resonance(tw){
    const x=tw.x,y=tw.y,range=sd(tw._type.upg[tw._lv||0].r||tw._type.range);
    let pulses=0;
    this.time.addEvent({delay:1000,repeat:7,callback:()=>{
      pulses++;
      this.flashArea(x,y,range,0x66ccff);
      this.findTargets(x,y,range).forEach(e=>this.damageEnemy(e,8))
    }})
  },
  destroyDroneCore(core){
    if(!core||!core.active)return;
    this.droneHelpers.children.iterate(d=>{if(d&&d.active&&d._owner===core)this.destroyDrone(d,{skipRevive:true,skipDeathEffect:true})});
    if(this.selTw===core){this.selTw=null;this.selectionGfx.clear();this.updTwPanel()}
    if(core._rngGfx)core._rngGfx.destroy();
    core.destroy();
    this.enemies.children.iterate(e=>{if(e&&e.active&&e._b1tgt===core)this.rejoinPath(e)});
    this.updPanel()
  },
  reviveSteel(b1){if(!b1?.active)return;b1.clearTint();b1.setAlpha(1);b1._wreck=false;const up=b1._type.upg[b1._lv||0];b1._maxhp=up.hp;b1._hp=up.hp},
  healBlocker(tw,amount){if(!tw?.active||amount<=0)return 0;if(tw._wreck){if(!this.meta.b1Repair)return 0;const before=tw._repair||0;tw._repair=Math.min(200,before+amount);const applied=tw._repair-before;if(tw._repair>=200)this.reviveSteel(tw);return applied}const before=tw._hp;tw._hp=Math.min(tw._maxhp,tw._hp+amount);return tw._hp-before},
  killShip(){if(this.shipDead)return;this.cancelChannel();this.shipDead=true;this.shipMoveTarget=null;this.ship.setActive(false).setVisible(false);this.ship.body.enable=false;this.bld=false;this.ghost.setVisible(false);this.time.delayedCall(SHIP_RESPAWN,()=>{this.ship.setPosition(MAP.reactor.x,MAP.reactor.y);this.ship.body.enable=true;this.ship.setActive(true).setVisible(true);this.shipDead=false})}
};
