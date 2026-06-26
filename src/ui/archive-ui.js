function towerLevelText(t,u){
  const bits=[];
  if(u.d!==undefined)bits.push(`伤害 ${u.d}`);
  if(u.i)bits.push(`间隔 ${(u.i/1000).toFixed(1)}秒`);
  if(u.r)bits.push(`范围 ${u.r}`);
  if(u.hp)bits.push(`${t.type==='drone'?'无人机HP':'HP'} ${u.hp}`);
  if(u.danger!==undefined)bits.push(`危险等级 ${u.danger}`);
  if(u.targets)bits.push(`目标 ${u.targets}`);
  if(u.n)bits.push(`目标 ${u.n}`);
  if(u.md)bits.push(`上限 ${u.md}`);
  if(u.prod)bits.push(`生产 ${u.prod/1000}秒`);
  if(u.sl)bits.push(`减速 ${Math.round(u.sl*100)}%`);
  return bits.join(' · ');
}

function towerTypeName(t){
  return t.type==='path'?'路径塔':t.type==='block'?'阻挡塔':'无人机核心';
}

function towerIconSpec(id){
  const tower=ALL_TOWERS.find(t=>t.id===id);
  const kind=tower?.type==='block'?'block':tower?.type==='drone'?'drone':'path';
  return {kind,glyph:'core',...(TOWER_ICON_SPECS[id]||{})};
}

function enemyIconSpec(enemy){
  const key=enemy?.key||'enE1';
  return ENEMY_ICON_SPECS[key]||ENEMY_ICON_SPECS.enE1;
}

function iconClassSuffix(kind){
  return String(kind||'path').replace(/(^|-)([a-z])/g,(_,dash,ch)=>`${dash}${ch.toUpperCase()}`);
}

function archiveIconSvg(glyph){
  const def=ICON_GLYPH_DEFS[glyph]||ICON_GLYPH_DEFS.core;
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${def.map(iconCommandSvg).join('')}</svg>`;
}

function iconCommandSvg(cmd){
  const stroke='currentColor';
  const fill='currentColor';
  const cmdStroke=cmd.cssColor||stroke;
  const cmdFill=cmd.cssColor||fill;
  const common=`fill="none" stroke="${cmdStroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  if(cmd.type==='circle'){
    return cmd.fill
      ?`<circle cx="${cmd.cx}" cy="${cmd.cy}" r="${cmd.r}" fill="${cmdFill}" opacity="${cmd.opacity??.18}"/>`
      :`<circle cx="${cmd.cx}" cy="${cmd.cy}" r="${cmd.r}" ${common}/>`;
  }
  if(cmd.type==='line')return `<path d="M${cmd.x1} ${cmd.y1}L${cmd.x2} ${cmd.y2}" ${common}/>`;
  if(cmd.type==='polyline')return `<path d="${iconPointsToPath(cmd.points,false)}" ${common}/>`;
  if(cmd.type==='polygon')return `<path d="${iconPointsToPath(cmd.points,true)}" ${common}/>`;
  return '';
}

function iconPointsToPath(points,closed=false){
  if(!points?.length)return '';
  const [first,...rest]=points;
  return `M${first[0]} ${first[1]}${rest.map(p=>`L${p[0]} ${p[1]}`).join('')}${closed?'Z':''}`;
}

function archiveIcon(spec){
  const icon=spec||{kind:'path',glyph:'core'};
  const className=`archiveIcon archiveIcon${iconClassSuffix(icon.kind)}`;
  return `<span class="${className}">${archiveIconSvg(icon.glyph)}</span>`;
}

function towerArchiveIcon(t){
  return archiveIcon(towerIconSpec(t.id));
}

function enemyArchiveIcon(enemy){
  return archiveIcon(enemyIconSpec(enemy));
}

function towerIntro(t){
  return TOWER_INTROS[t.id]||t.desc||'暂无介绍';
}

function towerTotalCost(t){
  return (Number(t.cost)||0)+t.upg.slice(1).reduce((sum,u)=>sum+(Number(u.c)||0),0);
}

function towerLevelCostText(t,u,i){
  if(i===0)return `建造 ${t.cost}⚡`;
  return u.c?`升级 ${u.c}⚡`:'升级费用未配置';
}

let activeArchiveTowerId=ALL_TOWERS[0]?.id||'';
let activeArchiveEnemyId='E1';
let activeArchiveType='tower';

