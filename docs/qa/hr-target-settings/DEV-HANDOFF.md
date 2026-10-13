# 人事指标设置本地开发交接

2026-10-09。Web 与 Platform 均在 `feature/hr-target-settings`；仅本地开发，未推送、发布或部署。

## 当前实现

- HR 是指标唯一维护方：`/api/v1/hr/target-settings` 读取和批量保存，`/history` 查询修改记录，`/values` 提供签名服务间有效值查询。
- 城市名单取有效“销售部”下所有层级的有效子部门；销售名单取销售部及其子部门的员工档案。不依赖订单，也不需要初始化任务。新增部门、员工会在下次读取时出现。
- 初始值只存在 HR：城市交易额/到账金额均 100000，销售分别 40000/20000；新增合作客户 200、复购客户 100。未编辑时返回初始值，编辑后返回保存值；0 表示不考核。
- UI 删除单独设置、自定义、默认标准、恢复默认、复制上月等入口。保留月份、直接修改、批量修改、预览、原因及审计。
- HR 只建目标值和审计两张表；BI 服务端通过 HR API 取有效值，再结合自身可见范围计算达成，不维护初始值或目标写接口。BI 历史已执行迁移保留；旧目标表不再被运行时代码使用。
- 页面权限 `hr:targets:read`，修改权限 `hr:targets:write`；沿用现有角色授权及 ALL/CUSTOM/DEPARTMENT/SELF 范围。服务间值查询要求签名 SERVICE 身份和 `hr:targets:service-read`。

## DEV 实际状态

- 已读取确认 IAM V125、HR V9 成功，BI 最新 V25；HR 新目标表和 BI 历史目标表当前均为 0 行。
- IAM 首次 V125 失败原因是状态枚举误用 INACTIVE，已改为 DISABLED。用户明确授权后只删除该失败记录，备份在工作区 outputs/hr-target-settings-20261009；所有成功历史校验和未变。后续用户启动已成功执行 V125。
- 租户指标页面在 18:07 的 MENU_UPDATE 后为隐藏/停用。18:20 通过 DEV 菜单管理恢复显示/启用，数据库回读确认；没有修改角色授权或数据范围。
- Chrome 实际从人事菜单进入页面，HR 接口成功加载 17 个城市、205 名销售。没有保存真实业务指标；真实保存后 BI 看板跨服务联动尚待验收。
- 代理未重启用户管理的服务，未执行发布部署。

## 验证

- HR 模块 45 项通过；BI 377 项中 374 通过、3 项既有外部数据库测试跳过。先 clean 清除了退役类与迁移的旧构建产物，再 verify 成功。
- 架构门禁 9 项通过。IAM 在全量 verify 中通过。
- Web 32 个相关测试文件共 277 项通过（其中修订后的 cockpit 21 项单独复跑通过）；修改范围 ESLint、TypeScript 与构建通过。
- 全仓库 `./mvnw verify` 在未修改的 Integration 模块失败：DhbScheduledHistoryProtectionTest 第 123 行禁止任何 mock 调用，但现有 projectOrder 执行了一次查询。未扩大本次范围修改该业务逻辑。
- general-ci 校验因仓库缺少 scripts/database/general-ci-baselines.json 无法运行；没有重建冻结基线。
- git diff --check 仅提示 HR V9 文件末尾空行；该脚本已被 DEV 成功执行，按迁移不可改写规则保留原内容和校验和。

## 入口

- DEV：http://localhost:5100/#/supply-chain/hr/target-settings
- 隔离预览：http://localhost:5100/tests/fixtures/hr-target-settings.html ，有示例数据标识，保存仅在内存生效；`?readonly` 验证只读状态。
