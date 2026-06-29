# 测试执行记录

## 2026-06-26：批次 0-1

范围：

- 批次 0：预检与数据完整性。
- 批次 1：数据表与 GDD 对齐。

执行命令：

```bash
node tools/verify-game-preflight.js
node tools/verify-map-editor.js
```

结果：

```text
game preflight ok: 44 scripts, 17 towers, 14 enemies
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
```

本轮新增自动化覆盖：

- 从 GDD 表格解析路径塔、阻挡塔、无人机核心、敌人关键数值，并与代码数据对齐。
- 检查所有专精芯片是否被 `metaEffects()` 读取。
- 检查所有 `metaEffects()` 输出字段是否被实际游戏代码引用。
- 保留 B3 挑衅炮膛危险等级逻辑回归检查。

发现与处理：

- 初次扩展脚本时出现数个解析误判：
  - 普通伤害数字被误读为攻击间隔。
  - 治疗、毒雾、自爆字段被误按普通伤害比较。
  - 存档字段被误识别为 `metaEffects()` 效果字段。
- 以上均为测试脚本问题，已修正。
- 修正后没有发现批次 0-1 的真实游戏数据/GDD不一致问题。

遗留：

- `map-editor.before-map-import.html` 是历史未跟踪备份文件，本轮未处理。
- 下一批建议进入“批次 2：建造、升级、出售、读条与放置规则”。

## 2026-06-26：批次 2

范围：

- 建造、升级、出售、读条与放置规则。
- 源码入口审计：快捷键、按钮、读条完成、ESC取消、飞船死亡取消读条。

执行命令：

```bash
node tools/verify-build-flow.js
node tools/verify-game-preflight.js
node tools/verify-map-editor.js
```

结果：

```text
build flow ok: placement, channel, upgrade and sell guards verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
```

本轮新增自动化覆盖：

- 建造确认必须使用左键，禁止用任意鼠标按下状态触发建造。
- B4“残响线圈”芯片建造费用 -80。
- 出售返还：
  - 默认返还投入的 50%。
  - P1 回收芯片返还 90%。
  - B7 手动引爆芯片出售返还 0。
- 升级守卫：
  - 能量不足不可升级。
  - 已有读条不可升级。
  - 满级不可升级。
  - 合法状态可升级。
- 读条完成二次校验：
  - 建造完成时再次检查能量与放置合法性。
  - 升级完成时再次检查塔仍存在、等级未变化、能量足够。
- B7 生命芯片增加 100 HP。
- 小反应炉距离规则仍使用 `REACTOR_MIN_DISTANCE=1000`。

发现与处理：

- 发现真实问题：建造确认使用 `activePointer.isDown`，导致建造模式下右键移动也可能触发建造读条。
- 已修复为 `activePointer.leftButtonDown()`，现在只有左键可以确认建造。

遗留：

- 本批没有做浏览器实机点击测试；后续 UI/操作批次仍需要人工或浏览器环境回归。
- `map-editor.before-map-import.html` 是历史未跟踪备份文件，本轮继续忽略。

## 2026-06-26：批次 3

范围：

- 敌人寻路、嘲讽与目标选择。
- 阻挡塔/无人机核心/反应炉的目标优先级。
- E11 远程无人机优先逻辑与阻挡塔拦截规则。

执行命令：

```bash
node tools/verify-enemy-targeting.js
node tools/verify-game-preflight.js
node tools/verify-build-flow.js
node tools/verify-map-editor.js
```

结果：

```text
enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
build flow ok: placement, channel, upgrade and sell guards verified
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
```

本轮新增自动化覆盖：

- 敌人只有在自身危险等级 ≤ 塔/核心危险等级，且位于作用范围内时才会被嘲讽。
- 敌人离开阻挡塔作用范围后，旧目标会被释放并重新回到路径/反应炉兜底逻辑。
- 多个合格阻挡塔同时存在时：
  - 更高危险等级优先。
  - 同危险等级且没有旧目标时，距离更近者优先。
  - 已持有同危险等级目标时，不会因为更近同级目标而频繁切换。