function towerArchiveListButton(t){
  const active=t.id===activeArchiveTowerId?' active':'';
  return [
    `<button type="button" class="archiveListBtn${active}" data-archive-tower="${t.id}">`,
    towerArchiveIcon(t),
    '<span>',
    `<strong>${t.id} · ${t.name}</strong>`,
    `<span>${towerTypeName(t)} · ${towerIntro(t)}</span>`,
    '</span>',
    '</button>'
  ].join('');
}

function towerArchiveDetailHtml(t){
  const levels=t.upg
    .map((u,i)=>[
      '<div class="archiveLevel">',
      '<div class="archiveLevelHead">',
      `<strong>Lv${i+1}</strong>`,
      `<span class="archiveCost">${towerLevelCostText(t,u,i)}</span>`,
      '</div>',
      `<div>${towerLevelText(t,u)||'特殊机制'}</div>`,
      '</div>'
    ].join(''))
    .join('');
  return [
    '<div class="archiveTitle">',
    towerArchiveIcon(t),
    '<div>',
    `<h3>${t.id} · ${t.name}</h3>`,
    `<div>${towerTypeName(t)}</div>`,
    '</div>',
    '</div>',
    `<div class="archiveIntro">${towerIntro(t)}</div>`,
    '<div class="archiveStatGrid">',
    `<div class="archiveStat"><b>定位</b><span>${towerTypeName(t)}</span></div>`,
    `<div class="archiveStat"><b>建造</b><span>${t.cost} 能量</span></div>`,
    `<div class="archiveStat"><b>满级投入</b><span>${towerTotalCost(t)} 能量</span></div>`,
    `<div class="archiveStat"><b>等级</b><span>${t.upg.length} 级</span></div>`,
    '</div>',
    '<div class="archiveLevels">',
    '<div class="archiveNodeTitle">规则摘要</div>',
    `<div class="archiveLevel">${t.desc}</div>`,
    '</div>',
    '<div class="archiveLevels">',
    '<div class="archiveNodeTitle">等级数据</div>',
    levels,
    '</div>'
  ].join('');
}

function enemyList(){
  return Object.entries(EC||{}).map(([id,e])=>({id,...e}));
}

function enemySpeedLabel(e){
  const speed=Number(e.spd)||0;
  if(speed>=360)return '极快';
  if(speed>=260)return '快';
  if(speed>=180)return '中速';
  return '慢';
}

function enemyAttackText(id,e){
  if(id==='E11')return '远程晶针，优先无人机';
  if(id==='E12')return '远程棘刺炮弹，落点范围伤害';
  if(id==='E13')return '接近目标后立即自爆';
  if(id==='E14')return '低伤近战并双线召唤';
  if(id==='E9')return '近战重击，周围附带伤害';
  if(id==='E10')return '近战攻击并周期召唤';
  if(id==='E5')return '低伤近战并持续孵化';
  return e.dmg?`近战 ${e.dmg} 伤害`:'特殊行动';
}

function enemyRoleText(id){
  if(id==='E7')return '高速突破单位';
  if(id==='E8')return '支援增幅单位';
  if(id==='E10')return '召唤压制单位';
  if(id==='E11')return '反无人机火力';
  if(id==='E12')return '远程范围火力';
  if(id==='E13')return '高速自爆单位';
  if(id==='E14')return '高压召唤母体';
  if(id==='E5')return '持续压力单位';
  if(id==='E3')return '分裂消耗单位';
  if(id==='E4'||id==='E6'||id==='E9')return '重型压制单位';
  return '基础突进单位';
}

function enemySpecialText(id,e){
  const lines=[];
  if(e.burst)lines.push('周期性进入加速态');
  if(e.split)lines.push('死亡后分裂为2只镰爪虫');
  if(e.leechPct)lines.push('攻击成功后回复自身最大生命值');
  if(e.hatch)lines.push('持续孵化镰爪虫');
  if(e.auraPulse)lines.push('周期性为周围敌人提供加速脉冲');
  if(e.meleeSplash)lines.push('近身攻击对周围其他目标造成附带伤害');
  if(e.summonEvery)lines.push('每2次攻击生成1只嗜血兽');
  if(e.droneRange)lines.push('射程内优先锁定无人机');
  if(e.rangeAtk)lines.push('远程炮弹抵达落点后结算范围伤害');
  if(e.selfDestruct)lines.push('接近目标后立即自爆；被击杀不会爆炸');
  if(e.summons)lines.push('周期性召唤嗜血兽与裂爆虫');
  return lines.join('；')||'无特殊机制';
}

