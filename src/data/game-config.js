const LEVEL_UI_ORDER=Array.from({length:19},(_,i)=>`level${i+1}`);

const W=7356,H=4144,CELL=80,NAV_CLEARANCE=20;

const DRONE_CHASE_LIMIT=1200,DRONE_STUCK_LIMIT=650,DRONE_CHASE_SPEED=320;

const SHIP_SPD=500,SHIP_RNG=1200,MSL_CD=8000,MSL_DMG=20,MSL_SPD=800;

const MAP_DISPLAY_SCALE=0.9,LOCAL_CAMERA_ZOOM_FACTOR=3.2,MINIMAP_REFRESH=120;

const P3_SHELL_SPD=700,POISON_BOLT_SPD=520,RX_HP=120;

const EN_START=200,EN_CAP=9999,PREP_TIME=10000,CLEAR_FIELD_PREP_TIME=10000,SHIP_RESPAWN=5000;
const KILL_REWARD_MULT=3,REACTOR_WAVE_BONUS_LIMIT=5;

const CLOSE_ATTACK_RANGE=60,PATH_SNAP_DISTANCE=120;

const BUILD_TIME={drone:1200,path:1800,reactor:2000,block:2500};
const UPGRADE_TIME={1:1800,2:2500};

const MAIN_REACTOR={
  id:'R0',
  name:'主反应炉',
  type:'reactor',
  cost:0,
  tSize:120,
  desc:'主目标 · 摧毁后游戏失败',
  upg:[
    {l:1,hp:120,prod:4},
    {l:2,hp:120,prod:5.5,c:100},
    {l:3,hp:120,prod:7,c:100}
  ]
};

const SMALL_REACTOR={
  id:'R1',
  name:'小反应炉',
  type:'reactor',
  cost:200,
  tSize:72,
  maxCount:5,
  desc:'经济建筑 · 全图兜底目标',
  upg:[
    {l:1,hp:80,prod:2},
    {l:2,hp:80,prod:3,c:80},
    {l:3,hp:80,prod:4,c:80}
  ]
};

const REACTOR_MIN_DISTANCE=1000;
