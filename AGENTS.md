# SCDP Web Agent 指引

## 仓库定位

PC 运营后台，使用 Vue 3 + TypeScript + Vite + Element Plus。
面向供应链 CRM、ERP、订单、销售、BI、人事运营人员；单一 SaaS 产品入口，企业租户之间隔离。

## 关键约定

1. **业务职责**：前端负责交互、展示与输入校验；订单、库存、考勤等最终业务状态由后端领域服务持有。
2. **API 层结构**：
   - `src/api/core/` — 手写调用、认证拦截、错误处理
   - `src/api/generated/` — OpenAPI 生成的代码，契约变化优先更新源定义并重新生成
3. **路由权限**：路由守卫在 `src/router/permissionGuard.ts`，授权上下文在 `src/stores/supply-authorization.ts`，数据库菜单在 `src/stores/navigation.ts`。
4. **认证**：使用 IAM OIDC Authorization Code + PKCE；Access/ID Token 只保存在页面内存，禁止写入 Web Storage。
5. **数据环境**：按任务选择本地测试、隔离数据或指定 DEV 联调。Mock 可用于开发和测试，但不能混入正式业务结果或作为真实同步成功的证据。开发模式及 `--mode desktop` 构建允许 HTTP 局域网部署；正式构建仍要求 HTTPS，并保留 PKCE、签名与权限校验。
6. **界面设计**：按当前用户需求、适用 UI 技能和组件规范实现。`src/assets/styles/_variables.scss` 提供可复用的语义 Token；历史截图和 QA 记录只描述当时版本，不作为后续设计的硬性前提。通用样式负责主题与必要布局，页面根据内容和视口决定密度，不通过跨页面选择器强制隐藏业务文案或覆盖控件尺寸。列表筛选和分页遵循下方统一规范。

## 列表筛选与分页规范

- 新增或调整列表查询区时，复用 `src/assets/styles/_list-filters.scss`，宽度统一来自 `_variables.scss` 的 `$list-filter-widths`。每个控件外包 `list-filter-field`，按用途加修饰类，不在页面重新写同类宽度或用 `flex: 1` 拉长输入框。
- 固定默认尺寸：名称/单号 `--text`（默认）160px；人员 `--person` 120px；普通下拉、地区、部门、分类、规格 `--select` 140px；日期范围 `--date-range` 248px；商品名称 `--product` 180px。部门下拉与“含子部门”用 `list-filter-group` 组合，复选框不占下拉宽度。
- 查询项只显示用途明确的占位文字，保留 `aria-label`，不额外增加顶部长标签。查询、重置、展开/收起依次固定在第一行右侧，容器变窄时查询项换行，不为填满空白拉伸。
- 使用带 `order-register-filter--compact` 类的 `OrderRegisterFilterCard` 将所有查询项放在同一个可换行容器中，不固定第一行的项数，不把后续条件强制分到第二行。按容器实际宽度依次排放，放不下才换行；收起仅显示当前屏幕能容纳的第一行，展开显示全部，窗口宽度变化时自动重新计算。查询、重置、展开的间距由共用组件控制，页面不重复覆盖。
- 日期占位和已选日期必须完整显示；多选项折叠后可查看完整内容。确有更长内容需要例外时，先说明原因并核验实际页面，不随意增加新的宽度。
- 复用 `ListTableFooter`：`actions` 插槽放底部左侧的导出、月业绩导出、列设置、同步等辅助操作，默认插槽放右侧分页。同行按钮保持一致的默认尺寸；`TableColumnSettings` 在默认按钮旁传 `size="default"`。订单列表、明细和回款使用同一套底栏样式，不再各写一套。
- 紧凑分页复用 `src/components/supply/CompactPagination.vue`：总条数、上一页、三个相邻页码及首末页/省略号、下一页、104px 每页条数选择框；不加跳转输入。参考接入：`PaymentRecordListView.vue`。
- 订单列表、明细、回款统计统一复用 `OrderStatisticsPanel`，保留各页统计值和口径说明；只由组件控制紧凑尺寸及展开/收起。统计始终单行，空间不足时在统计区内横向滚动，不换行、不挤压金额小数位；标题与展开/收起按钮不随横向滚动。默认展开，收起后保留金额摘要，不因折叠重新查询或重算统计。
- 验证至少覆盖收起、展开、已选值及常用桌面宽度。以上是新建/修改列表的默认约束，不通过全局 Element Plus 选择器强行改变其他录入表单。

## 工作方式与验证

- 围绕用户目标自主实现和重构，可以联动本工作区相关仓库。任务所需的常规 commit/push 无需再次请求许可；先检查分支、远程状态和提交范围，保留其他任务改动，不自动 force-push。
- 按改动影响选择类型检查、lint、相关测试和构建，不要求每次修改跑完整套检查。可以对本次改动使用自动修复，检查结果避免夹带无关格式化。
- 替代路径验证后清理相关废弃代码；引用检查限于受影响范围，涉及跨仓库契约时再扩展检查。
- API 生成代码优先从源定义重新生成；临时修补时同步修正生成源，避免下次生成覆盖修复。
- 不提交密钥或真实业务导出数据，不覆盖其他任务的未提交改动，不改写已执行的数据库迁移。
- 报告实际验证结果，区分本地实现、测试通过和线上验收。

共享环境和部署参考 `../共享DEV研发规范_v1.0.md`；本地开发按实际影响选择流程。

## 目录说明

```
src/
├── api/core/        - 手写 API 客户端
├── api/generated/   - OpenAPI 生成代码
├── auth/            - OIDC PKCE、回调和内存 Token
├── stores/          - Pinia stores
├── router/          - Vue Router 配置 + 守卫
├── layouts/         - 页面布局
├── views/           - 页面视图
├── components/      - 公共组件
├── types/           - TS 类型定义
├── utils/           - 工具函数
└── assets/styles/   - 样式和设计 Token
```
