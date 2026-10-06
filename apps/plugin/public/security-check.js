(() => {
  const nonce = location.hash.slice(1)
  if (!/^[a-f0-9-]{36}$/i.test(nonce) || parent === window) return
  let port
  const report = (type, token) => port?.postMessage({ type, nonce, ...(token ? { token } : {}) })
  const connect = event => {
    if (event.source !== parent || !['null', 'juce://juce.backend', 'https://juce.backend',
      'capacitor://localhost', 'http://localhost', 'https://localhost'].includes(event.origin)
      || event.data?.type !== 'slur-security-check' || event.data.nonce !== nonce || !event.ports[0] || port) return
    port = event.ports[0]
    window.removeEventListener('message', connect)
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.onerror = () => report('error')
    script.onload = () => {
      try {
        window.turnstile.render('#challenge', {
          sitekey: '0x4AAAAAAFFgtGyuOo0oeU2k', action: 'authentication', theme: 'light', size: 'normal',
          callback: token => report('token', token),
          'expired-callback': () => report('expired'),
          'timeout-callback': () => report('expired'),
          'error-callback': code => { report('error'); console.warn('Slur security check failed:', code) },
        })
        report('ready')
      } catch { report('error') }
    }
    document.head.appendChild(script)
  }
  window.addEventListener('message', connect)
})()
