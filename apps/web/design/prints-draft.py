#!/usr/bin/env python3
"""A draft sheet: every print of Patch on Slur redrawn in the web's diagram language —
its family's flat plate in a house tint, the print's picture inside in paper ink, a round lamp
behind it that grows with the knob. Writes prints-draft.html (+ prints-draft.json for Figma)."""
import json, math, os

PAPER = '#FBFAF7'
INK_BG = '#141311'
FONT = "'Instrument Sans', 'Inter', sans-serif"

# family shapes, unit space (the web's PatchDiagram, plus grit from the plug-in's struck corners)
SHAPE = {
    'tone': 'M -1 -1 H 1 V 1 H -1 Z',
    'grit': 'M -1 -1 H .38 L 1 -.38 V 1 H -.38 L -1 .38 Z',
    'space': 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z',
    'motion': 'M -.6 -1 H 1.25 L .6 1 H -1.25 Z',
    'pitch': 'M 0 -1.2 L 1.2 0 L 0 1.2 L -1.2 0 Z',
    'utility': 'M -1 -.12 H 1 V .12 H -1 Z M -.12 -1 H .12 V 1 H -.12 Z',
    'control': 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z M -.5 0 A .5 .5 0 1 1 .5 0 A .5 .5 0 1 1 -.5 0 Z',
    'spectral': 'M -1 -1 H -.66 V 1 H -1 Z M -.4 -.5 H -.06 V 1 H -.4 Z M .2 -1 H .54 V 1 H .2 Z M .8 -.2 H 1.14 V 1 H .8 Z',
}
REACH = {'tone': 1, 'grit': 1, 'space': 1, 'motion': 1.25, 'pitch': 1.2, 'utility': 1, 'control': 1, 'spectral': 1.14}

def poly(pts, close=False):
    d = ' '.join(f"{'M' if i == 0 else 'L'} {x:.3f} {y:.3f}" for i, (x, y) in enumerate(pts))
    return d + (' Z' if close else '')

def wave(x0, x1, y, amp, cycles, n=64, phase=0.0, env=None):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        a = amp * (env(t) if env else 1)
        pts.append((x, y + a * math.sin(phase + t * cycles * 2 * math.pi)))
    return poly(pts)

def P(d, w=.09, op=.95, dash=None, cap='round'):
    da = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<path d="{d}" fill="none" stroke="{PAPER}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="{cap}" stroke-linejoin="round"{da}/>'

def F(d, op=.95):
    return f'<path d="{d}" fill="{PAPER}" fill-opacity="{op}"/>'

def C(cx, cy, r, fill=True, op=.95, w=.09):
    return (f'<circle cx="{cx:.3f}" cy="{cy:.3f}" r="{r:.3f}" fill="{PAPER}" fill-opacity="{op}"/>' if fill
            else f'<circle cx="{cx:.3f}" cy="{cy:.3f}" r="{r:.3f}" fill="none" stroke="{PAPER}" stroke-opacity="{op}" stroke-width="{w}"/>')

def T(x, y, s, size=.5, w='500', op=.95):
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{FONT}" font-weight="{w}" font-size="{size}" fill="{PAPER}" fill-opacity="{op}">{s}</text>'

# ── the pictures, one per print, in the plate's unit space (the plate spans −1..1) ──
def g_tone():   return ''.join(P(f'M -.62 {y:.2f} H .62', w=.07) for y in [-.6 + i * .15 for i in range(9)])
def g_cut():    return P('M -.7 -.1 H .05 C .25 -.1 .3 .1 .35 .3 C .4 .5 .5 .7 .7 .75', w=.1)
def g_amp():    return P(poly([(-.7, .45), (-.45, .45), (-.35, -.45), (-.05, -.45), (.05, .45), (.35, .45), (.45, -.45), (.7, -.45)]), w=.1)
def g_tape():   return C(-.35, -.05, .3, False) + C(.35, -.05, .3, False) + C(-.35, -.05, .07) + C(.35, -.05, .07) + P('M -.62 .45 Q 0 .62 .62 .45', w=.08)
def g_glue():   return P(wave(-.7, .7, 0, .55, 2, env=lambda t: 1 - .55 * t), w=.09) + P('M .2 -.3 H .72 M .2 .3 H .72', w=.06, op=.55)
def g_comp():   return P('M -.65 .65 L .0 .0 C .15 -.15 .35 -.22 .68 -.28', w=.1) + P('M -.65 .65 L .68 -.68', w=.05, op=.35, dash='.08 .1')
def g_air():    return P(wave(-.7, .7, .15, .18, 1.2), w=.08) + ''.join(P(f'M {x:.2f} -.35 V -.6', w=.06) for x in [-.5, -.25, 0, .25, .5]) + ''.join(C(x, -.7, .04) for x in [-.5, -.25, 0, .25, .5])
def g_crush():
    pts = []
    for i in range(17):
        t = i / 16; x = -.7 + 1.4 * t; v = round(math.sin(t * 2 * math.pi) * 3) / 3 * .5
        pts.append((x, v)); pts.append((-.7 + 1.4 * (i + 1) / 16, v))
    return P(poly(pts[:-1]), w=.09, cap='butt')
