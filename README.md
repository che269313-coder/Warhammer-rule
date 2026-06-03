# BecomeChampion

战锤40K 规则助手（网页端，适配移动式设备）。

核心目标：在对局中按阶段快速看到可用规则，勾选已用能力，减少漏开与反复翻书。

## 项目特性

1. 阶段视图：覆盖 10版常用 6 阶段（指挥、移动、射击、冲锋、近战、战斗冲击）。
2. 能力卡片：展示名称、来源、触发时机、摘要、CP、目标。
3. 已用标记：能力可单独标记，支持一键清空。
4. 回合追踪：支持 1-5 回合计数。
5. 建军筛选：可先在“建军阶段”勾选本局实际携带单位，后续阶段仅展示这些单位的能力。
6. 双层筛选：
   1. 按类别筛选（全部、单位能力、战略点、编队规则）。
   2. 按编队筛选（全部、Gladius Task Force、Bastion Task Force等）。
7. 规则包管理：导入、切换、删除、导出备份。
8. 离线能力：IndexedDB + localStorage 存储数据，Service Worker 缓存外壳。
9. 内置规则包：6 个规则包（AC、TYR、TAU、IK、SM-BT、SM-UM）嵌入页面，免导入直接一键激活，`file://` 本地运行同样可用。

## 项目优势

- 模块化规则包：使用独立的规则包（rules pack）来管理不同军种/分队的规则，支持快速切换与并行维护。
- 支持自定义导入：用户可按需导入自定义 JSON 规则包（导入/导出/备份），便于私人编队、赛事或替代规则使用。
- CSV→规则包流水线：可从 [10e](10e) CSV 自动生成规则包，简化批量更新与社区协作。
- 离线优先与轻量前端：IndexedDB/localStorage + Service Worker 支持离线使用并保持较低资源占用。
- 可审计与可回滚：规则包包含 `pack_version`/`date`/`source_note`，支持导出备份与版本回滚。
- 易扩展与社区友好：规则包格式规范明确，第三方可编写转换器或生成器扩展功能。

## 适用人群

1. 主要使用电子设备进行对局辅助的玩家。
2. 希望把编队规则、战略点和强化集中查看的玩家。
3. 需要离线使用（场地信号不稳定）的玩家。

