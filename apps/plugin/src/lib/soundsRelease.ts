/*  Patch on Slur — which engine is the newest, and what each print needs.

    The wall (this page) is loaded from the web every time the plugin
    opens, so everyone always has the newest wall. The engine is what the
    installer put on their Mac, and only a new installer changes it. The
    plugin tells the page its engine's version (?ver=…); the page says
    when a newer one is out, and keeps a print off the shelf when the
    engine under it does not know that print yet.

    LATEST is written by Plugin/release.sh when a release is published —
    do not edit it by hand.                                            */

export const LATEST: { version: string; url: string } = { version: '1.0.14', url: 'https://github.com/JazzFusionPianist/BetterPlugin/releases/download/patch-on-slur-1.0.14/Patch-on-Slur-1.0.14.pkg' }

/** The engine version a print first appeared in (a print not listed has always been there). */
export const PRINT_SINCE: Record<number, string> = {
  28: '1.0.1', 29: '1.0.1',              // L/R, M/S
  30: '1.0.2', 31: '1.0.1', 32: '1.0.1', // LFO (its own clock since 1.0.2; before that it needed a rate), rate, macro
  33: '1.0.1', 34: '1.0.1',              // side, follow
  35: '1.0.7',                           // comp
  36: '1.0.8',                           // bands
  37: '1.0.10', 38: '1.0.10', 39: '1.0.10', // carve, match, vocode
  40: '1.0.11', 41: '1.0.11', 42: '1.0.11', 43: '1.0.11', 44: '1.0.11', 45: '1.0.11', 46: '1.0.11', // freeze, shift, smear, pan, repeat, env, fold
  47: '1.0.13', 48: '1.0.13',            // drift, pulse
  49: '1.0.14', 50: '1.0.15',            // scene, sieve (sieve missed the 1.0.14 build)
}

const parse = (v: string) => v.split('.').map(x => parseInt(x, 10) || 0)
export const older = (a: string, b: string) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) } return false }

/** The engine under this page: its version, or null in a plain browser (no engine at all). An engine too old to say counts as 0.0.0. */
export function engineVersion (): string | null {
  const q = new URLSearchParams(window.location.search)
  if (q.get('plugin') !== '1') return null
  return q.get('ver') ?? '0.0.0'
}
/** A newer engine is out than the one under this page. */
export const updateOut = () => { const v = engineVersion(); return v !== null && LATEST.url !== '' && older(v, LATEST.version) }
/** The lfo is its own clock (the rate's hands, a depth, random, true cliffs) from this engine on; older engines keep their lfo → rate patches as they are. */
export const lfoOwnClock = () => { const v = engineVersion(); return v === null || !older(v, '1.0.2') }
/** This engine knows this print. */
export const engineHas = (type: number) => { const v = engineVersion(), since = PRINT_SINCE[type]; return v === null || since === undefined || !older(v, since) }