def g_radio():  return P('M -.7 .5 H -.3 C -.15 .5 -.1 -.55 0 -.55 C .1 -.55 .15 .5 .3 .5 H .7', w=.1) + P('M -.7 .5 H .7', w=.05, op=.4, dash='.06 .08')
def g_ring():   return P(wave(-.7, .7, 0, .55, 5, env=lambda t: math.sin(t * math.pi * 2)), w=.08) + P(wave(-.7, .7, 0, .55, 1, phase=0), w=.05, op=.4, dash='.06 .08')
def g_fold():
    pts = []
    for i in range(65):
        t = i / 64; x = -.7 + 1.4 * t; s = math.sin(t * 2 * math.pi) * 2.2
        tt = s * .5 + .25; f = tt - math.floor(tt); y = (f * 4 - 1) if f < .5 else (3 - f * 4)
        pts.append((x, -y * .5))
    return P(poly(pts), w=.09) + P('M -.7 -.5 H .7 M -.7 .5 H .7', w=.04, op=.35, dash='.06 .08')
def g_delay():  return ''.join(f'<rect x="{-.55 + i * .17:.2f}" y="{-.35 + i * .045:.2f}" width=".07" height="{.7 - i * .09:.2f}" fill="{PAPER}" fill-opacity="{1 - i * .12:.2f}"/>' for i in range(7))
def g_space():  return ''.join(C(0, 0, .12 + i * .16, False, op=1 - i * .18, w=.07) for i in range(4)) + C(0, 0, .06)
def g_shimmer(): return ''.join(C(0, .1, .12 + i * .16, False, op=1 - i * .2, w=.06) for i in range(3)) + ''.join(P(f'M {x:.2f} -.15 V -.6 M {x - .1:.2f} -.5 L {x:.2f} -.62 L {x + .1:.2f} -.5', w=.06) for x in [-.3, .3])
def g_doubler(): return P(wave(-.7, .7, -.08, .28, 2), w=.08) + P(wave(-.7, .7, .12, .28, 2, phase=.9), w=.08, op=.55)
def g_stereo(): return C(0, 0, .09) + P('M -.15 0 H -.7 M -.55 -.15 L -.7 0 L -.55 .15 M .15 0 H .7 M .55 -.15 L .7 0 L .55 .15', w=.08)
def g_mod():    return ''.join(P(wave(-.65, .65, -.45 + i * .18, .05, 3, phase=i), w=.06) for i in range(6))
def g_tremolo(): return P(wave(-.7, .7, 0, .5, 7, env=lambda t: abs(math.sin(t * math.pi * 2))), w=.07)
def g_swell():  return P('M -.7 .55 C -.2 .55 .1 .3 .35 -.35 C .45 -.55 .55 -.6 .7 -.6', w=.1) + P('M -.7 .55 H .7', w=.04, op=.35)
def g_stutter(): return ''.join(f'<rect x="{-.68 + g * .48 + k * .1:.2f}" y="{-.4 + k * .1:.2f}" width=".06" height="{.8 - k * .2:.2f}" fill="{PAPER}" fill-opacity="{1 - g * .28:.2f}"/>' for g in range(3) for k in range(3))
def g_gate():   return P('M -.7 .35 H -.3', w=.08) + P(wave(-.3, .3, 0, .45, 2.5), w=.08) + P('M .3 .35 H .7', w=.08) + P('M -.3 -.55 V .55 M .3 -.55 V .55', w=.05, op=.45, dash='.06 .06')
def g_wow():    return P(wave(-.7, .7, 0, .22, .9, phase=.6), w=.1)
def g_repeat(): return ''.join(f'<rect x="{-.66 + g * .46 + k * .085:.2f}" y="{-.45 + [0, .25, .12, .35][k]:.2f}" width=".05" height="{.9 - [0, .5, .24, .7][k]:.2f}" fill="{PAPER}" fill-opacity="{[1, .65, .45][g]}"/>' for g in range(3) for k in range(4)) + P('M -.68 -.62 V .62', w=.04, op=.5, dash='.05 .06')
def g_pitch():
    pts = []
    for i in range(81):
        t = i / 80; x = -.7 + 1.4 * t; ph = 2 * math.pi * (1.2 * t + 2.2 * t * t)
        pts.append((x, .35 * math.sin(ph) * (1 - .3 * t)))
    return P(poly(pts), w=.08)
