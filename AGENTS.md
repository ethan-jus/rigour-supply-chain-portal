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
6. **设计 Token**：定义在 `src/assets/styles/_variables.scss`，由各使用方显式引入。

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