- 反应炉兜底选择最近存活反应炉，死亡反应炉不会被选择。
- B3 挑衅炮膛危险等级仍符合满血 +1、低血 -1。
- E11 的无人机优先远程攻击不能绕过当前有效阻挡塔目标。

发现与处理：

- 发现真实问题：E11 的 `droneRange` 分支在阻挡塔战斗前执行，导致 E11 已被合格阻挡塔拦截时，仍可能先向无人机开火。
- 已修复：当 E11 当前存在有效阻挡塔目标时，远程无人机优先分支直接让位，后续进入阻挡塔战斗逻辑。

遗留：

- 本批验证的是目标选择与规则入口，没有做完整浏览器实机寻路压力测试。
- 后续批次仍需在“全局回归/压力测试”中跑实际多怪、多线、多塔场景。

## 2026-06-29：批次 4

范围：
- 防御塔攻击、治疗、DOT、弹道落点与主要芯片战斗效果。
- 覆盖 P2/P3/P4/P6/P7、B2/B4/B5/B6/B7，以及毒药芯片、D1/B6 减伤机制。

执行命令：
```bash
node tools/verify-tower-combat.js
node tools/verify-game-preflight.js
node tools/verify-map-editor.js
node tools/verify-build-flow.js
node tools/verify-enemy-targeting.js
```

结果：
```text
tower combat ok: attacks, DOT, healing, shields, projectiles and chip combat effects verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
build flow ok: placement, channel, upgrade and sell guards verified
enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified
```

本轮新增自动化覆盖：

- P6 芯片攻击范围 +200，以及 B1/B7/P6 的攻击入口守卫。
- P2 超导主束：主目标 2.5 倍、分叉 60%、连锁范围限制。
- B2 第三击焚域喷涌：1200 码范围、1.5 倍伤害。
- P3 弹幕到达目标点后才进行 AOE 结算。
- P4 冰冻芯片：优先未冰冻目标、命中已减速敌人后冰冻 0.5 秒、2 秒冻结冷却、受伤放大窗口。
- P7 毒爆结算：结算剩余毒伤、层数附加伤害、清除旧毒并补 1 层新毒。
- 毒药芯片：持续 2.5 秒、每跳 +1、移动速度 -10%。
- B5 过量治疗护盾上限 100，以及 B5 治疗无人机芯片。
- B6 毒性护膜：中毒敌人对 B6 伤害 -30%。
- D1 应激装甲：每个敌人对每架无人机的首次伤害 -60%。
- B7 爆炸伤害芯片与 B4 残响 8 次脉冲事件。

发现与处理：

- 本批次没有发现需要修改游戏逻辑的真实 bug。
- 新增 `tools/verify-tower-combat.js`，作为塔战斗规则的回归测试入口。

遗留：

- 本批次验证的是结算层与触发条件，不覆盖完整浏览器内视觉表现、长时间波次压力测试和复杂实战手感。

## 2026-06-29：批次 5

范围：
- 无人机系统：生产、补员耗能、目标选择、追击、卡住恢复、仇恨转移、D1/D2 芯片、D3 维修。
- 重点覆盖之前实战反复出现的问题：无人机目标过度集中、交战后脱战换目标、追击高速敌人时停止、巡逻/卡住、不该穿墙的导航点。

执行命令：
```bash
node tools/verify-drone-system.js
node tools/verify-game-preflight.js
node tools/verify-map-editor.js
node tools/verify-build-flow.js
node tools/verify-enemy-targeting.js
node tools/verify-tower-combat.js
```

结果：
```text
drone system ok: production, targeting, chase, stuck recovery, aggro, revive, death blast and D3 repair verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
build flow ok: placement, channel, upgrade and sell guards verified
enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified
tower combat ok: attacks, DOT, healing, shields, projectiles and chip combat effects verified
```

本轮新增自动化覆盖：