def g_formant(): return P('M -.7 .5 C -.55 .5 -.5 -.45 -.32 -.45 C -.14 -.45 -.1 .25 0 .25 C .1 .25 .12 -.2 .28 -.2 C .44 -.2 .5 .5 .7 .5', w=.09)
def g_harmony(): return P(wave(-.7, .7, .22, .22, 2), w=.08) + P(wave(-.7, .7, -.25, .22, 3, phase=.5), w=.08, op=.6)
def g_arp():    return ''.join(C(-.6 + i * .3, .45 - i * .22, .07) for i in range(5)) + P('M -.6 .45 L .6 -.43', w=.04, op=.35, dash='.05 .07')
def g_grain():  return ''.join(P(f'M {x:.2f} {y:.2f} h .12', w=.07, op=op) for x, y, op in [(-.6, -.4, .9), (-.35, .1, .7), (-.1, -.55, .8), (.15, .3, .6), (.4, -.2, .9), (-.5, .45, .5), (.5, .5, .7), (.05, -.1, .5), (-.25, -.15, .6), (.3, .05, .8), (.55, -.5, .5)])
def g_gain():   return P('M 0 -.7 V .7', w=.07, op=.5) + f'<rect x="-.22" y="-.15" width=".44" height=".3" rx=".03" fill="{PAPER}"/>'
def g_mix():    return ''
def g_lr():     return T(-.48, .16, 'L', .42, '600') + T(.5, .16, 'R', .42, '600')
def g_ms():     return T(-.48, .16, 'M', .42, '600') + T(.5, .16, 'S', .42, '600')
def g_pan():    return C(.3, 0, .11)
def g_bands():  return ''.join(P(f'M {x:.2f} -.28 V .28', w=.07) for x in [-.45, 0, .45])
def g_side():   return P('M -.5 -.45 L .45 0 L -.5 .45', w=.09)
def g_lfo():    return P(wave(-.72, .72, 0, .32, 1), w=.09)
def g_macro():  return T(0, .17, '1', .55, '500')
def g_follow(): return P('M -.7 .5 L -.35 -.45 C -.15 .1 .15 .4 .7 .5', w=.09) + ''.join(f'<rect x="{-.6 + i * .16:.2f}" y="{.5 - h:.2f}" width=".08" height="{h:.2f}" fill="{PAPER}" fill-opacity=".2"/>' for i, h in enumerate([.5, .8, .6, .35, .2, .12, .08]))
def g_env():    return P('M -.7 .5 L -.4 -.5 L -.15 -.05 H .3 L .7 .5', w=.09) + F('M -.7 .5 L -.4 -.5 L -.15 -.05 H .3 L .7 .5 Z', .15)
def g_drift():
    pts = [(-.7 + 1.4 * i / 40, .35 * math.sin(i * .55) * math.cos(i * .21 + 1) + .12 * math.sin(i * 1.7)) for i in range(41)]
    return P(poly(pts), w=.09)
def g_pulse():  return ''.join(C(.55 * math.cos(-math.pi / 2 + k / 8 * 2 * math.pi), .55 * math.sin(-math.pi / 2 + k / 8 * 2 * math.pi), .1 if k in (0, 3, 6) else .045, True, .95 if k in (0, 3, 6) else .5) for k in range(8))
def g_scene():  return P('M -.55 0 H .55', w=.06, op=.5) + C(-.55, 0, .1) + C(.55, 0, .1) + C(-.15, 0, .13) + T(-.55, .5, 'A', .32) + T(.55, .5, 'B', .32)
def g_carve():  return P('M -.9 .1 C -.6 .1 -.5 -.5 -.25 -.5 C 0 -.5 .05 .3 .3 .3 C .55 .3 .6 -.3 .95 -.3', w=.1)
def g_match():  return P('M -.9 .2 C -.5 .2 -.4 -.45 0 -.45 C .4 -.45 .5 .25 .95 .25', w=.1) + P('M -.9 .3 C -.5 .3 -.4 -.2 0 -.2 C .4 -.2 .5 .4 .95 .4', w=.06, op=.5, dash='.06 .08')
def g_vocode(): return ''
def g_freeze(): return P('M -.9 0 H .95', w=.1) + ''.join(P(f'M {x:.2f} -.28 V .28', w=.06, op=.7) for x in [-.55, -.15, .3, .7])
def g_shift():  return P('M -.85 -.55 H .75 M .5 -.8 L .8 -.55 L .5 -.3', w=.1)
def g_smear():  return ''.join(C(x, y, r, True, op) for x, y, r, op in [(-.7, .2, .13, .8), (-.35, -.25, .16, .6), (.05, .35, .12, .7), (.4, -.4, .18, .5), (.8, .1, .12, .65)])
def g_sieve():  return ''.join(P(f'M {x:.2f} .9 V {y:.2f}', w=.16 if k in (1, 3) else .06, op=1 if k in (1, 3) else .35) for k, (x, y) in enumerate([(-.83, .2), (-.23, -.85), (.37, .1), (.97, -.55)]))


