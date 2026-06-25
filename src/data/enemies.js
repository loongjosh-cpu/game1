const EC={
  E1:{name:'镰爪虫',hp:30,spd:240,dmg:3,atk:1000,key:'enE1',danger:1,color:0xe94560},
  E2:{
    name:'跃迁虫',hp:15,spd:280,dmg:8,atk:800,key:'enE2',
    danger:1,color:0xcc44ff,burst:true,burstSpeed:400,burstCycle:4000,burstDuration:1000
  },
  E3:{name:'分裂兽',hp:80,spd:240,dmg:6,atk:1000,key:'enE1',danger:2,color:0xff8844,split:true},
  E4:{name:'嗜血兽',hp:150,spd:260,dmg:12,atk:1500,key:'enE1',danger:2,color:0xb51f4f,leechPct:0.04},
  E5:{name:'母巢',hp:400,spd:80,dmg:2,atk:1200,key:'enE2',danger:3,color:0x8d5a99,hatch:3000},
  E6:{name:'重甲兽',hp:600,spd:120,dmg:2,atk:1200,key:'enE1',danger:3,color:0x777f8f},
  E7:{name:'疾行兽',hp:50,spd:380,dmg:12,atk:1500,key:'enE2',danger:2,color:0xffd166},
  E8:{
    name:'增幅兽',hp:20,spd:150,dmg:5,atk:1000,key:'enE2',
    danger:1,color:0x44ddaa,auraPulse:500,auraEvery:2000,auraDur:3000
  },
  E9:{
    name:'裂地兽',hp:300,spd:200,dmg:20,atk:1800,key:'enE1',
    danger:3,color:0x9b5d35,meleeSplash:0.5,meleeSplashRange:50
  },
  E10:{name:'唤卫兽',hp:180,spd:240,dmg:15,atk:800,key:'enE2',danger:2,color:0x4f7cff,summonEvery:2},
  E11:{
    name:'猎翼虫',hp:80,spd:220,dmg:4,atk:900,key:'enE2',
    danger:1,color:0x66d8ff,droneRange:500,shotSpeed:700
  },
  E12:{
    name:'棘炮兽',hp:220,spd:120,dmg:18,atk:1800,key:'enE1',
    danger:2,color:0xcc7744,rangeAtk:650,shotSpeed:400,splash:100,splashRatio:0.5
  }
};

const THREAT_COST={
  E1:1,E2:1,E3:3,E4:3,E5:7,E6:6,
  E7:2,E8:3,E9:5,E10:7,E11:2,E12:5
};

const SPECIAL_ENEMY=new Set(['E5','E8','E10']);
const DIRECT_ENEMY=new Set(['E1','E2','E7']);
