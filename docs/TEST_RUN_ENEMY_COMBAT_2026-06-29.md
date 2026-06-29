# 2026-06-29：追加批次：怪物攻击完整性

## 背景

前 10 批自动化测试已经覆盖了预检、建造、选敌、塔攻击、无人机、波次经济、局外系统、UI 与集成压力，但怪物侧存在一个明显空档：`verify-enemy-targeting.js` 主要验证怪物如何选目标、如何受嘲讽、如何回退到反应炉，并没有逐个验证怪物攻击是否真正造成伤害。

本轮专门补齐怪物攻击结算，重点检查用户提到的“分裂兽在分裂之前不攻击，或者攻击没有造成伤害”一类问题。

## 执行命令

```bash
node tools/verify-enemy-combat.js
node tools/verify-enemy-targeting.js
node tools/verify-game-preflight.js
node tools/verify-integration-stress.js
```

## 结果

```text
enemy combat ok: E1-E14 attacks, damage, ranged hits, self-destruct, split, summon, leech, aura and first-hit timing verified
enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
integration stress ok: scene composition, map reachability, long-wave rosters, fixed waves and meta combos verified
```

## 新增覆盖

- E1/E2/E3/E4/E5/E6/E7/E8/E9/E10/E14 的普通近战攻击都会对阻挡塔造成伤害。
- E3 分裂兽在死亡分裂前会正常攻击并造成伤害；死亡时会生成两只召唤标记的 E1。
- E4 嗜血兽攻击成功后会造成伤害，并按规则回血。
- E9 裂地兽会对主目标造成伤害，并对自身周围 50 码内的其他阻挡塔/无人机造成附带伤害，主目标不重复吃附带伤害。
- E10 唤卫兽第二次攻击后会召唤 E4。
- E11 猎翼虫远程弹道会命中并伤害无人机。
- E12 棘炮兽远程炮弹会在落点结算主目标与范围伤害。
- E13 自爆虫触发后会立即造成爆炸伤害并销毁自身。
- 怪物攻击主反应炉会扣除反应炉 HP，HP 归零会触发游戏结束。
- 统一首次出手延迟仍为 0.65 秒：0.649 秒不会攻击，补足到 0.65 秒后会攻击。
- E5 母巢、E8 增幅兽、E14 母巢二型的孵化/光环/召唤入口被单独覆盖。

## 发现与处理

- 没有发现新的真实游戏逻辑 bug。
- 首次运行时测试沙箱缺少 `damageDrone()` 桩函数，导致 E11 弹道无法在测试环境中结算无人机伤害；已补齐测试环境。这是验证器问题，不是游戏运行逻辑问题。
- 用户提到的“分裂兽分裂前不攻击/攻击无伤害”已被专门测试覆盖；当前代码下测试通过，说明该问题在现版本已经解决，至少没有在攻击结算层复现。

## 遗留

本批次仍是自动化规则/结算测试，不等同于真实浏览器长时间实战挂测。后续如果要确认攻击动画、弹道视觉、怪物拥挤时序和实战手感，仍建议在浏览器里人工跑一轮关卡和无尽模式。