# ── plates that are the picture: spectral (bars arranged per print) and utility (a fitting in the tint, no plate) ──
def bars(col, specs, w=.34, op=1.0):
    return ''.join(f'<rect x="{x:.3f}" y="{top:.3f}" width="{w:.3f}" height="{1 - top:.3f}" fill="{col}" fill-opacity="{o if o is not None else op:.2f}"/>' for x, top, o in [(sp[0], sp[1], sp[2] if len(sp) > 2 else None) for sp in specs])
def pl_carve(col):   # a bite out of the middle
    return bars(col, [(-1.15, -1), (-.75, -.72), (-.35, .18), (.05, .3), (.45, -.62), (.85, -.95)], w=.28)
def pl_match(col):   # the sound's bars, and the key's shape over them as a paper outline
    b = bars(col, [(-1.1, -.3), (-.5, -.95), (.1, -.1), (.7, -.6)], w=.4)
    ghost = ''.join(f'<rect x="{x:.2f}" y="{t:.2f}" width=".4" height="{1 - t:.2f}" fill="none" stroke="{PAPER}" stroke-opacity=".75" stroke-width=".07"/>' for x, t in [(-1.1, -.95), (-.5, -.3), (.1, -.6), (.7, -.1)])
    return b + ghost
def pl_vocode(col):  # two spectra interleaved: the carrier's wide bars, the key's thin ones
    b = bars(col, [(-1.15, -.55), (-.45, -1), (.25, -.25), (.95, -.75)], w=.34)
    k = ''.join(f'<rect x="{x:.2f}" y="{t:.2f}" width=".12" height="{1 - t:.2f}" fill="{PAPER}" fill-opacity=".85"/>' for x, t in [(-.72, -.2), (-.02, -.7), (.68, -.45)])
    return b + k
def pl_freeze(col):  # every bar held at one height, a line across the tops
    return bars(col, [(-1.15, -.55), (-.7, -.55), (-.25, -.55), (.2, -.55), (.65, -.55)], w=.3) + f'<path d="M -1.25 -.72 H 1.05" stroke="{PAPER}" stroke-width=".09" stroke-linecap="round"/>'
def pl_shift(col):   # the bars stepping up to the right, an arrow where they go
    return bars(col, [(-1.15, .25), (-.65, -.15), (-.15, -.55), (.35, -.95)], w=.36) + f'<path d="M .55 -.35 H 1.15 M .95 -.55 L 1.15 -.35 L .95 -.15" fill="none" stroke="{PAPER}" stroke-width=".09" stroke-linecap="round" stroke-linejoin="round"/>'
def pl_smear(col):   # each bar trailing off to the right
    out = ''
    for x, t in [(-1.15, -.5), (-.5, -.95), (.15, -.3)]:
        for k, o in enumerate([1, .5, .25, .12]):
            out += f'<rect x="{x + k * .17:.2f}" y="{t + k * .12:.2f}" width=".34" height="{1 - t - k * .12:.2f}" fill="{col}" fill-opacity="{o}"/>'
    return out
def pl_sieve(col):   # many thin bars, two of them kept
    specs = []
    for k in range(9):
        x = -1.2 + k * .29
        if k == 2: specs.append((x, -.95, 1.0))
        elif k == 6: specs.append((x, -.7, 1.0))
        else: specs.append((x, .25 + (k % 3) * .15, .3))
    return bars(col, specs, w=.14)
