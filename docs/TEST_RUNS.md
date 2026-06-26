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
