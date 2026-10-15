# GSAP 与 taste 审查记录

日期：2026-10-15。对象：既有纯静态旅行规划工作台。

## 来源和适用范围

- GSAP 3.15.0：从官方 npm 包下载，SHA-512 校验通过，只保留核心库、原包元数据和许可引用。核心约 73 KB，无 CDN、无运行时 npm 安装要求。见 [本地依赖说明](../../vendor/gsap/README.md)。
- [taste-skill 原作者仓库](https://github.com/Leonxlnx/taste-skill)：安装 `skills/taste-skill` 为 `design-taste-frontend`，并安装 `skills/redesign-skill` 为 `redesign-existing-projects`，保存在 Codex 技能目录。
- 当前主技能明确写有 “Not for dashboards or app screens.”。本项目是应用工作台，因此以配套 redesign 的扫描、诊断、定点改进流程为准，保留用户已确认的设计，没有套用随机营销页方向或增加宣传素材。

## 项目依据与动画

实际内容包括：景点勾选、逐日预算、首站距离、抵达站点 70/30 排序、站间交通、地图编号、住宿比较、手动编辑、本机 JSON 存档。输入区承载选择；摘要呈现当前配置；逐站路线承载时间与交通；地图呈现空间顺序；详情解释限制。动画跟随操作，不承担隐藏内容或推迟可用性的职责。

独立 `js/motion.js` 使用 GSAP matchMedia。首屏小幅入场；景点列表最多 8 项依次出现；勾选和单选项有短促反馈；步骤状态、结果、路线编辑、原生 details 和景点详情有反馈。只操作 transform / opacity，不对分栏或粘性地图祖先做变换。

动态切换减少动态效果时撤销动画、观察器和事件处理，恢复原始样式，保留键盘焦点。打印前完成动画；缺少 GSAP 时内容保持可见和可操作。没有滚动劫持、装饰性无限循环或每个模块重复滚动入场。

## 截图审查

原版 lint 与 inspector 均实际运行，未修改检查器，未使用 `--allow` 隐藏结果。截图位于本机可视化输出目录的 `taste-audit` 和 `taste-audit-final`。最终原始测量见 [taste-audit.json](taste-audit.json)。初次 inspector 为 6 FAIL / 6 WARN，打磨后为 5 FAIL / 4 WARN。

ROUND 1

Seen in one second: 先选目的地和景点，右侧是当前行程。

Idea (one sentence): 景点选择成为逐站路线与地图的共同输入。

Live thing: 勾选景点、设置交通，生成可调整的每日路线。

Layout words by section: intro=标题与三步导航 / planning=输入与摘要 / results=路线和地图并排。

Scores: design 6.5 · usability 7 · creativity 6 · content 8 → overall 6.0。原版营销页规则仍报 FAIL，按技能评分上限封顶。这是主观自评，不是第三方评级。

Caps applied: 原始 inspector FAIL；缺少宣传图片与大型首屏素材；主要按钮在表单后部。

Top three problems (most visible first), each with the screenshot it shows in and the fix:

1. `trip-picker-375.png`：景点简介需要悬停才能完整阅读。移除行数截断，完整显示简介与看点。
2. 三宽首屏：存档说明和设置摘要有 11–12px 小字。应用自有字号统一不低于 13px，正文基准 16px。
3. 首屏：图标与组件装饰不一致、按钮缺少按下反馈。favicon 改用品牌罗盘 SVG，移除标题装饰细线与品牌分隔线，加入按下反馈、数字等宽排版，交换按钮扩大到 44px。

ROUND 2

Seen in one second: 选择目的地、勾选景点，按步骤生成路线。

Idea (one sentence): 同一份景点选择连接规划摘要、每日路线与地图。

Live thing: 选择、生成和编辑交互保留，GSAP 对操作给予反馈。

Layout words by section: 已确认工作台，桌面分栏、小屏顺排。

Scores: design 6.5 · usability 8 · creativity 6 · content 8 → overall 6.0。原版规则仍有 FAIL，继续按技能封顶，不将宣传页评分当作应用验收。

Caps applied: 原版 inspector 的营销页条件仍未满足。

Top three problems (most visible first), each with the screenshot it shows in and the fix:

1. 三宽首屏：原版要求八个自动运动元素，实测一个。保留一次首屏入场；真实交互动画由 GSAP 浏览器场景验证，不增加干扰规划的自动运动。
2. 三宽首屏：原版要求四张照片、巨幅标题和视频。保留紧凑输入与实际地图，避免宣传素材占据规划区域。
3. 三宽首屏：原版将控件说明的主要字号归为 13px 正文，并反对功能分组线。保留次要说明和功能边界；基础正文 16px。截图无横向溢出或标题遮挡。

## 剩余规则

最终 5 FAIL：`hairline`（功能分组）、`body-size`（统计到次要说明 13px）、`few-pictures`、`focal-point`、`still-page`（后三项针对宣传页素材及自动运动）。4 WARN：`outlined-box`（功能面板）、`dashed`（高级设置分隔）、`grey-body`（次要说明，对比度约 5.1:1）、`no-footage`（无宣传视频）。结果原样保留，没有声称原版 gate 全通过。

未引入素材替身、虚构评价或样例业务内容。已查看最终 1440/768/390 首屏，以及回归中的手机景点、桌面和手机路线截图。交互、响应式和打印以项目浏览器验收为准。

## 验证

36 项规则/数据测试、39 个浏览器场景和 20 个应用脚本静态检查通过。新增场景使用实际 GSAP，覆盖动画、动态减少效果、焦点、详情展开、打印清理和依赖缺失。常规回归的在线接口和瓦片被模拟；本轮不据此保证在线服务可用性，先前真实地图记录保留。未提交、推送或公开部署本次改动。