def fit(col, d, w=.16, extra=''):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>' + extra
def pl_gain(col):    return fit(col, 'M 0 -1.05 V 1.05', w=.1) + f'<rect x="-.5" y="-.16" width="1" height=".32" rx=".04" fill="{col}"/>'
def pl_mix(col):     return fit(col, 'M -1.05 -.6 C -.3 -.6 -.35 0 0 0 M -1.05 .6 C -.3 .6 -.35 0 0 0 M 0 0 H 1.05') + f'<circle r=".2" fill="{col}"/>'
def pl_lr(col):      return fit(col, 'M -1.05 0 H 0 M 0 0 C .35 0 .3 -.6 1.05 -.6 M 0 0 C .35 0 .3 .6 1.05 .6') + f'<circle cx="1.05" cy="-.6" r=".2" fill="{col}"/><circle cx="1.05" cy=".6" r=".2" fill="none" stroke="{col}" stroke-width=".12"/>'
def pl_ms(col):      return f'<circle r=".8" fill="none" stroke="{col}" stroke-width=".16"/><circle r=".32" fill="{col}"/>'
def pl_pan(col):     return fit(col, 'M -1.05 0 H 1.05 M -1.05 -.3 V .3 M 1.05 -.3 V .3', w=.12) + f'<circle cx=".42" r=".24" fill="{col}"/>'
def pl_bands(col):   return fit(col, 'M -1.05 0 H 1.05 M -.35 -.55 V .55 M .35 -.55 V .55', w=.14)
def pl_side(col):    return f'<circle cx=".3" r=".58" fill="none" stroke="{col}" stroke-width=".14"/>' + fit(col, 'M -1.15 0 H -.28 M -.55 -.28 L -.28 0 L -.55 .28', w=.14)
PLATE = {'carve': pl_carve, 'match': pl_match, 'vocode': pl_vocode, 'freeze': pl_freeze, 'shift': pl_shift, 'smear': pl_smear, 'sieve': pl_sieve,
         'gain': pl_gain, 'mix': pl_mix, 'L/R': pl_lr, 'M/S': pl_ms, 'pan': pl_pan, 'bands': pl_bands, 'side': pl_side}

PRINTS = [
    # family, name, colour, glyph, caption value
    ('tone', 'cut', '#E9C46A', g_cut, 'low pass 2.4k'),
    ('tone', 'amp', '#C95C3A', g_amp, 'crunch 40'),
    ('tone', 'tone', '#F0B450', g_tone, '+24'),
    ('tone', 'tape', '#D27A45', g_tape, 'hard 55'),
    ('tone', 'glue', '#6FB07A', g_glue, '30'),
    ('tone', 'comp', '#3FB872', g_comp, '-25 dB'),
    ('tone', 'air', '#B8B4AA', g_air, 'silk 50'),
    ('grit', 'crush', '#9C7A5C', g_crush, 'bits 60'),
    ('grit', 'radio', '#B38F62', g_radio, 'phone 45'),
    ('grit', 'ring', '#D9A441', g_ring, '320 hz'),
    ('grit', 'fold', '#E06A48', g_fold, 'sine 40'),
    ('space', 'delay', '#4AA3A0', g_delay, 'pingpong 1/8'),
    ('space', 'space', '#5C80FF', g_space, 'hall 62'),
    ('space', 'shimmer', '#8FA8FF', g_shimmer, 'octave 35'),
    ('space', 'doubler', '#6C9AC8', g_doubler, 'wide 50'),
    ('space', 'stereo', '#7FB3C8', g_stereo, '+40'),
    ('motion', 'mod', '#A7B04A', g_mod, 'phaser 45'),
    ('motion', 'tremolo', '#C2547A', g_tremolo, 'sine 1/8'),
    ('motion', 'swell', '#B48ACF', g_swell, '120 ms'),
    ('motion', 'stutter', '#C97B5C', g_stutter, '1/16'),
    ('motion', 'gate', '#8C9E6C', g_gate, '-30 dB'),
    ('motion', 'wow', '#C8A05C', g_wow, 'flutter 30'),
    ('motion', 'repeat', '#E0A050', g_repeat, '1/16'),
    ('pitch', 'pitch', '#5C80FF', g_pitch, '+7 st'),
    ('pitch', 'formant', '#F27BA6', g_formant, '-4 st'),
    ('pitch', 'harmony', '#B79CFF', g_harmony, 'C major 3rd'),
    ('pitch', 'arp', '#3FB872', g_arp, 'up 12'),
    ('pitch', 'grain', '#E9C46A', g_grain, 'cloud 120 ms'),
    ('utility', 'gain', '#FBFAF7', g_gain, '-6 dB'),
    ('utility', 'mix', '#ECE2C8', g_mix, 'blend'),
    ('utility', 'L/R', '#FBFAF7', g_lr, ''),
    ('utility', 'M/S', '#FBFAF7', g_ms, ''),
    ('utility', 'pan', '#E6E2F0', g_pan, 'R 30'),
    ('utility', 'bands', '#ECD654', g_bands, '3 bands'),
    ('utility', 'side', '#5CE0A8', g_side, ''),
    ('control', 'LFO', '#B79CFF', g_lfo, 'sine 1/4'),
    ('control', 'macro', '#F27B5A', g_macro, '60'),
    ('control', 'follow', '#FFD660', g_follow, 'envelope'),
    ('control', 'env', '#FFAC78', g_env, 'level'),
    ('control', 'drift', '#AAC8FF', g_drift, '1/1'),
    ('control', 'pulse', '#FF8C8C', g_pulse, '3 of 8'),
    ('control', 'scene', '#F6E296', g_scene, 'A'),
    ('spectral', 'carve', '#E0607E', g_carve, '-12 dB'),
    ('spectral', 'match', '#78D8FF', g_match, 'learn'),
    ('spectral', 'vocode', '#A58BF0', g_vocode, '55'),
    ('spectral', 'freeze', '#96E8FF', g_freeze, 'held'),
    ('spectral', 'shift', '#FF96D2', g_shift, '+200 hz'),
    ('spectral', 'smear', '#BAC4FF', g_smear, '800 ms'),
    ('spectral', 'sieve', '#FFD078', g_sieve, '8 partials'),
]

