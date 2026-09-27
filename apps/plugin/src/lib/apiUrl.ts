/** Bundled JUCE pages have a local resource origin, not a server with /api routes. */
export function resolveApiUrl(path: string, pageUrl: string): string {
  if (!path.startsWith('/api/') || path.includes('\\')) throw new Error('Invalid API route.')
  const page = new URL(pageUrl)
  const carried = !['http:', 'https:'].includes(page.protocol) || page.hostname === 'juce.backend'
  return carried ? new URL(path, 'https://better-plugin.vercel.app').href : path
}
export const apiUrl = (path: string) => resolveApiUrl(path, window.location.href)
