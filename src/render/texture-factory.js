const TextureFactoryMethods={
  createShipTexture(){
    const g=this.make.graphics({add:false});
    g.fillStyle(BLUEPRINT_ART.panelDeep,0.9);
    g.fillCircle(30,30,28);
    g.lineStyle(3,BLUEPRINT_ART.cyan,0.96);
    g.strokeCircle(30,30,27);
    g.lineStyle(1,BLUEPRINT_ART.white,0.42);
    g.strokeCircle(30,30,16);
    g.fillStyle(BLUEPRINT_ART.cyan,0.35);
    g.fillTriangle(30,7,14,46,30,38);
    g.fillTriangle(30,7,46,46,30,38);
    g.lineStyle(2,BLUEPRINT_ART.white,0.9);
    strokeTrianglePath(g,30,7,14,46,46,46);
    g.lineStyle(2,BLUEPRINT_ART.cyan,0.85);
    g.lineBetween(30,12,30,40);
    g.generateTexture('ship',60,60);
    g.destroy();
  },
  createRangeTexture(){
    const g=this.make.graphics({add:false});
    g.lineStyle(3,BLUEPRINT_ART.cyan,0.25);
    g.strokeCircle(SHIP_RNG,SHIP_RNG,SHIP_RNG);
    g.lineStyle(1,BLUEPRINT_ART.white,0.08);
    g.strokeCircle(SHIP_RNG,SHIP_RNG,SHIP_RNG*0.72);
    g.generateTexture('rng',SHIP_RNG*2,SHIP_RNG*2);
    g.destroy();
  },
  createReactorTextures(){
    const main=this.make.graphics({add:false});
    main.fillStyle(BLUEPRINT_ART.panelDeep,0.95);
    main.fillCircle(60,60,58);
    main.lineStyle(6,BLUEPRINT_ART.cyan,0.22);
    main.strokeCircle(60,60,54);
    main.lineStyle(3,BLUEPRINT_ART.cyan,0.96);
    main.strokeCircle(60,60,49);
    main.lineStyle(2,BLUEPRINT_ART.white,0.6);
    main.strokeCircle(60,60,27);
    main.fillStyle(BLUEPRINT_ART.cyan,0.35);
    main.fillCircle(60,60,16);
    main.lineStyle(2,BLUEPRINT_ART.cyan,0.85);
    for(let i=0;i<6;i++){
      const a=Math.PI*2*i/6;
      main.lineBetween(60+Math.cos(a)*33,60+Math.sin(a)*33,60+Math.cos(a)*47,60+Math.sin(a)*47);
    }
    main.generateTexture('reactor',120,120);
    main.destroy();

    const small=this.make.graphics({add:false});
    small.fillStyle(BLUEPRINT_ART.panelDeep,0.94);
    small.fillCircle(36,36,34);
    small.lineStyle(3,BLUEPRINT_ART.cyan,0.95);
    small.strokeCircle(36,36,31);
    small.lineStyle(1,BLUEPRINT_ART.white,0.42);
    small.strokeCircle(36,36,20);
    small.fillStyle(BLUEPRINT_ART.cyan,0.42);
    small.fillCircle(36,36,11);
    small.generateTexture('smallReactor',72,72);
    small.destroy();

    const ghost=this.make.graphics({add:false});
    ghost.lineStyle(3,BLUEPRINT_ART.cyan,0.72);
    ghost.strokeCircle(36,36,34);
    ghost.lineStyle(1,BLUEPRINT_ART.white,0.45);
    ghost.strokeCircle(36,36,19);
    ghost.generateTexture('ghR1',72,72);
    ghost.destroy();
  },
  createSpawnTexture(){
    const g=this.make.graphics({add:false});
    g.fillStyle(0x290914,0.92);
    g.fillCircle(26,26,25);
    g.lineStyle(3,BLUEPRINT_ART.enemy,0.95);
    g.strokeCircle(26,26,22);
    g.lineStyle(2,BLUEPRINT_ART.enemyCore,0.72);
    strokeTrianglePath(g,26,8,10,38,42,38);
    g.lineStyle(1,BLUEPRINT_ART.enemy,0.7);
    g.lineBetween(26,6,26,46);
    g.lineBetween(6,26,46,26);
    g.generateTexture('spawn',52,52);
    g.destroy();
  },
  createEnemyTextures(){
    const large=this.make.graphics({add:false});
    large.fillStyle(0x2a0812,0.92);
    large.fillCircle(20,20,18);
    drawSharedIconGlyph(large,'enemyLarge',20,20,20,BLUEPRINT_ART.enemy);
    large.generateTexture('enE1',40,40);
    large.destroy();

    const small=this.make.graphics({add:false});
    small.fillStyle(0x21082e,0.92);
    small.fillCircle(16,16,14);
    drawSharedIconGlyph(small,'enemySmall',16,16,16,0xd066ff);
    small.generateTexture('enE2',32,32);
    small.destroy();
  },
  createProjectileTextures(){
    const missile=this.make.graphics({add:false});
    missile.fillStyle(0xffdd66,0.95);
    missile.fillTriangle(6,0,1,12,11,12);
    missile.lineStyle(1,0xffffff,0.75);
    strokeTrianglePath(missile,6,0,1,12,11,12);
    missile.generateTexture('msl',12,12);
    missile.destroy();

    const bolt=this.make.graphics({add:false});
    bolt.lineStyle(2,0x8effc1,0.95);
    bolt.lineBetween(1,5,6,1);
    bolt.lineStyle(1,0xffffff,0.8);
    bolt.lineBetween(3,7,8,3);
    bolt.generateTexture('bolt',9,9);
    bolt.destroy();
  }
};