function enemyArchiveListButton(enemy){
  const active=enemy.id===activeArchiveEnemyId?' active':'';
  return [
    `<button type="button" class="archiveListBtn${active}" data-archive-enemy="${enemy.id}">`,
    enemyArchiveIcon(enemy),
    '<span>',
    `<strong>${enemy.id} · ${enemy.name}</strong>`,
    `<span>移动${enemySpeedLabel(enemy)} · 危险等级 ${enemy.danger} · ${ENEMY_INTROS[enemy.id]||'暂无介绍'}</span>`,
    '</span>',
    '</button>'
  ].join('');
}

function enemyArchiveDetailHtml(enemy){
  return [
    '<div class="archiveTitle">',
    enemyArchiveIcon(enemy),
    '<div>',
    `<h3>${enemy.id} · ${enemy.name}</h3>`,
    `<div>${enemyRoleText(enemy.id)}</div>`,
    '</div>',
    '</div>',
    `<div class="archiveIntro">${ENEMY_INTROS[enemy.id]||'暂无介绍'}</div>`,
    '<div class="archiveStatGrid">',
    `<div class="archiveStat"><b>危险等级</b><span>${enemy.danger}</span></div>`,
    `<div class="archiveStat"><b>耐久</b><span>${enemy.hp} HP</span></div>`,
    `<div class="archiveStat"><b>移动</b><span>${enemySpeedLabel(enemy)}</span></div>`,
    `<div class="archiveStat"><b>攻击</b><span>${enemyAttackText(enemy.id,enemy)}</span></div>`,
    '</div>',
    '<div class="archiveLevels">',
    '<div class="archiveNodeTitle">特殊机制</div>',
    `<div class="archiveLevel">${enemySpecialText(enemy.id,enemy)}</div>`,
    '</div>',
    '<div class="settingsHint">速度评级：慢 / 中速 / 快 / 极快。</div>'
  ].join('');
}

function renderTowerArchive(){
  const list=document.getElementById('archiveList');
  const detail=document.getElementById('archiveDetail');
  if(!list||!detail)return;
  document.querySelectorAll('[data-archive-type]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.archiveType===activeArchiveType);
  });
  if(activeArchiveType==='enemy'){
    const enemies=enemyList();
    if(!enemies.some(e=>e.id===activeArchiveEnemyId))activeArchiveEnemyId=enemies[0]?.id||'';
    const active=enemies.find(e=>e.id===activeArchiveEnemyId)||enemies[0];
    list.innerHTML=enemies.map(enemyArchiveListButton).join('');
    detail.innerHTML=active?enemyArchiveDetailHtml(active):'<div class="settingsHint">暂无怪物数据</div>';
    list.querySelectorAll('[data-archive-enemy]').forEach(btn=>{
      btn.onclick=()=>selectArchiveEnemy(btn.dataset.archiveEnemy);
    });
    return;
  }
  if(!ALL_TOWERS.some(t=>t.id===activeArchiveTowerId))activeArchiveTowerId=ALL_TOWERS[0]?.id||'';
  const active=ALL_TOWERS.find(t=>t.id===activeArchiveTowerId)||ALL_TOWERS[0];
  list.innerHTML=ALL_TOWERS.map(towerArchiveListButton).join('');
  detail.innerHTML=active?towerArchiveDetailHtml(active):'<div class="settingsHint">暂无塔型数据</div>';
  list.querySelectorAll('[data-archive-tower]').forEach(btn=>{
    btn.onclick=()=>selectArchiveTower(btn.dataset.archiveTower);
  });
}

function archiveListScrollTop(){
  const list=document.getElementById('archiveList');
  return list?list.scrollTop:0;
}

function resetArchiveScroll(options={}){
  const detail=document.getElementById('archiveDetail');
  const list=document.getElementById('archiveList');
  if(detail)detail.scrollTop=0;
  if(list){
    if(options.list)list.scrollTop=0;
    else if(Number.isFinite(options.listTop))list.scrollTop=options.listTop;
  }
}

function selectArchiveTower(id){
  const listTop=archiveListScrollTop();
  activeArchiveTowerId=id;
  renderTowerArchive();
  resetArchiveScroll({listTop});
}

function selectArchiveEnemy(id){
  const listTop=archiveListScrollTop();
  activeArchiveEnemyId=id;
  renderTowerArchive();
  resetArchiveScroll({listTop});
}

function selectArchiveType(type){
  activeArchiveType=type==='enemy'?'enemy':'tower';
  renderTowerArchive();
  resetArchiveScroll({list:true});
  const selectPage=document.getElementById('selectPage');
  if(selectPage)selectPage.scrollTop=0;
}

function bindArchiveTabs(){
  if(bindArchiveTabs._bound)return;
  bindArchiveTabs._bound=true;
  document.querySelectorAll('[data-archive-type]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      selectArchiveType(btn.dataset.archiveType);
    });
  });
}