def hexrgb(h):
    h = h.lstrip('#'); return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)

def print_svg(fam, name, col, glyph, R, lamp=.28, art_scale=None, glow_r=3.2):
    """One print at the origin: lamp, plate, picture. `lamp` is the lamp's peak opacity (the knob)."""
    r, g, b = hexrgb(col)
    uid = f"l-{name.replace('/', '')}-{int(lamp * 100)}"
    reach = REACH[fam]
    ink_scale = art_scale if art_scale is not None else (.62 if fam in ('spectral',) else .78 if fam == 'control' else 1)
    art = glyph()
    if fam == 'utility' and art:
        art_scale_u = .75
        art = f'<g transform="scale({art_scale_u})">{art}</g>'
    key = name.rstrip('0123456789') if name not in PLATE else name
    for k in PLATE:
        if name.startswith(k) and (len(name) == len(k) or name[len(k):].isalnum()): key = k
    plate = PLATE[key](col) if key in PLATE else f'<path d="{SHAPE[fam]}" fill="{col}" fill-rule="evenodd"/><g transform="scale({ink_scale})">{art}</g>'
    body = (
        f'<defs><radialGradient id="{uid}"><stop offset="0" stop-color="{col}" stop-opacity="{lamp:.2f}"/>'
        f'<stop offset=".55" stop-color="{col}" stop-opacity="{lamp * .35:.2f}"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient></defs>'
        f'<circle r="{R * glow_r:.1f}" fill="url(#{uid})"/>'
        f'<g transform="scale({R})">{plate}</g>'
    )
    return body, reach

def caption(x, y, name, value, size=13.5):
    v = f'<tspan fill="{PAPER}" fill-opacity=".5" dx="5">{value}</tspan>' if value else ''
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{FONT}" font-size="{size}"><tspan fill="{PAPER}" font-weight="600">{name}</tspan>{v}</text>'

