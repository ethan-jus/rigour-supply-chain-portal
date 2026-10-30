# 显示规范、行政区划与内置字体验收（2026-10-29）

## 实现

- 全局显示入口：顶部右侧「显示设置」。统一字体、正文/列表内容、表头、菜单、页面标题、列表行高；浏览器本地保存。默认思源黑体，14px 正文/表头/菜单、18px 标题、40px 行高。多行内容允许自然撑高。
- 内置并自行托管：Noto Sans SC、Noto Serif SC、MiSans、LXGW WenKai。字体 CSS/文件通过依赖打包，不使用外部 CDN。MiSans 使用标准映射的静态 400/600/700；文楷加载 500/700 原包字重。预览先实际加载中文及两个字重，失败时显示错误并阻止保存。
- 本机选项：系统默认、微软雅黑、黑体、楷体。后三项通过 FontFace local() 加载检测，不可用时标注并禁选，不能把回退字体冒充成功。内置字体不依赖本机安装。
- 字体许可证随 public/fonts/licenses 发布；MiSans 版权归小米科技有限责任公司，设置页展示使用说明与完整授权链接。Windows 字体未打包。
- 表格扫描清单见 list-audit.json，包含 92 个表格页面/组件；静态标题说明改为按需查看，保留业务异常、权限和风险信息。BI 深色表格保留自身配色。
- 行政区划地区目录支持七大区独立展开/折叠，分组背景及字重区别于缩进省份；名称、编码分别一列；省/地/县级使用蓝/青/紫标识。
- Excel 导出可选省级/地级/县级及当前范围/全国，遍历完整目录而非当前页；行政编码保留文本、冻结表头、自动筛选，附来源说明。

## 验证

- 早期扩大回归：69 项通过（expanded-tests.log）。最后字体/行政区划/字典专项：19 项通过（final-tests.log）；含缺失本机字体、两种新增内置字体、偏好保存和读取、导出超过一页的完整数据与工作簿重新读取。
- pnpm build（含 vue-tsc）通过：final-build.log。现有大 chunk 警告仍存在。
- 最后字体改动 ESLint 通过：final-lint.log；git diff --check 通过。
- 真实浏览器 localhost:5100，1366×768：行政区划目录/徽标/筛选；显示设置保存并刷新后字体角色字号和行高保持；用户列表与订单列表取样检查。
- 真实浏览器内置宋体、文楷、MiSans 均观察到中文形状变化；文楷及 MiSans 的 document.fonts.check 对正文 400 与表头 600 中文样本均为 true。本机三种 Windows 字体检测不可用且禁选。截图 builtin-font-options.png、font-preview-serif.png。
- Excel UI 成功生成文件及可重试下载链接；浏览器工具不支持 blob 下载，未取得实际浏览器下载后的文件。工作簿内容由序列化/重新读取测试验证，不将此记为真实下载端到端通过。
- 未重启后端、未修改业务数据、未提交或推送代码。

## 字体来源

- https://fontsource.org/fonts/noto-sans-sc
- https://fontsource.org/fonts/noto-serif-sc
- https://github.com/lxgw/LxgwWenKai
- https://github.com/dsrkafuu/misans
- https://hyperos.mi.com/font/
- https://learn.microsoft.com/en-us/typography/fonts/font-faq
