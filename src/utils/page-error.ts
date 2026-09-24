/** 事件或异步请求失败不能销毁当前页面；只让渲染/初始化异常进入页面兜底。 */
export function isPageRenderFailure(info: string): boolean {
  return ['render function', 'setup function', 'async component loader'].includes(info)
    || /#runtime-(0|1|13)$/.test(info)
}
