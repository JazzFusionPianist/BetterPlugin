// a small driver for headless Chrome over the DevTools protocol: load the page, run checks, take pictures.
// The page is Daw/ui/index.html run in a browser: no app, so no engine, no plug-ins, no files on disk — only the room and its hands.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9300 + Math.floor(Math.random() * 500)
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* Chrome is given a throwaway profile, and a profile is some sixteen megabytes: it is taken away again when the browser
   goes (and at the next run, should a run have died before it could) — three hundred of them left lying once filled
   the disk. */
const sweep = () => {                                                                // what an earlier run left: a browser that outlived its test (the test died first), and its profile
  try { for (const n of readdirSync(tmpdir())) if (n.startsWith('dawtest-')) { const d = join(tmpdir(), n); try { if (Date.now() - statSync(d).mtimeMs > 20 * 60 * 1000) { try { execFileSync('pkill', ['-9', '-f', '--', `--user-data-dir=${d}`], { stdio: 'ignore' }) } catch (e) {} rmSync(d, { recursive: true, force: true }) } } catch (e) {} } } catch (e) {}
}
export async function open (file, { width = 1472, height = 924, dsf = 1, before = '' } = {}) {      // before: a script the page runs ahead of its own (a stand-in for the app, say)
  sweep()
  const profile = mkdtempSync(join(tmpdir(), 'dawtest-'))
  const chrome = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--disk-cache-size=1', '--disable-background-networking', '--disable-component-update', '--no-first-run', `--window-size=${width},${height}`, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' })
  const gone = () => { try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }) } catch (e) {} }
  chrome.on('exit', gone)
  const end = () => { try { chrome.kill('SIGKILL') } catch (e) {} gone() }                // however the test ends — done, thrown out of, or stopped from outside — its browser ends with it
  process.on('exit', end)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { end(); process.exit(1) })
  process.on('uncaughtException', e => { console.error(e); end(); process.exit(1) })
  process.on('unhandledRejection', e => { console.error(e); end(); process.exit(1) })
  let list
  for (let i = 0; i < 60; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break } catch (e) {} await sleep(150) }
  const page = list.find(t => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map(), errors = []
  ws.onmessage = m => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result) }
    else if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
    else if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) errors.push(d.params.type + ' ' + d.params.args.map(a => a.value ?? a.description).join(' '))
    else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text)
  }
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile: false })
  if (before) await send('Page.addScriptToEvaluateOnNewDocument', { source: before })
  await send('Page.navigate', { url: file.startsWith('/') ? 'file://' + encodeURI(file) : 'file://' + join(here, file) })
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result.value
  }
  for (let i = 0; i < 80; i++) { await sleep(150); try { if (await ev(`return document.documentElement.dataset.ready === '1'`)) break } catch (e) {} }
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); mkdirSync(join(here, 'out'), { recursive: true }); writeFileSync(join(here, 'out', name), Buffer.from(r.data, 'base64')); return name }
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
  const click = async (x, y, modifiers = 0) => { await mouse('mouseMoved', x, y, { buttons: 0, modifiers }); await mouse('mousePressed', x, y, { modifiers }); await mouse('mouseReleased', x, y, { modifiers }) }
  const dragTo = async (x0, y0, x1, y1, steps = 6, modifiers = 0) => { await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers }); await mouse('mousePressed', x0, y0, { modifiers }); for (let i = 1; i <= steps; i++) await mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, { modifiers }); await mouse('mouseReleased', x1, y1, { modifiers }) }
  const type = async (text) => { for (const ch of text) await send('Input.dispatchKeyEvent', { type: 'char', text: ch }) }
  const press = async (key, code, vk, modifiers = 0) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, modifiers }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers }) }
  const close = async () => {                                                        // the browser goes, and only then its profile (its helpers write into it until they are gone)
    try { ws.close() } catch (e) {}
    const left = new Promise(res => { chrome.once('exit', res); setTimeout(res, 3000) })
    chrome.kill()
    await left; await sleep(250); gone()
  }
  return { ev, shot, click, dragTo, type, press, send, errors, close, sleep }
}
export const PAGE = join(here, '..', 'ui', 'index.html')
export const DRAFT = join(here, '..', 'design', 'layout-draft-7.js')
