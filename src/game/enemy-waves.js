const EnemyWaveMethods={
  spawnAt(type,x,y,si=0,summoned=false){const e=this.spawnE(si,type);e.setPosition(x,y);e._summoned=summoned;this.rejoinPath(e);return e},
  enemyKillReward(e){return (THREAT_COST[e._type]??EC[e._type]?.danger??0)*KILL_REWARD_MULT},
  killE(e){if(!e||!e.active)return;const cfg=EC[e._type],x=e.x,y=e.y,si=e._si,summoned=e._summoned;if(!summoned)this.gainEnergy(this.enemyKillReward(e));const ex=this.add.image(x,y,'msl').setDepth(9).setTint(cfg.color||0xff8844).setScale(3);this.tweens.add({targets:ex,alpha:0,scaleX:6,scaleY:6,duration:200,onComplete:()=>ex.destroy()});e.destroy();if(cfg.split){this.spawnAt('E1',x-18,y,si,true);this.spawnAt('E1',x+18,y,si,true)}},
  wavePool(){const pool=['E1'];if(this.wave>=2)pool.push('E2');if(this.wave>=3)pool.push('E3');if(this.wave>=4)pool.push('E4','E7');if(this.wave>=5)pool.push('E8');if(this.wave>=6)pool.push('E5','E6');if(this.wave>=7)pool.push('E11');if(this.wave>=8)pool.push('E9','E10');if(this.wave>=9)pool.push('E12');if(this.wave>=10)pool.push('E13');if(this.wave>=12)pool.push('E14');return pool},
  buildWaveRoster(){const budget=5+3*(this.wave-1),pool=this.wavePool(),roster=[],specialCount={},specialMax=budget*0.35,directMin=budget*0.35;let rem=budget,specialSpent=0,directSpent=0;const add=ty=>{roster.push(ty);rem-=THREAT_COST[ty]||1;if(SPECIAL_ENEMY.has(ty)){specialSpent+=THREAT_COST[ty]||1;specialCount[ty]=(specialCount[ty]||0)+1}if(DIRECT_ENEMY.has(ty))directSpent+=THREAT_COST[ty]||1};const can=ty=>{const c=THREAT_COST[ty]||1;if(c>rem)return false;if(SPECIAL_ENEMY.has(ty)&&(specialSpent+c>specialMax||(specialCount[ty]||0)>=2))return false;return true};while(directSpent<directMin&&rem>0){const d=pool.filter(ty=>DIRECT_ENEMY.has(ty)&&can(ty));if(!d.length)break;add(Phaser.Utils.Array.GetRandom(d))}while(rem>0){const opts=pool.filter(can);if(!opts.length){if(can('E1'))add('E1');else break}else add(Phaser.Utils.Array.GetRandom(opts))}return Phaser.Utils.Array.Shuffle(roster)},
  levelWave(){return this.levelConfig?.waves?.[this.wave-1]||null},
  startWave(){this.wActive=true;const lw=this.levelWave();this._waveRoster=lw?lw.roster.slice():this.buildWaveRoster();this.wC=this._waveRoster.length;this.wS=0;this._spawnOffset=Phaser.Math.Between(0,MAP.spawns.length-1);this._wt=this.time.addEvent({delay:500,loop:true,callback:()=>{if(this.wS>=this.wC){this._wt.remove();return}const lanes=lw?.lanes,laneRaw=lanes?lanes[this.wS%lanes.length]:(this._spawnOffset+this.wS),si=((laneRaw%MAP.spawns.length)+MAP.spawns.length)%MAP.spawns.length,ty=this._waveRoster[this.wS]||'E1';this.spawnE(si,ty);this.wS++}})},
  spawnE(si,type){const cfg=EC[type],[sx,sy]=MAP.spawns[si],e=this.physics.add.image(sx,sy,cfg.key).setDepth(6).setTint(cfg.color||0xffffff);this.enemies.add(e);e.body.enable=true;e._uid=++this.enemySeq;const sc=this.levelWave()?.scale??(1+(this.wave-1)*0.1);e._hp=Math.round(cfg.hp*sc);e._maxhp=e._hp;e._dmg=cfg.dmg;e._spd=cfg.spd;e._atk=cfg.atk;e._at=0;e._firstAttack=true;e._si=si;e._b1tgt=null;e._reactorTarget=null;e._droneTarget=null;e._type=type;e._bt=0;e._slow=0;e._slowT=0;e._state='path';e._hatch=cfg.hatch||0;e._summonTimers=(cfg.summons||[]).map(s=>({type:s.type,interval:s.interval,left:s.interval}));e._hits=0;this.routeToReactor(e,false);e.body.setCircle(Math.min(16,e.width/2));e.body.setBounce(0);return e},
  gameOver(title='防线失守'){if(this.ended)return;this.ended=true;const completed=this.completedWaves??Math.max(0,this.wave-1),levelCleared=!!this.levelConfig&&completed>=this.levelConfig.waves.length,reward=this.levelConfig?(levelCleared?1:0):Math.floor(completed/5);metaSave.cores+=reward;metaSave.bestWave=Math.max(metaSave.bestWave,completed);if(levelCleared&&this.levelConfig?.id){metaSave.levelClears=metaSave.levelClears||{};metaSave.levelClears[this.levelConfig.id]=true}saveMeta();document.querySelector('#gameOverPanel h2').textContent=title;document.getElementById('resultWaves').textContent=completed;document.getElementById('resultReward').textContent=reward;document.getElementById('resultCores').textContent=metaSave.cores;document.getElementById('pausePanel').style.display='none';document.getElementById('gameOverPanel').style.display='flex';this.scene.pause()},
  grantWaveClearBonus(){
    const bonus=this.meta.reactorWaveBonus||0,limit=this.meta.reactorWaveBonusLimit||0;
    if(bonus>0&&this.completedWaves<=limit)this.gainEnergy(bonus)
  },
  updateWaves(dt){
    if(!this.wActive){
      this.prepTimer=Math.max(0,this.prepTimer-dt);
      if(this.prepTimer<=0)this.startWave();
      return
    }
    if(this.wS<this.wC||this.enemies.countActive()!==0)return;
    this.wActive=false;
    this.completedWaves++;
    this.grantWaveClearBonus();
    if(this.levelConfig&&this.completedWaves>=this.levelConfig.waves.length){this.gameOver('关卡完成');return}
    this.wave++;
    this.prepTimer=PREP_TIME
  }
};