## 快速开始
在线使用：目前测试版托管于[github.io](https://che269313-coder.github.io/Warhammer-rule/),可以直接进行访问与使用

1. 克隆或下载本仓库。
2. 打开 [index.html](index.html) 即可使用。
3. 进入规则包管理，"📦 内置规则包"区域直接点击即可一键激活（无需手动导入）；也可上传自定义 JSON 规则包。
4. 进入“建军阶段”勾选本局实际携带单位。
5. 返回主页点击阶段按钮开始使用。

> **中文用户注意**：首次使用请点击右上角 ⚙️ → 在「内置规则包」中激活「星际战士 · 黑色圣堂」（中文规则包）。浏览器会记住选择，之后无需重复操作。

说明：
1. 使用 file:// 也能运行主要功能（本地存储可用）。
2. 若希望启用 Service Worker 缓存，建议使用 http://localhost 访问。

## 当前样例与规则包

当前内置样例是黑色圣堂主题：

1. [sample-rules-pack.json](sample-rules-pack.json)
2. [sample-pack.js](sample-pack.js)

另外，仓库现在支持把完整规则包生成为独立 JSON 文件，放在 [rulepacks](rulepacks) 目录中，便于手动导入、备份和版本管理。

所有内置规则包同时打包为 [builtin-packs.js](builtin-packs.js)，以 `window.BC_BUILTIN_PACKS` 全局变量嵌入页面，使 `file://` 协议下也能直接激活，无需服务器。

当前已生成规则包：

1. [rulepacks/SM-BT-rules-pack.json](rulepacks/SM-BT-rules-pack.json)：Black Templars 专属单位 + 通用 SM 合法单位 + 通用分队 + BT 专属分队。
2. [rulepacks/CN-SM-BT-rules-pack.json](rulepacks/CN-SM-BT-rules-pack.json)：黑色圣堂中文包，基于现有 SM-BT 规则包生成，主要规则文本翻译为中文并保留常见英文关键词。
3. [rulepacks/SM-UM-rules-pack.json](rulepacks/SM-UM-rules-pack.json)：Ultramarines 专属单位 + 通用 SM 单位 + 通用分队 + UM 专属分队。
4. [rulepacks/AC-rules-pack.json](rulepacks/AC-rules-pack.json)：Adeptus Custodes 单位 + Sisters of Silence 单位 + Forge World 禁军单位 + 6 个标准分队。
5. [rulepacks/TYR-rules-pack.json](rulepacks/TYR-rules-pack.json)：Tyranids 所有单位 + 6 个标准分队（不含登舰分队）。
6. [rulepacks/TAU-rules-pack.json](rulepacks/TAU-rules-pack.json)：T'au Empire 所有单位 + 6 个标准分队。
7. [rulepacks/IK-rules-pack.json](rulepacks/IK-rules-pack.json)：Imperial Knights 所有单位 + 5 个标准分队。

## CSV 生成流程

项目支持从 [10e](10e) CSV 自动生成独立规则包 JSON。样例包仍单独保留，不要求由这些脚本覆盖。

数据目录：

1. [10e](10e)

生成脚本：

1. [tools/generate-bt-pack-from-csv.js](tools/generate-bt-pack-from-csv.js)
2. [tools/generate-cn-bt-pack.js](tools/generate-cn-bt-pack.js)
3. [tools/generate-um-pack-from-csv.js](tools/generate-um-pack-from-csv.js)
4. [tools/generate-ac-pack-from-csv.js](tools/generate-ac-pack-from-csv.js)
5. [tools/generate-tyr-pack-from-csv.js](tools/generate-tyr-pack-from-csv.js)
6. [tools/generate-tau-pack-from-csv.js](tools/generate-tau-pack-from-csv.js)
7. [tools/generate-ik-pack-from-csv.js](tools/generate-ik-pack-from-csv.js)

执行命令：

```bash
node .\tools\generate-bt-pack-from-csv.js
node .\tools\generate-cn-bt-pack.js
node .\tools\generate-um-pack-from-csv.js
node .\tools\generate-ac-pack-from-csv.js
node .\tools\generate-tyr-pack-from-csv.js
node .\tools\generate-tau-pack-from-csv.js
node .\tools\generate-ik-pack-from-csv.js
```

脚本会输出：

1. [rulepacks/SM-BT-rules-pack.json](rulepacks/SM-BT-rules-pack.json)
2. [rulepacks/CN-SM-BT-rules-pack.json](rulepacks/CN-SM-BT-rules-pack.json)
3. [rulepacks/SM-UM-rules-pack.json](rulepacks/SM-UM-rules-pack.json)
4. [rulepacks/AC-rules-pack.json](rulepacks/AC-rules-pack.json)
5. [rulepacks/TYR-rules-pack.json](rulepacks/TYR-rules-pack.json)
6. [rulepacks/TAU-rules-pack.json](rulepacks/TAU-rules-pack.json)
7. [rulepacks/IK-rules-pack.json](rulepacks/IK-rules-pack.json)

**更新内置包：** 每次重新生成任意规则包后，需执行以下命令同步 [builtin-packs.js](builtin-packs.js)：

```bash
node .\tools\bundle-builtin-packs.js
```

当前脚本的设计目标：

1. 保留战团专属单位和专属分队。
2. 同时纳入该战团可合法使用的通用 Space Marines 单位与通用分队。
3. 对 CSV 文本做基础清洗和结构化，生成适合本应用阶段提示的 rules pack。

## 项目结构

```text
BecomeChampion/
  app.js
  index.html
  style.css
  sw.js
  manifest.json
  icon.svg
  sample-rules-pack.json
  sample-pack.js
  builtin-packs.js          ← 所有内置包的 JS 嵌入包（由 bundle 脚本生成）
  rulepacks/
    SM-BT-rules-pack.json
    CN-SM-BT-rules-pack.json
    SM-UM-rules-pack.json
    AC-rules-pack.json
    TYR-rules-pack.json
    TAU-rules-pack.json
    IK-rules-pack.json
  10e/
  tools/
    generate-bt-pack-from-csv.js
    generate-cn-bt-pack.js
    generate-um-pack-from-csv.js
    generate-ac-pack-from-csv.js
    generate-tyr-pack-from-csv.js
    generate-tau-pack-from-csv.js
    generate-ik-pack-from-csv.js
    bundle-builtin-packs.js   ← 打包所有规则包为 builtin-packs.js
```

关键文件说明：

1. [app.js](app.js)：状态管理、筛选逻辑、渲染与事件处理。
2. [style.css](style.css)：移动端样式与组件外观。
3. [sw.js](sw.js)：离线缓存逻辑。
4. [sample-rules-pack.json](sample-rules-pack.json)：可导入的示例规则包。
5. [sample-pack.js](sample-pack.js)：内置样例数据（供一键导入和下载按钮回退使用）。
6. [builtin-packs.js](builtin-packs.js)：所有内置规则包 JSON 的 JS 嵌入包，`window.BC_BUILTIN_PACKS` 全局变量；由 `bundle-builtin-packs.js` 生成，支持 `file://` 直接访问。
7. [rulepacks](rulepacks)：独立生成的规则包目录。
8. [tools/generate-bt-pack-from-csv.js](tools/generate-bt-pack-from-csv.js)：Black Templars 规则包生成器。
9. [tools/generate-um-pack-from-csv.js](tools/generate-um-pack-from-csv.js)：Ultramarines 规则包生成器。
10. [tools/generate-ac-pack-from-csv.js](tools/generate-ac-pack-from-csv.js)：Adeptus Custodes 规则包生成器。
11. [tools/generate-tyr-pack-from-csv.js](tools/generate-tyr-pack-from-csv.js)：Tyranids 规则包生成器。
12. [tools/generate-tau-pack-from-csv.js](tools/generate-tau-pack-from-csv.js)：T'au Empire 规则包生成器。
13. [tools/generate-ik-pack-from-csv.js](tools/generate-ik-pack-from-csv.js)：Imperial Knights 规则包生成器。
14. [tools/bundle-builtin-packs.js](tools/bundle-builtin-packs.js)：将所有 rulepacks JSON 打包为 builtin-packs.js 的工具脚本。

## 规则包格式（简版）

顶层字段：

1. id
2. faction
3. subfaction
4. game_version
5. pack_version
6. date
7. source_note
8. units
9. stratagems
10. detachment_rules
11. enhancements

阶段枚举：

1. command
2. movement
3. shooting
4. charge
5. fight
6. battleshock
7. any

## 开发与维护

常用维护动作：

1. 更新 10e CSV 后，执行对应生成脚本刷新 [rulepacks](rulepacks) 中的独立规则包，然后执行 `node .\tools\bundle-builtin-packs.js` 重新生成 [builtin-packs.js](builtin-packs.js)。
2. 打开页面后在"规则包管理"里点击"📦 内置规则包"区域的条目直接激活，并验证"建军阶段"筛选与阶段视图行为。
3. 需要发布新规则包时，更新 pack_version 与 source_note。
4. 如果本次发布修改了 [index.html](index.html)、[app.js](app.js)、[style.css](style.css)、[sample-pack.js](sample-pack.js)、[builtin-packs.js](builtin-packs.js)、[manifest.json](manifest.json) 或 [icon.svg](icon.svg)，请同时更新 [sw.js](sw.js) 中的 `CACHE_NAME`。当前离线缓存采用固定版本号，未同步 bump 缓存版本时，GitHub Pages 已更新但客户端仍可能继续读取旧缓存。

## 版权与声明

1. 本项目不存储官方 Codex 原文。
2. 规则文本为社区数据的摘要与结构化展示，仅供对局辅助。
3. Warhammer 40,000 相关知识产权归 Games Workshop 所有。
4. 本项目采用 MIT 许可证。

---

# BecomeChampion

Warhammer 40K Rules Assistant (Mobile-first, offline-capable, zero-build frontend).

Core Goal: Quickly view available rules by phase during games, check used abilities, reduce missed opportunities and repeated book-flipping.

## Project Features

1. Phase View: Covers 6 common phases in 10th edition (Command, Movement, Shooting, Charge, Fight, Battleshock).
2. Ability Cards: Display name, source, trigger timing, summary, CP, target.
3. Used Marker: Abilities can be marked individually, support one-click clear.
4. Turn Tracking: Supports 1-5 turn counting.
5. Roster Filtering: In the roster step, select only the units actually brought so later phase views show only their unit abilities.
6. Dual Filtering:
   1. Filter by category (All, Unit Abilities, Stratagems, Detachment Rules).
   2. Filter by detachment (All, Wrathful Procession, Gladius Task Force, Bastion Task Force).
7. Rules Pack Management: Import, switch, delete, export backup.
8. Offline Capability: IndexedDB + localStorage for data storage, Service Worker for shell caching.

## Target Users

1. Players who mainly use mobile or tablet for game assistance.
2. Players who want to view detachment rules, stratagems, and enhancements centrally.
3. Players who need offline use (unstable venue signals).

## Quick Start

1. Clone or download this repository.
2. Open [index.html](index.html) to use.
3. Go to Rules Pack Management — click any entry in the "📦 Built-in Packs" section to activate it instantly (no import needed); or upload a custom JSON rules pack.
4. Go to the roster step and select the units actually brought to the game.
5. Return to home and click phase buttons to start using.

Notes:
1. Using file:// can also run main functions (local storage available).
2. If you want to enable Service Worker caching, recommend using http://localhost access.

## Current Sample And Rules Packs

The built-in sample remains Black Templars themed and is intentionally unchanged:

1. [sample-rules-pack.json](sample-rules-pack.json)
2. [sample-pack.js](sample-pack.js)

In addition, the repository now supports generating standalone rules packs into [rulepacks](rulepacks) for manual import, backup and versioning.

All built-in packs are also bundled into [builtin-packs.js](builtin-packs.js) as `window.BC_BUILTIN_PACKS`, embedded via `<script>` tag so they work on `file://` without any server.

Currently generated packs:

1. [rulepacks/SM-BT-rules-pack.json](rulepacks/SM-BT-rules-pack.json): Black Templars exclusive units + BT-legal generic Space Marines units + generic detachments + BT-exclusive detachments.
2. [rulepacks/SM-UM-rules-pack.json](rulepacks/SM-UM-rules-pack.json): Ultramarines exclusive units + generic Space Marines units + generic detachments + UM-exclusive detachments.
3. [rulepacks/AC-rules-pack.json](rulepacks/AC-rules-pack.json): Adeptus Custodes units + Sisters of Silence units + Custodes Forge World units + 6 standard detachments.
4. [rulepacks/TYR-rules-pack.json](rulepacks/TYR-rules-pack.json): Tyranids all units + 6 standard detachments (boarding excluded).
5. [rulepacks/TAU-rules-pack.json](rulepacks/TAU-rules-pack.json): T'au Empire all units + 6 standard detachments.
6. [rulepacks/IK-rules-pack.json](rulepacks/IK-rules-pack.json): Imperial Knights all units + 5 standard detachments.

## CSV Generation Process

The project supports generating standalone rules-pack JSON files from [10e](10e) CSV exports. The sample pack remains separate and does not need to be overwritten by these scripts.

Data directory:

1. [10e](10e)

Generation scripts:

1. [tools/generate-bt-pack-from-csv.js](tools/generate-bt-pack-from-csv.js)
2. [tools/generate-um-pack-from-csv.js](tools/generate-um-pack-from-csv.js)
3. [tools/generate-ac-pack-from-csv.js](tools/generate-ac-pack-from-csv.js)
4. [tools/generate-tyr-pack-from-csv.js](tools/generate-tyr-pack-from-csv.js)
5. [tools/generate-tau-pack-from-csv.js](tools/generate-tau-pack-from-csv.js)
6. [tools/generate-ik-pack-from-csv.js](tools/generate-ik-pack-from-csv.js)

Execution command:

```bash
node .\tools\generate-bt-pack-from-csv.js
node .\tools\generate-um-pack-from-csv.js
node .\tools\generate-ac-pack-from-csv.js
node .\tools\generate-tyr-pack-from-csv.js
node .\tools\generate-tau-pack-from-csv.js
node .\tools\generate-ik-pack-from-csv.js
```

The scripts will output:

1. [rulepacks/SM-BT-rules-pack.json](rulepacks/SM-BT-rules-pack.json)
2. [rulepacks/SM-UM-rules-pack.json](rulepacks/SM-UM-rules-pack.json)
3. [rulepacks/AC-rules-pack.json](rulepacks/AC-rules-pack.json)
4. [rulepacks/TYR-rules-pack.json](rulepacks/TYR-rules-pack.json)
5. [rulepacks/TAU-rules-pack.json](rulepacks/TAU-rules-pack.json)
6. [rulepacks/IK-rules-pack.json](rulepacks/IK-rules-pack.json)

**Updating the built-in bundle:** After regenerating any pack, re-run the bundle script to keep [builtin-packs.js](builtin-packs.js) in sync:

```bash
node .\tools\bundle-builtin-packs.js
```

Current script goals:

1. Keep chapter-exclusive units and exclusive detachments.
2. Include generic Space Marines units and detachments that are legal for that chapter.
3. Clean and normalize CSV text into rules packs suitable for this app’s phase-based prompting flow.

## Project Structure

```text
BecomeChampion/
  app.js
  index.html
  style.css
  sw.js
  manifest.json
  icon.svg
  sample-rules-pack.json
  sample-pack.js
  builtin-packs.js          ← JS bundle of all built-in packs (generated by bundle script)
  rulepacks/
    SM-BT-rules-pack.json
    SM-UM-rules-pack.json
    AC-rules-pack.json
    TYR-rules-pack.json
    TAU-rules-pack.json
    IK-rules-pack.json
  10e/
  tools/
    generate-bt-pack-from-csv.js
    generate-um-pack-from-csv.js
    generate-ac-pack-from-csv.js
    generate-tyr-pack-from-csv.js
    generate-tau-pack-from-csv.js
    generate-ik-pack-from-csv.js
    bundle-builtin-packs.js   ← bundles all rulepacks into builtin-packs.js
```

Key file descriptions:

1. [app.js](app.js): State management, filtering logic, rendering and event handling.
2. [style.css](style.css): Mobile styles and component appearance.
3. [sw.js](sw.js): Offline caching logic.
4. [sample-rules-pack.json](sample-rules-pack.json): Importable sample rules pack.
5. [sample-pack.js](sample-pack.js): Built-in sample data used by the sample import/download fallback.
6. [builtin-packs.js](builtin-packs.js): JS bundle of all built-in pack JSON as `window.BC_BUILTIN_PACKS`; generated by `bundle-builtin-packs.js`, works on `file://`.
7. [rulepacks](rulepacks): Directory for standalone generated rules packs.
8. [tools/generate-bt-pack-from-csv.js](tools/generate-bt-pack-from-csv.js): Black Templars rules-pack generator.
9. [tools/generate-um-pack-from-csv.js](tools/generate-um-pack-from-csv.js): Ultramarines rules-pack generator.
10. [tools/generate-ac-pack-from-csv.js](tools/generate-ac-pack-from-csv.js): Adeptus Custodes rules-pack generator.
11. [tools/generate-tyr-pack-from-csv.js](tools/generate-tyr-pack-from-csv.js): Tyranids rules-pack generator.
12. [tools/generate-tau-pack-from-csv.js](tools/generate-tau-pack-from-csv.js): T'au Empire rules-pack generator.
13. [tools/generate-ik-pack-from-csv.js](tools/generate-ik-pack-from-csv.js): Imperial Knights rules-pack generator.
14. [tools/bundle-builtin-packs.js](tools/bundle-builtin-packs.js): Bundles all rulepacks JSON into builtin-packs.js.

## Rules Pack Format (Simplified)

Top-level fields:

1. id
2. faction
3. subfaction
4. game_version
5. pack_version
6. date
7. source_note
8. units
9. stratagems
10. detachment_rules
11. enhancements

Phase enums:

1. command
2. movement
3. shooting
4. charge
5. fight
6. battleshock
7. any

## Development and Maintenance

Common maintenance actions:

1. After updating 10e CSV, run the relevant generator to refresh the standalone pack in [rulepacks](rulepacks).
2. After opening the page, import the target rules pack in Rules Pack Management and verify roster filtering and phase-view behavior.
3. When releasing a new rules pack, update pack_version and source_note.
 4. If a release changes [index.html](index.html), [app.js](app.js), [style.css](style.css), [sample-pack.js](sample-pack.js), [sample-rules-pack.json](sample-rules-pack.json), [manifest.json](manifest.json), or [icon.svg](icon.svg), also bump `CACHE_NAME` in [sw.js](sw.js). The offline shell currently uses a fixed cache version, so GitHub Pages can be updated while clients continue serving old cached assets unless the cache version changes.

## Copyright and Disclaimer

1. This project does not store official Codex text.
2. Rules text is summary and structured display of community data, for game assistance only.
3. Warhammer 40,000 related intellectual property belongs to Games Workshop.
