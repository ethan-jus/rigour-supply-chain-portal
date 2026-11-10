;(() => {
  const credential = new URLSearchParams(window.location.search).get('code') || ''
  window.history.replaceState(null, '', window.location.pathname)
  const input = document.getElementById('credential')
  const status = document.getElementById('status')
  if (!credential || credential.length > 2000) {
    status.textContent = '未收到有效授权码，请回到原系统重新发起授权。'
    document.getElementById('copy').disabled = true
    return
  }
  input.value = credential
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: 'rigour-huolala-authorized', credential },
      window.location.origin,
    )
    status.textContent = '授权码已返回原系统，请在原页面核对授权结果。'
  } else status.textContent = '请回到原系统的授权窗口完成授权。'
  document.getElementById('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(credential)
      status.textContent = '已复制，请返回原系统填写。'
    } catch {
      input.type = 'text'
      input.select()
      status.textContent = '请手动复制临时授权码。'
    }
  })
})()
