const EnemyWaveMethods={
  spawnAt(type,x,y,si=0,summoned=false,waveNo=null){const e=this.spawnE(si,type,waveNo??this.wave);e.setPosition(x,y);e._summoned=summoned;this.rejoinPath(e);return e},
  enemyKillReward(e){return (THREAT_COST[e._type]??EC[e._type]?.danger??0)*KILL_REWARD_MULT},
  killE(e){if(!e||!e.active)return;const cfg=EC[e._type],x=e.x,y=e.y,si=e._si,summoned=e._summoned,waveNo=e._waveNo;if(!summoned)this.gainEnergy(this.enemyKillReward(e));const ex=this.add.image(x,y,'msl').setDepth(9).setTint(cfg.color||0xff8844).setScale(3);this.tweens.add({targets:ex,alpha:0,scaleX:6,scaleY:6,duration:200,onComplete:()=>ex.destroy()});e.destroy();if(cfg.split){this.spawnAt('E1',x-18,y,si,true,waveNo);this.spawnAt('E1',x+18,y,si,true,waveNo)}},
  wavePool(){const pool=['E1'];if(this.wave>=2)pool.push('E2');if(this.wave>=3)pool.push('E3');if(this.wave>=4)pool.push('E4','E7');if(this.wave>=5)pool.push('E8');if(this.wave>=6)pool.push('E5','E6');if(this.wave>=7)pool.push('E11');if(this.wave>=8)pool.push('E9','E10');if(this.wave>=9)pool.push('E12');if(this.wave>=10)pool.push('E13');if(this.wave>=12)pool.push('E14');return pool},
  buildWaveRoster(){const budget=5+3*(this.wave-1),pool=this.wavePool(),roster=[],specialCount={},specialMax=budget*0.35,directMin=budget*0.35;let rem=budget,specialSpent=0,directSpent=0;const add=ty=>{roster.push(ty);rem-=THREAT_COST[ty]||1;if(SPECIAL_ENEMY.has(ty)){specialSpent+=THREAT_COST[ty]||1;specialCount[ty]=(specialCount[ty]||0)+1}if(DIRECT_ENEMY.has(ty))directSpent+=THREAT_COST[ty]||1};const can=ty=>{const c=THREAT_COST[ty]||1;if(c>rem)return false;if(SPECIAL_ENEMY.has(ty)&&(specialSpent+c>specialMax||(specialCount[ty]||0)>=2))return false;return true};while(directSpent<directMin&&rem>0){const d=pool.filter(ty=>DIRECT_ENEMY.has(ty)&&can(ty));if(!d.length)break;add(Phaser.Utils.Array.GetRandom(d))}while(rem>0){const opts=pool.filter(can);if(!opts.length){if(can('E1'))add('E1');else break}else add(Phaser.Utils.Array.GetRandom(opts))}return Phaser.Utils.Array.Shuffle(roster)},
  levelWave(){return this.levelConfig?.waves?.[this.wave-1]||null},
  waveSpawnDelay(i){return 500*(i+1)},
  routeLengthForSpawn(si){
    const points=this.enemyWaypoints?.[si]||[MAP.spawns?.[si],MAP.reactor].filter(Boolean).map(pathPoint);
    let len=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      len+=Phaser.Math.Distance.Between(a[0],a[1],b[0],b[1])
    }
    return len
  },
  endlessLaneUnlockCount(){
    const laneCount=MAP.spawns.length;
    if(this.wave<=3)return Math.min(laneCount,1);
    if(this.wave<=6)return Math.min(laneCount,2);
    if(this.wave<=10)return Math.min(laneCount,Math.ceil(laneCount*0.5));
    if(this.wave<=15)return Math.min(laneCount,Math.ceil(laneCount*0.75));
    return laneCount
  },
  activeSpawnLane(i,lw=null,spawnOffset=this._spawnOffset||0){
    const laneCount=MAP.spawns.length;
    const lanes=lw?.lanes;
    const laneRaw=lanes?lanes[i%lanes.length]:spawnOffset+i;
    const normalized=((laneRaw%laneCount)+laneCount)%laneCount;
    if(lanes||this.levelConfig)return normalized;
    const unlocked=this.endlessLaneUnlockCount();
    return (spawnOffset+((normalized-spawnOffset)%unlocked+unlocked)%unlocked)%laneCount
  },
  naturalWaveDuration(roster,lw,spawnOffset){
    let latest=0;
    roster.forEach((ty,i)=>{
      const si=this.activeSpawnLane(i,lw,spawnOffset);
      const speed=Math.max(1,sd(EC[ty]?.spd||200));
      latest=Math.max(latest,this.waveSpawnDelay(i)+this.routeLengthForSpawn(si)/speed*1000)
    });
    return Math.max(PREP_TIME,latest)
  },
  finishWaveSpawning(){
    if(this._waveSpawnDone)return;
    this._waveSpawnDone=true;
    this.wActive=false;
    if(!Array.isArray(this._pendingWaveClears))this._pendingWaveClears=[];
    this._pendingWaveClears.push(this.wave);
    if(this.levelConfig&&this.wave>=this.levelConfig.waves.length){
      this._allLevelWavesSpawned=true;
      this.prepTimer=0;
      return
    }
    this.wave++;
    this.prepTimer=Math.max(0,(this._waveNaturalDuration||PREP_TIME)-this._waveSpawnElapsed)
  },
  startWave(){if(this.ended||this._allLevelWavesSpawned)return;this.wActive=true;this._waveSpawnDone=false;const waveNo=this.wave,lw=this.levelWave();this._waveRoster=lw?lw.roster.slice():this.buildWaveRoster();this.wC=this._waveRoster.length;this.wS=0;this._spawnOffset=Phaser.Math.Between(0,MAP.spawns.length-1);this._waveNaturalDuration=this.naturalWaveDuration(this._waveRoster,lw,this._spawnOffset);this._waveSpawnElapsed=this.waveSpawnDelay(Math.max(0,this.wC-1));this._wt=this.time.addEvent({delay:500,loop:true,callback:()=>{if(this.wS>=this.wC){this._wt.remove();this.finishWaveSpawning();return}const si=this.activeSpawnLane(this.wS,lw,this._spawnOffset),ty=this._waveRoster[this.wS]||'E1';this.spawnE(si,ty,waveNo);this.wS++;if(this.wS>=this.wC){this._wt.remove();this.finishWaveSpawning()}}})},
  spawnE(si,type,waveNo=null){const cfg=EC[type],[sx,sy]=MAP.spawns[si],e=this.physics.add.image(sx,sy,cfg.key).setDepth(6).setTint(cfg.color||0xffffff);this.enemies.add(e);e.body.enable=true;e._uid=++this.enemySeq;const scaleWave=waveNo??this.wave,sc=this.levelConfig?.waves?.[scaleWave-1]?.scale??(1+(scaleWave-1)*0.1);e._waveNo=scaleWave;e._hp=Math.round(cfg.hp*sc);e._maxhp=e._hp;e._dmg=cfg.dmg;e._spd=cfg.spd;e._atk=cfg.atk;e._at=0;e._firstAttack=true;e._si=si;e._b1tgt=null;e._reactorTarget=null;e._droneTarget=null;e._type=type;e._bt=0;e._slow=0;e._slowT=0;e._state='path';e._hatch=cfg.hatch||0;e._summonTimers=(cfg.summons||[]).map(s=>({type:s.type,interval:s.interval,left:s.interval}));e._hits=0;this.routeToReactor(e,false);e.body.setCircle(Math.min(16,e.width/2));e.body.setBounce(0);return e},
  gameOver(title='防线失守'){if(this.ended)return;this.ended=true;const completed=this.completedWaves??Math.max(0,this.wave-1),levelCleared=!!this.levelConfig&&completed>=this.levelConfig.waves.length,reward=this.levelConfig?(levelCleared?1:0):Math.floor(completed/5);metaSave.cores+=reward;metaSave.bestWave=Math.max(metaSave.bestWave,completed);if(levelCleared&&this.levelConfig?.id){metaSave.levelClears=metaSave.levelClears||{};metaSave.levelClears[this.levelConfig.id]=true}saveMeta();document.querySelector('#gameOverPanel h2').textContent=title;document.getElementById('resultWaves').textContent=completed;document.getElementById('resultReward').textContent=reward;document.getElementById('resultCores').textContent=metaSave.cores;document.getElementById('pausePanel').style.display='none';document.getElementById('gameOverPanel').style.display='flex';this.scene.pause()},
  grantWaveClearBonus(){
    const bonus=this.meta.reactorWaveBonus||0,limit=this.meta.reactorWaveBonusLimit||0;
    if(bonus>0&&this.completedWaves<=limit)this.gainEnergy(bonus)
  },
  waveHasActiveEnemies(waveNo){
    let active=false;
    this.enemies.children.iterate(e=>{if(e&&e.active&&e._waveNo===waveNo)active=true});
    return active
  },
  updateWaves(dt){
    if(Array.isArray(this._pendingWaveClears)&&this._pendingWaveClears.length){
      while(this._pendingWaveClears.length&&!this.waveHasActiveEnemies(this._pendingWaveClears[0])){
        this._pendingWaveClears.shift();
        this.completedWaves++;
        this.grantWaveClearBonus()
      }
      if(this.levelConfig&&this.completedWaves>=this.levelConfig.waves.length){this.gameOver('关卡完成');return}
    }
    if(!this.wActive&&!this._allLevelWavesSpawned){
      this.prepTimer=Math.max(0,this.prepTimer-dt);
      if(this.prepTimer<=0)this.startWave();
      return
    }
  }
};
