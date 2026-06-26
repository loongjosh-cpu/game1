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
