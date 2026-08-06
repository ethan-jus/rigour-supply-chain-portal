import { describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { launchApplication } from '@/utils/safe-launch'
import type { PortalApplication } from '@/types/application'

function feishuApplication(targetUri: string): PortalApplication {
  return {
    id: 'feishu-sales', code: 'FEISHU_SALES', name: '飞书销售工作台', iconKey: 'app-feishu-sales',
    launchMode: 'FEISHU_DEEPLINK', targetUri, sortOrder: 50,
  }
}

describe('飞书销售工作台应用卡片', () => {
  it('门户卡片进入独立飞书H5受控启动页', async () => {
    const currentRoute = { value: { path: '/apps' } }
    const push = vi.fn(async (path: string) => { currentRoute.value.path = path })
    const router = { push, currentRoute } as unknown as Router

    await launchApplication(feishuApplication('/sales-workbench'), router)

    expect(push).toHaveBeenCalledWith('/sales-workbench')
    expect(currentRoute.value.path).toBe('/sales-workbench')
  })

  it('拒绝飞书卡片复用供应链销售管理后台', async () => {
    const router = { push: vi.fn(), currentRoute: { value: { path: '/apps' } } } as unknown as Router
    await expect(launchApplication(feishuApplication('/supply-chain/sales'), router))
      .rejects.toThrow('飞书应用引导页未注册')
  })
})
