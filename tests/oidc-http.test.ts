import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { sha256, verifyRs256 } from '@/auth/oidc-crypto'
import { isAllowedOidcUrl } from '@/auth/oidc'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('台式机 HTTP 开发登录', () => {
  it('desktop 构建允许 HTTP，正式构建不放宽', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'desktop')
    expect(isAllowedOidcUrl('http://192.168.12.7:5100')).toBe(true)
    expect(isAllowedOidcUrl('http://user:pass@192.168.12.7')).toBe(false)
    vi.stubEnv('MODE', 'production')
    expect(isAllowedOidcUrl('http://192.168.12.7:5100')).toBe(false)
    expect(isAllowedOidcUrl('https://scdp.example')).toBe(true)
  })

  it('没有 SubtleCrypto 时仍生成标准 SHA256 并拒绝伪造 RSA 签名', async () => {
    vi.stubEnv('MODE', 'desktop')
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(Array.from(await sha256('abc'), (byte) => byte.toString(16).padStart(2, '0')).join(''))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const jwk = publicKey.export({ format: 'jwk' })
    const signature = new Uint8Array(sign('RSA-SHA256', Buffer.from('header.payload'), privateKey))
    await expect(verifyRs256(jwk, signature, 'header.payload')).resolves.toBe(true)
    await expect(verifyRs256(jwk, signature, 'header.changed')).resolves.toBe(false)
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    await expect(sha256('abc')).rejects.toThrow('HTTPS')
  })
})
