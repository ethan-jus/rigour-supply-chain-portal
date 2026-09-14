/** 局域网 HTTP 没有 SubtleCrypto；开发构建使用纯 JS 运算，仍校验真实 RS256 签名。 */
export function allowDevelopmentHttp(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'desktop'
}

function binary(value: Uint8Array): string {
  return Array.from(value, (byte) => String.fromCharCode(byte)).join('')
}

export async function sha256(value: string): Promise<Uint8Array> {
  if (crypto.subtle) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  }
  if (!allowDevelopmentHttp()) throw new Error('当前环境需要 HTTPS 才能安全登录')
  const { default: forge } = await import('node-forge')
  const digest = forge.md.sha256.create().update(value, 'utf8').digest().getBytes()
  return Uint8Array.from(digest, (char) => char.charCodeAt(0))
}

export async function verifyRs256(jwk: JsonWebKey, signature: Uint8Array, message: string): Promise<boolean> {
  if (crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    )
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(message))
  }
  if (!allowDevelopmentHttp()) throw new Error('当前环境需要 HTTPS 才能校验登录签名')
  if (!jwk.n || !jwk.e) return false
  const { default: forge } = await import('node-forge')
  const integer = (value: string) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return new forge.jsbn.BigInteger(forge.util.bytesToHex(forge.util.decode64(padded)), 16)
  }
  const key = forge.pki.rsa.setPublicKey(integer(jwk.n), integer(jwk.e))
  const digest = forge.md.sha256.create().update(message, 'utf8')
  try {
    return key.verify(digest.digest().getBytes(), binary(signature))
  } catch {
    return false
  }
}