def build():
    W = 1440
    rows = {}
    for fam, name, col, glyph, val in PRINTS: rows.setdefault(fam, []).append((name, col, glyph, val))
    fams = ['tone', 'grit', 'space', 'motion', 'pitch', 'utility', 'control', 'spectral']
    out = []
    sections = []
    y = 150
    ROW = 150
    R = 30
    out.append(f'<text x="60" y="64" font-family="{FONT}" font-size="22" font-weight="600" fill="{PAPER}">patch on slur — the prints, in the slur design</text>')
    out.append(f'<text x="60" y="92" font-family="{FONT}" font-size="14" fill="{PAPER}" fill-opacity=".5">the web diagram\'s plates (a shape per family, one flat tint each) with each print\'s own picture inside, in paper. a round lamp behind every print grows with its knob — no aurora.</text>')
    for fam in fams:
        sections.append([fam, y - 70, ROW, len(out)])
        out.append(f'<text x="60" y="{y + 5}" font-family="{FONT}" font-size="13" fill="{PAPER}" fill-opacity=".45">{fam}</text>')
        x = 190
        for name, col, glyph, val in rows[fam]:
            Rr = R * (.72 if fam == 'control' else .7 if fam == 'utility' else 1)
            body, reach = print_svg(fam, name, col, glyph, Rr)
            out.append(f'<g transform="translate({x} {y})">{body}</g>')
            out.append(caption(x, y + R * (1.2 if fam == 'pitch' else 1) + 26, name, val))
            x += 160
        y += ROW
    # the lamp mechanism: one print at three knob settings
    y += 10
    sections.append(['the lamp', y - 70, ROW + 10, len(out)])
    out.append(f'<text x="60" y="{y + 5}" font-family="{FONT}" font-size="13" fill="{PAPER}" fill-opacity=".45">the lamp</text>')
    out.append(f'<text x="190" y="{y - 40}" font-family="{FONT}" font-size="13" fill="{PAPER}" fill-opacity=".5">the knob up: the lamp brighter and wider (the round glow that already exists — kept; the aurora goes)</text>')
    x = 230
    for a in (.15, .5, .9):
        body, _ = print_svg('space', 'space', '#5C80FF', g_space, R, lamp=.08 + .38 * a, glow_r=2.2 + 2.2 * a)
        out.append(f'<g transform="translate({x} {y})">{body}</g>')
        out.append(caption(x, y + R + 26, 'space', f'hall {int(a * 100)}'))
        x += 220
    body, _ = print_svg('tone', 'tape', '#D27A45', g_tape, R, lamp=.46, glow_r=4.2)
    out.append(f'<g transform="translate({x + 60} {y})">{body}</g>'); out.append(caption(x + 60, y + R + 26, 'tape', 'hard 95'))
    body, _ = print_svg('control', 'LFO', '#B79CFF', g_lfo, R * .72, lamp=.3, glow_r=3)
    out.append(f'<g transform="translate({x + 280} {y})">{body}</g>'); out.append(caption(x + 280, y + R + 26, 'LFO', 'sine 1/4'))
    body, _ = print_svg('utility', 'side', '#5CE0A8', g_side, R * .7, lamp=.34, glow_r=3.4)
    out.append(f'<g transform="translate({x + 400} {y})">{body}</g>'); out.append(caption(x + 400, y + R + 26, 'side', ''))
    y += ROW
    # the night drive patch, redrawn with these prints
    y += 10
    sections.append(['the wall', y - 30, 610 * .95 + 110, len(out)])
    out.append(f'<text x="60" y="{y + 5}" font-family="{FONT}" font-size="13" fill="{PAPER}" fill-opacity=".45">the wall</text>')
    by = {n: (f, c, g) for f, n, c, g, v in PRINTS}
    NP = {
        'in': (44, 300, None), 'tape': (130, 300, 'tape'), 'ms': (225, 300, 'M/S'), 'space': (330, 175, 'space'), 'delay': (465, 175, 'delay'),
        'mod': (330, 430, 'mod'), 'trem': (465, 430, 'tremolo'), 'voc': (600, 430, 'vocode'), 'mix': (640, 300, 'mix'), 'carve': (765, 300, 'carve'),
        'comp': (880, 300, 'comp'), 'air': (990, 300, 'air'), 'out': (1078, 300, None), 'lfo': (398, 62, 'LFO'), 'macro': (822, 70, 'macro'), 'side': (765, 548, 'side'),
    }
    CAP = {'tape': 'hard 55', 'ms': '', 'space': 'hall 62', 'delay': 'pingpong 1/8', 'mod': 'phaser 45', 'trem': 'sine 1/8', 'voc': '55', 'mix': 'blend', 'carve': '-12 dB', 'comp': '-25 dB', 'air': 'silk 50', 'lfo': 'sine 1/4', 'macro': '60', 'side': ''}
    KNOB = {'tape': .55, 'space': .62, 'delay': .5, 'mod': .45, 'trem': .5, 'voc': .55, 'carve': .5, 'comp': .42, 'air': .5, 'ms': .3, 'mix': .3, 'lfo': .35, 'macro': .6, 'side': .35}
    AUDIO = [('in', 'tape'), ('tape', 'ms'), ('ms', 'space'), ('ms', 'mod'), ('space', 'delay'), ('mod', 'trem'), ('trem', 'voc'), ('delay', 'mix'), ('voc', 'mix'), ('mix', 'carve'), ('carve', 'comp'), ('comp', 'air'), ('air', 'out')]
    HANDS = [('lfo', 'space'), ('lfo', 'mod'), ('macro', 'comp'), ('macro', 'delay'), ('side', 'carve'), ('side', 'voc')]
    ox, oy, S = 190, y + 30, .95
    def rad(k):
        n = NP[k][2]
        if n is None: return 5
        fam = by[n][0]
        base = 30 * (.72 if fam == 'control' else .62 if fam == 'utility' else 1)
        return base * REACH[fam] + 6
    def pt(k): return ox + NP[k][0] * S, oy + NP[k][1] * S
    wall = [f'<rect x="{ox - 60}" y="{oy - 20}" width="{1120 * S + 120}" height="{610 * S + 40}" rx="6" fill="#0F0E0D"/>']
    for i in range(5): wall.append(f'<line x1="{ox - 60}" x2="{ox + 1120 * S + 60}" y1="{oy + (260 + i * 20) * S}" y2="{oy + (260 + i * 20) * S}" stroke="{PAPER}" stroke-opacity=".05"/>')
    for a, b in HANDS:
        ax, ay = pt(a); bx, byy = pt(b); col = by[NP[a][2]][1]
        wall.append(f'<path d="M {ax} {ay} Q {(ax + bx) / 2 + (30 if byy > ay else -30)} {(ay + byy) / 2}, {bx} {byy}" fill="none" stroke="{col}" stroke-width="1.1" stroke-dasharray="3 5" opacity=".7"/>')
    for a, b in AUDIO:
        ax, ay = pt(a); bx, byy = pt(b); x0 = ax + rad(a) * S; x1 = bx - rad(b) * S; dx = max(24, (x1 - x0) * .5)
        wall.append(f'<path d="M {x0} {ay} C {x0 + dx} {ay}, {x1 - dx} {byy}, {x1} {byy}" fill="none" stroke="{PAPER}" stroke-opacity=".55" stroke-width="1.2"/>')
    for k, (px, py, n) in NP.items():
        cx, cy = pt(k)
        if n is None:
            wall.append(f'<circle cx="{cx}" cy="{cy}" r="5" fill="{PAPER}"/>' + f'<text x="{cx}" y="{cy + 24}" text-anchor="middle" font-family="{FONT}" font-size="12" fill="{PAPER}" fill-opacity=".45">{k}</text>')
            continue
        fam, col, glyph = by[n]
        Rr = 30 * (.72 if fam == 'control' else .62 if fam == 'utility' else 1) * S
        a = KNOB[k]
        body, reach = print_svg(fam, n + k, col, glyph, Rr, lamp=.08 + .38 * a, glow_r=2.2 + 2.2 * a)
        wall.append(f'<g transform="translate({cx} {cy})">{body}</g>')
        wall.append(caption(cx, cy + Rr * (1.2 if fam == 'pitch' else 1) + 24, n.lower() if n != 'M/S' else 'm/s', CAP[k]))
    out.extend(wall)
    y += 610 * S + 80
    H = y + 40
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="{INK_BG}"/>{"".join(out)}</svg>'
    here = os.path.dirname(os.path.abspath(__file__))
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>@font-face{{font-family:"Instrument Sans";src:url("../../plugin/public/fonts/instrument-sans-normal-400-700-latin.woff2") format("woff2");font-weight:400 700}} html,body{{margin:0;background:{INK_BG}}} svg{{display:block}}</style></head><body>{svg}</body></html>'
    open(os.path.join(here, 'prints-draft.html'), 'w').write(html)
    chunks = []
    for i, (name, y0, h, i0) in enumerate(sections):
        i1 = sections[i + 1][3] if i + 1 < len(sections) else len(out)
        frag = ''.join(out[i0:i1])
        chunks.append({'name': name, 'y': y0, 'h': h, 'svg': f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{h}" viewBox="0 {y0} {W} {h}">{frag}</svg>'})
    open(os.path.join(here, 'prints-draft-sections.json'), 'w').write(json.dumps(chunks))
    print('sections', [(c['name'], len(c['svg'])) for c in chunks])
    # per-print svgs for figma (plate + picture only, no lamp; 160px box)
    figma = []
    for fam, name, col, glyph, val in PRINTS:
        Rr = 30 * (.72 if fam == 'control' else .62 if fam == 'utility' else 1)
        body, reach = print_svg(fam, name, col, glyph, Rr, lamp=.3, glow_r=3.2)
        figma.append({'family': fam, 'name': name, 'value': val, 'colour': col,
                      'svg': f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="-100 -100 200 200">{body}</svg>'})
    open(os.path.join(here, 'prints-draft.json'), 'w').write(json.dumps(figma))
    print('ok', W, H, len(PRINTS))

build()
