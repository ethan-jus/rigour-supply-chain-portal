# 高德现有配置核验 · 2026-10-28

最新结论（2026-10-28 11时）：用户已配置后台前端JS Key及安全码，刷新后真实底图与落点通过；同时发现并修正`setZIndex`应为`setzIndex`的SDK调用错误。列表定位、图钉切换、详情联动及切回列表均通过。完整证据见[真实地图复验](map-live-qa-20261028.md)。验证范围为实际页面组件+演示门店，不等同正式CRM数据联调或生产部署。

以下为**配置更新前的历史排查记录**，旧Key和连接状态不再作为当前结论，也无需继续向用户追问Key。

| 检查对象 | 当前证据 |
| --- | --- |
| CRM后台与销售工作台本地 `.env.local` | 两者JS Key指纹一致；后台配置安全码，工作台安全码为空 |
| 正在运行的5100页面 | 实际注入的JS Key与上述本地文件一致，排除页面读取另一把Key或环境变量覆盖 |
| 对实际注入Key的官方请求 | HTTP200，但业务响应status=0、info=USER_KEY_RECYCLED、infocode=10013；没有返回地图SDK |
| 现有本地销售移动端/后台打包产物 | 仍包含同一把旧JS Key，并未发现新Key |
| 当前生产后台2026端口 | 当前SalesTrackComparison构建未注入JS Key，加载分支提示“未配置高德地图Key” |
| 销售拜访选店源码 | 走后端POI/逆地理接口；后端配置项为RIGOUR_AMAP_WEB_KEY，浏览器不接收此凭据 |
| 生产只读连接 | 现有SSH连接认证拒绝；未能核实服务器后端凭据的当前有效性 |
| 本地集成服务与共享DEV配置 | 26882健康检查UP；当前代码、数据库配置表及其Nacos命名空间未发现高德专用配置。此结果仅覆盖当前DEV环境 |
| 用户补充指向销售工作台服务配置后 | `sales-server/src/main/resources/application.yml:40-42`为`rigour.amap.web-key: ${RIGOUR_AMAP_WEB_KEY:}`；本地dev/local/prod配置及编译资源未提供实际值 |
| 本地销售服务运行配置 | 26886无监听，未发现SalesApplication进程；当前Shell与保存的IDEA运行配置未发现RIGOUR_AMAP_WEB_KEY实际值。不能据此推断生产未配置 |
| 用户再次确认RIGOUR_AMAP_WEB_KEY变量后 | 配置项与销售源码完全一致；进一步检查当前IDEA进程环境、当前Shell及launchctl环境，均未发现该变量；销售服务仍未启动。未取得后端Key，未验证其有效性 |

没有读取、转存或输出服务器runtime.env，没有把服务端凭据复制到前端。没有更换任何本地Key，也没有重启用户的应用服务。

## 本次代码调整

- `src/utils/amap-js-api.ts`：统一读取现有VITE_AMAP_JS_KEY和VITE_AMAP_SECURITY_CODE，复用同一个SDK加载Promise，等待高德异步回调完成。
- CRM门店地图与后台销售轨迹均调用这个入口；销售敏感轨迹权限检查仍在加载前执行。
- 删除销售轨迹页面中的重复脚本加载和局部Promise。
- `.env.example`说明两个页面共用浏览器配置，不能填写后端Web服务Key。
- 失效Key显示明确提示；服务原始响应及凭据不会进入页面错误信息。

## 验证

- 18项定向测试通过：共享单次加载、后端Key不进脚本URL、SDK回调时序、地图交互、坐标处理、原销售敏感权限。
- 类型检查、定向ESLint与生产构建通过。构建仍有既有依赖注释和大包提示。
- 新建浏览器页面排除旧页面缓存，点击定位进入地图；实际出现失效Key提示，切回列表正常。证据：[map-config-20261028.png](map-config-20261028.png)。
- 地图缩放、中心点和标记的自动测试使用模拟SDK；不代替真实底图成功的证据。

## 下一步所需信息

用户进一步说明配置位于销售工作台服务。已沿该服务核对配置引用与使用链：`AmapProperties` → `RestAmapPoiClient`附近/城市门店查询及`AmapTemporaryCheckinReverseGeocoder`逆地理解析，均为服务端REST调用；不是浏览器JS SDK加载入口。

已请求明确实际值位于生产销售服务、IDEA运行项还是其他本地配置文件，只需要环境或路径，不要求在聊天中发送密钥。获知位置后先核验平台类型及对应安全码；如果只有Web服务配置，仍需现有有效Web端(JS API)配置才能完成内嵌地图验收，不能直接把服务端Key放进前端。

用户确认的变量名称和base-url解释了后端接口配置，但不提供有效的浏览器JS API配置。后续应直接核对原高德应用中的Web端(JS API) Key及配套安全码，避免继续把服务端变量名称当作浏览器鉴权问题的解决结果。真实地图验收仍未完成。

官方类型说明：[Key应该绑定哪种服务](https://developer.amap.com/faq/quota-key/key/39680)；[JS API准备](https://lbs.amap.com/api/javascript-api-v2/prerequisites)；[10013状态说明](https://lbs.amap.com/api/web-service/tools/info)。

历史排查结果：旧Key blocked；当前本地地图组件 passed，正式业务联调待完成。