- D1 补员上限、补员耗能、补员能量开关。
- 多无人机目标负载分配：空闲无人机避免堆叠到已有无人机负责的目标。
- 已进入交战状态的无人机不会因为重新评估目标而脱战；未交战无人机允许重新分配目标。
- 无人机选定目标后，追击阶段可以离开核心范围；追击失败会丢弃目标并短暂避开该目标。
- 导航点必须避开墙体与阻塞格；卡住恢复会清除目标、路线与运动状态。
- 无人机攻击后拉取敌人仇恨；当前无人机死亡后，仇恨可转移给仍在攻击该敌人的其他无人机。
- D1 死亡殉爆芯片：80 码范围、20 伤害。
- D2 复活芯片：核心处满血复活、持续扣血、不可治疗、只触发一次。
- D3 维修无人机不攻击敌人；维修时治疗塔并扣除自身等量 HP；低血撤离芯片触发返航。

发现与处理：

- 本批次没有发现需要修改游戏逻辑的真实 bug。
- 新增 `tools/verify-drone-system.js`，作为无人机系统的回归测试入口。
- 初次运行时测试沙箱漏加载 `nearestWallDistance()` 所在的路径模块，已修正为加载 `src/core/pathfinding.js`；这是验证器环境问题，不是游戏逻辑问题。

遗留：

- 本批次验证的是无人机状态机和结算规则，不等同于浏览器内长时间实战压力测试；大量无人机、多墙体、多高速怪场景仍建议在最终批次做实机观察。

## 2026-06-29：批次 6

范围：
- 波次、经济、奖励与模式结算。
- 覆盖关卡固定波次、无尽随机预算、击杀收益、召唤怪收益屏蔽、反应炉产能、主反应炉芯片波次补给、星核结算。

执行命令：
```bash
node tools/verify-wave-economy.js
node tools/verify-game-preflight.js
node tools/verify-map-editor.js
node tools/verify-build-flow.js
node tools/verify-enemy-targeting.js
node tools/verify-tower-combat.js
node tools/verify-drone-system.js
```

结果：
```text
wave economy ok: kill rewards, spawn scaling, fixed waves, endless budget, reactor income and star-core rewards verified
game preflight ok: 44 scripts, 17 towers, 14 enemies
map editor ok: 9 levels, 9 rendered cards
已加载 9 张关卡，列表显示 9 张
build flow ok: placement, channel, upgrade and sell guards verified
enemy targeting ok: taunt range, priority, reactor fallback and E11 blocker rules verified
tower combat ok: attacks, DOT, healing, shields, projectiles and chip combat effects verified
drone system ok: production, targeting, chase, stuck recovery, aggro, revive, death blast and D3 repair verified
```

本轮新增自动化覆盖：

- 击杀收益 = 敌人威胁成本 × 3。
- 召唤怪与分裂子怪不提供击杀能量。
- E3 分裂后生成两个召唤标记的 E1。
- 无尽模式只提高 HP，不提高伤害、速度、攻击间隔。
- 关卡模式使用固定 roster 与固定 scale。
- 无尽随机波次遵守预算、特殊怪预算上限、特殊怪同类型数量上限、直接压力怪前置比例。
- E2/E4/E7/E8/E11/E13/E14 等敌人的无尽解锁波次入口。
- 前 5 波主反应炉芯片每波 +120 能量，超过限制后停止。
- 无尽模式结算按每 5 波 1 星核；主动退出同样按 completedWaves 结算。
- 关卡失败不给星核、不标记通关；关卡完成给 1 星核并记录通关。
- 反应炉产能只统计存活的主/小反应炉。
- 后续导入关卡 level6-level9 使用 15 波；原前五关保持 10 波。

发现与处理：

- 本批次没有发现需要修改游戏逻辑的真实 bug。
- 新增 `tools/verify-wave-economy.js`，作为波次与经济系统的回归测试入口。
- 初次运行时测试沙箱导出变量写法有误，已修正；这是验证器环境问题，不是游戏逻辑问题。

遗留：

- 本批次验证的是规则层，不覆盖实际长时间无尽模式的经济曲线手感；最终批次仍需要跑完整实战压力测试。
