# PC Portal Agent 指引

## 仓库定位

PC 运营后台，使用 Vue 3 + TypeScript + Vite + Element Plus。
面向总部、CRM、ERP、订单、销售、BI、人事、城市运营和代理管理运营人员。

## 关键约定

1. **不实现业务逻辑**：只维护前端展示和用户输入。订单、库存、考勤等状态机由后端领域服务持有。
2. **API 层结构**：
   - `src/api/core/` — 手写调用、认证拦截、错误处理
   - `src/api/generated/` — OpenAPI 生成的代码（只读，不手工修改）
3. **路由权限**：路由守卫在 `src/router/index.ts`，权限过滤在 `src/stores/permission.ts`。
4. **认证**：使用 IAM OIDC Authorization Code + PKCE；Access/ID Token 只保存在页面内存，禁止写入 Web Storage。
5. **数据环境**：当前可在本机运行服务，但仍连接指定 DEV 真实接口和数据库；需要测试数据时在 DEV 数据库按规范构造，不维护运行时 Mock 分支。HTTP 仅允许开发模式下的 loopback 地址。
6. **指令**：`v-permission` 按权限标识控制元素可见性。
7. **设计 Token**：定义在 `src/assets/styles/variables.css`，覆盖 Element Plus 主题使用 SCSS 变量。

## 目录说明

```
src/
├── api/core/        - 手写 API 客户端
├── api/generated/   - OpenAPI 生成代码（请勿修改）
├── auth/            - OIDC PKCE、回调和内存 Token
├── stores/          - Pinia stores
├── router/          - Vue Router 配置 + 守卫
├── layouts/         - 页面布局
├── views/           - 页面视图
├── directives/      - 自定义指令
├── components/      - 公共组件
├── types/           - TS 类型定义
├── utils/           - 工具函数
└── assets/styles/   - 样式和设计 Token
```
