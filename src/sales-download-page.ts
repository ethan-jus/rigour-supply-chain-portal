import { loadReleases, platforms } from './utils/sales-downloads'

async function render() {
  const status = document.querySelector<HTMLParagraphElement>('#status')!
  const platform = platforms.find(
    ({ id }) => id === new URLSearchParams(location.search).get('platform'),
  )
  if (!platform) {
    status.textContent = '安装入口无效，请在系统中扫描对应平台的二维码。'
    return
  }
  try {
    const release = (await loadReleases(platform.id))[platform.id]
    if (!release) {
      status.textContent = platform.name + ' 版暂未开放'
      return
    }
    status.textContent = platform.name + ' · 版本 ' + release.version
    const link = document.querySelector<HTMLAnchorElement>('#download')!
    link.href = release.url
    link.hidden = false
    if (platform.id === 'ios' && link.protocol === 'itms-services:') {
      const help = document.querySelector<HTMLElement>('#help')!
      help.textContent = '请在已登记的测试 iPhone 上用 Safari 打开，点「下载安装」。'
      help.hidden = false
    }
    if (platform.id === 'harmony') {
      const help = document.querySelector<HTMLElement>('#help')!
      help.textContent = '请使用华为浏览器打开此页，点击「下载安装」。'
      help.hidden = false
    }
    if (platform.id === 'android') {
      link.download = ''
      document.querySelector<HTMLElement>('#help')!.hidden = false
    }
  } catch {
    status.textContent = '下载信息暂时无法加载，请刷新重试。'
  }
}
void render()
