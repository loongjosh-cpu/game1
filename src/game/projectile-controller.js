const ProjectileControllerMethods={
  updateProjectiles(dt){
    this.missiles.children.iterate(m=>{
      if(!m||!m.active||!m._t||!m._t.active){if(m&&m.active)m.destroy();return}
      this.physics.moveToObject(m,m._t,sd(MSL_SPD))
    });
    this.bolts.children.iterate(b=>{
      if(!b||!b.active||!b._t||!b._t.active){if(b&&b.active)b.destroy();return}
      this.physics.moveToObject(b,b._t,sd(500))
    });
    this.updateP3Shells(dt);
    this.updatePoisonBolts(dt)
  },
  buildCurvePath(x1,y1,x2,y2){const wp=astar(this.gridPF,x1,y1,x2,y2);const p=new Phaser.Curves.Path(wp[0][0],wp[0][1]);for(let i=1;i<wp.length;i++)p.lineTo(wp[i][0],wp[i][1]);return p},
  fireMsl(x,y,tgt){const m=this.physics.add.image(x,y,'msl').setDepth(8);this.missiles.add(m);m._t=tgt;m._dmg=this.meta.missileDamage;this.physics.add.overlap(m,this.enemies,(a,b)=>{if(!a.active||!b.active)return;const hitX=b.x,hitY=b.y,dmg=a._dmg;a.destroy();if(this.meta.missileBlast){const radius=sd(100);this.flashArea(hitX,hitY,radius,0xffdd66);this.findTargets(hitX,hitY,radius).forEach(e=>this.damageEnemy(e,dmg))}else this.damageEnemy(b,dmg)})},
  fireP3Shell(x,y,tgt,dmg,radius){const s=this.add.image(x,y,'msl').setDepth(8).setTint(0x88ddff).setScale(1.35);this.p3Shells.add(s);s._destX=tgt.x;s._destY=tgt.y;s._dmg=dmg;s._radius=radius;s._residual=this.meta.p3Residual;s.setRotation(Math.atan2(s._destY-y,s._destX-x)+Math.PI/2)},
  updateP3Shells(dt){this.p3Shells.children.iterate(s=>{if(!s||!s.active)return;const dx=s._destX-s.x,dy=s._destY-s.y,dist=Math.hypot(dx,dy),step=sd(P3_SHELL_SPD)*dt/1000;if(dist>step){s.x+=dx/dist*step;s.y+=dy/dist*step;return}const x=s._destX,y=s._destY,dmg=s._dmg,radius=s._radius,residual=s._residual;s.destroy();this.flashArea(x,y,radius,0x88ccff);this.findTargets(x,y,radius).forEach(e=>this.damageEnemy(e,dmg));if(residual)this.createResidual(x,y)})},
  firePoisonBolt(x,y,tgt,layers=1){const b=this.add.image(x,y,'bolt').setDepth(8).setTint(0xc96cff).setScale(2.4);this.poisonBolts.add(b);b._t=tgt;b._layers=layers},
  updatePoisonBolts(dt){this.poisonBolts.children.iterate(b=>{if(!b||!b.active)return;const tgt=b._t;if(!tgt||!tgt.active){b.destroy();return}const dx=tgt.x-b.x,dy=tgt.y-b.y,dist=Math.hypot(dx,dy),step=sd(POISON_BOLT_SPD)*dt/1000;b.setRotation(Math.atan2(dy,dx));if(dist>step){b.x+=dx/dist*step;b.y+=dy/dist*step;return}const x=tgt.x,y=tgt.y,layers=b._layers;b.destroy();this.applyPoison(tgt,layers);this.flashArea(x,y,22,0xaa44ff)})},
  fireBolt(x,y,tgt,dmg,effect=null){const b=this.physics.add.image(x,y,'bolt').setDepth(7);this.bolts.add(b);b._t=tgt;b._dmg=dmg;b._effect=effect;this.physics.add.overlap(b,this.enemies,(a,c)=>{if(!a.active||!c.active||c!==a._t)return;c._hp-=a._dmg;if(a._effect?.slow){c._slow=Math.max(c._slow||0,a._effect.slow);c._slowT=Math.max(c._slowT||0,a._effect.duration||2000)}a.destroy();if(c._hp<=0)this.killE(c)})},
  drawElectricLinks(g,links){g.clear();links.forEach(link=>{const dx=link.x2-link.x1,dy=link.y2-link.y1,len=Math.hypot(dx,dy),steps=Math.max(3,Math.ceil(len/38)),nx=len?-dy/len:0,ny=len?dx/len:0,pts=[{x:link.x1,y:link.y1}];for(let i=1;i<steps;i++){const t=i/steps,offset=Phaser.Math.Between(-9,9);pts.push({x:link.x1+dx*t+nx*offset,y:link.y1+dy*t+ny*offset})}pts.push({x:link.x2,y:link.y2});for(const style of [[7,0x2288ff,0.25],[2,0xd8f7ff,1]]){g.lineStyle(style[0],style[1],style[2]);g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.strokePath()}})},
  flashElectricChain(links){const g=this.add.graphics().setDepth(17);const flash=()=>{if(g.active){g.setVisible(true);this.drawElectricLinks(g,links)}};flash();this.time.delayedCall(45,()=>{if(g.active)g.setVisible(false)});this.time.delayedCall(80,flash);this.time.delayedCall(130,()=>{if(g.active)g.destroy()})},
  fireElectricChain(tw,tgts,up){const main=tgts[0],near=this.findTargets(main.x,main.y,sd(up.cr||100)).filter(e=>e!==main).slice(0,Math.max(0,(up.targets||1)-1)),targets=[main,...near],links=[{x1:tw.x,y1:tw.y,x2:main.x,y2:main.y},...near.map(e=>({x1:main.x,y1:main.y,x2:e.x,y2:e.y}))];this.flashElectricChain(links);targets.forEach(e=>{this.damageEnemy(e,up.d||0);if(this.meta.p2Stop&&e.active){e._slow=Math.max(e._slow||0,0.7);e._slowT=Math.max(e._slowT||0,500)}})}
};
