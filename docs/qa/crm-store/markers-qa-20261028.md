# 门店地图标记验收（2026-10-28）

公海使用蓝色门店图形，私海使用深青色人员图形；历史合作独立叠加绿色勾标。选中后使用归属原色填充、白色图形及外圈，不改变公私海或合作含义。地图左下显示图例，门店名称只通过 DOM 属性展示，不插入图标 HTML。

## 验证

- 本地真实 CRM 公海、商家库页面已显示新图标及图例；公海数据保持仅显示公海门店。
- 隔离预览地址：`http://localhost:5100/docs/qa/crm-store/preview.html?scenario=markers`。使用实际页面组件、实际高德底图及四条演示数据，不连接业务写入接口。
- 四种组合：公海未合作、私海未合作、公海已合作、私海已合作；点击私海已合作后居中定位，保留深青色和绿色勾标，信息卡同步显示私海、历史合作。显示全部位置后清除选中。
- 1440×900 和 390×844 浏览器视口检查通过，窄屏图例完整，页面无横向溢出。视口为本次检查样本，不是设计尺寸约束。
- `pnpm test:run tests/crm-store-interactions.test.ts tests/crm-store-map-loader.test.ts`：15 项通过，包含四种状态组合、选中状态及门店名称 HTML 注入防护。
- 本次组件与交互测试 ESLint 通过；`pnpm typecheck` 通过。

## 截图

- [四种组合](./markers-four-states.png)
- [标记局部](./markers-detail.png)
- [选中私海已合作](./markers-selected.png)
- [窄屏](./markers-mobile.png)
