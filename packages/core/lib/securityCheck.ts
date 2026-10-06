export const SECURITY_CHECK_URL = 'https://better-plugin.vercel.app/security-check.html'

export function needsHostedSecurityCheck(protocol: string, capacitorNative: boolean): boolean {
  return capacitorNative || (protocol !== 'http:' && protocol !== 'https:')
}
