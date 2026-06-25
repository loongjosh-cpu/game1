const TOWER_ICON_SPECS={
  P1:{glyph:'cannon'},P2:{glyph:'bolt'},P3:{glyph:'bolt'},P4:{glyph:'snow'},P5:{glyph:'sniper'},P6:{glyph:'poison'},P7:{glyph:'poison'},
  B1:{glyph:'core'},B2:{glyph:'flame'},B3:{glyph:'core'},B4:{glyph:'bolt'},B5:{glyph:'core'},B6:{glyph:'poison'},B7:{glyph:'pulse'},
  D1:{glyph:'drone'},D2:{glyph:'drone'},D3:{glyph:'drone'}
};

const ENEMY_ICON_SPECS={
  enE1:{kind:'enemyLarge',glyph:'enemyLarge'},
  enE2:{kind:'enemySmall',glyph:'enemySmall'}
};

const ICON_GLYPH_DEFS={
  core:[{type:'circle',cx:20,cy:20,r:8.4}],
  cannon:[{type:'circle',cx:20,cy:20,r:7.6},{type:'line',x1:20,y1:20,x2:34.4,y2:20}],
  bolt:[{type:'polyline',points:[[12,17],[19,17],[16,28.4],[28.4,19],[21,19]],useTowerColor:true}],
  snow:[
    {type:'line',x1:20,y1:20,x2:32.4,y2:20},{type:'line',x1:20,y1:20,x2:26.2,y2:30.7},{type:'line',x1:20,y1:20,x2:13.8,y2:30.7},
    {type:'line',x1:20,y1:20,x2:7.6,y2:20},{type:'line',x1:20,y1:20,x2:13.8,y2:9.3},{type:'line',x1:20,y1:20,x2:26.2,y2:9.3},
    {type:'circle',cx:20,cy:20,r:3.6}
  ],
  sniper:[{type:'polygon',points:[[20,8.4],[10,26.8],[30,26.8]]},{type:'line',x1:20,y1:16,x2:20,y2:27.6}],
  poison:[{type:'circle',cx:20,cy:20,r:9,color:0xc96cff,cssColor:'#c96cff'},{type:'line',x1:10.4,y1:26.4,x2:29.6,y2:13.6,color:0x83ff9b,cssColor:'#83ff9b'}],
  flame:[{type:'polygon',points:[[20,9],[11.2,29],[28.8,29]],color:0xffc066,cssColor:'#ffc066'},{type:'circle',cx:20,cy:21.6,r:5,color:0xffc066,cssColor:'#ffc066'}],
  pulse:[{type:'circle',cx:20,cy:20,r:9,color:0xff6677,cssColor:'#ff6677'},{type:'line',x1:10,y1:20,x2:30,y2:20,color:0xff6677,cssColor:'#ff6677'},{type:'line',x1:20,y1:10,x2:20,y2:30,color:0xff6677,cssColor:'#ff6677'}],
  drone:[{type:'polygon',points:[[20,9.6],[30.4,20],[20,30.4],[9.6,20]],useTowerColor:true},{type:'circle',cx:20,cy:20,r:3.6,useTowerColor:true}],
  enemySmall:[
    {type:'polygon',points:[[20,2.5],[37.5,20],[20,37.5],[2.5,20]],color:0xd066ff,cssColor:'#d066ff'},
    {type:'circle',cx:20,cy:20,r:7.5,color:0xffd1dc,cssColor:'#ffd1dc'},
    {type:'line',x1:20,y1:5,x2:20,y2:35,color:0xd066ff,cssColor:'#d066ff'}
  ],
  enemyLarge:[
    {type:'polygon',points:[[20,3],[5,31],[35,31]],color:0xff4f6d,cssColor:'#ff4f6d'},
    {type:'circle',cx:20,cy:20,r:8,color:0xffd1dc,cssColor:'#ffd1dc'},
    {type:'line',x1:7,y1:21,x2:1,y2:15,color:0xff4f6d,cssColor:'#ff4f6d'},
    {type:'line',x1:33,y1:21,x2:39,y2:15,color:0xff4f6d,cssColor:'#ff4f6d'}
  ]
};

const TOWER_INTROS={
  P1:'可靠的基础单体火力，费用低，适合补线和处理漏怪。',
  P2:'连锁电磁塔，擅长在密集敌群中制造稳定多目标伤害。',
  P3:'弹道型范围电磁炮，炮弹抵达落点后覆盖一片区域。',
  P4:'低温控制塔，优先压制已减速目标，用低伤害换高频控制。',
  P5:'远距离狙击塔，适合打击高价值目标，专注层数让长战线收益更高。',
  P6:'挂毒型功能塔，优先寻找未中毒目标，为毒系收割建立前置。',
  P7:'毒伤收割塔，对中毒敌人收益更高，后期可同时处理双目标。',
  B1:'主力阻挡肉盾，承担战线锚点和危险等级拦截职责。',
  B2:'近距离灼烧阻挡塔，持续伤害范围内全部敌人。',
  B3:'阻挡输出塔，血量与火力兼备，适合守窄口。',
  B4:'电磁阻挡塔，主动脉冲并在受击时反击，适合高压接敌点。',
  B5:'治疗支援塔，维修友方阻挡单位，是阵地续航核心。',
  B6:'范围挂毒阻挡塔，给进入射程的敌群施加毒层。',
  B7:'低费自爆阻挡塔，用一次性爆发换取紧急清场。',
  D1:'轻型无人机核心，用数量拦截和追击中低血量目标。',
  D2:'重装无人机核心，少量高伤无人机适合处理重点目标。',
  D3:'维修无人机核心，不直接战斗，通过消耗自身生命维修阻挡塔。'
};

const ENEMY_INTROS={
  E1:'基础炮灰，数量压力来源，单体威胁低但会消耗前线火力。',
  E2:'突进型轻怪，会周期性加速，容易穿过火力空档。',
  E3:'分裂单位，死亡后制造额外小怪，考验持续清杂能力。',
  E4:'续航型近战怪，攻击成功后按最大生命值回血。',
  E5:'慢速母体，会持续孵化小怪，必须尽快压制。',
  E6:'重甲肉盾，生命值极高，用来拖住塔组火力。',
  E7:'高速突破怪，速度极快，专门惩罚战线漏口。',
  E8:'支援怪，周期性给周围敌人加速，放大整波压力。',
  E9:'重型攻坚怪，近身攻击会对周围其他目标造成附带伤害。',
  E10:'召唤型攻坚怪，每攻击数次生成嗜血兽，拖久后压力滚雪球。',
  E11:'远程支援小怪，优先清理射程内无人机，削弱无人机防线。',
  E12:'远程炮击怪，炮弹落点造成建筑范围伤害，威胁密集阵地。',
  E13:'高速自爆怪，贴近目标后立即爆炸，惩罚密集拦截和无人机防线。',
  E14:'高压召唤母体，持续生成嗜血兽与裂爆虫，必须尽快压制。'
};
