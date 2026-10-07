# shows one kept measure (bench/results/*.json) as tables
import json, sys
d = json.load(open(sys.argv[1]))
print(sys.argv[1])
up = d.get('up', {})
print(f"\nup: {up.get('toThePage')} s to the page, {up.get('thenToReady')} s more until the song is in the engine; {up.get('memory')} MB held; {up.get('cores')} cores; {up.get('sr')} Hz, device block {up.get('block')}")
src = d.get('source', {})
print(f"source: {src.get('sec')} s decoded in {src.get('decodeMs')} ms, +{src.get('memoryAdded')} MB")
names = [k for k in d if isinstance(d[k], dict) and 'engine' in d[k]]
if names:
    print("\nthe page (ms)".ljust(35) + ''.join(n[:13].rjust(14) for n in names))
    rows = [('regions', lambda s: s['regions']), ('nodes on the board', lambda s: s['page']['nodes']), ('draw everything', lambda s: s['page']['drawAll']), ('draw the lanes', lambda s: s['page']['drawLanes']), ('draw the lanes, zoomed', lambda s: s['page']['drawZoomed']), ('draw the heads', lambda s: s['page']['drawHeads']), ('draw the mixer', lambda s: s['page']['drawMixer']), ('a pull, each move', lambda s: s['page']['pullFrame']), ('a scroll, each move', lambda s: s['page']['scrollFrame']), ('an edit (page)', lambda s: s['page']['editJs']), ('an edit (until the engine has it)', lambda s: s['page']['editDone']), ('tell the engine all', lambda s: s['page']['tellEngine']), ('copy for undo', lambda s: s['page']['undoCopy']), ('write the project', lambda s: s['page']['save']), ('project bytes', lambda s: s['page']['saveBytes']), ('snap', lambda s: s['page']['snap']), ('find all chosen', lambda s: s['page']['chooseAll']), ('draw all, all chosen', lambda s: s['page']['drawAllChosen'])]
    for label, f in rows:
        print(label.ljust(34) + ''.join(str(f(d[n])).rjust(14) for n in names))
    print("\nthe engine".ljust(35) + ''.join(n[:13].rjust(14) for n in names))
    print('patched tracks'.ljust(34) + ''.join(str(d[n]['patched']).rjust(14) for n in names))
    print('memory held (MB)'.ljust(34) + ''.join(str(d[n]['memory']).rjust(14) for n in names))
    print('  added by the session'.ljust(34) + ''.join(str(d[n]['memoryAdded']).rjust(14) for n in names))
    for b in ('block 512', 'block 64', 'block 32'):
        print(f"{b}: share of one core".ljust(34) + ''.join(f"{d[n]['engine'][b].get('load', 0) * 100:.1f}%".rjust(14) for n in names))
        print('  mean / p99 / worst block (ms)'.ljust(34) + ''.join(f"{d[n]['engine'][b].get('meanMs', 0):.3f}/{d[n]['engine'][b].get('p99Ms', 0):.3f}/{d[n]['engine'][b].get('worstMs', 0):.2f}".rjust(14 if len(names) > 4 else 20) for n in names))
        print('  a block lasts (ms)'.ljust(34) + ''.join(str(d[n]['engine'][b].get('blockLastsMs', '')).rjust(14) for n in names))
    print('the same sound twice'.ljust(34) + ''.join(str(d[n]['engine'].get('sameAgain')).rjust(14) for n in names))
    if all('alone' in d[n] for n in names):
        print('plug-ins from outside'.ljust(34) + ''.join(str(d[n].get('plugins', 0)).rjust(14) for n in names))
        print('threads / ranks shared out'.ljust(34) + ''.join(f"{d[n]['engine']['block 512'].get('threads')}/{d[n]['engine']['block 512'].get('shared')}".rjust(14) for n in names))
        print('one thread alone: share of a core'.ljust(34) + ''.join(f"{d[n]['alone']['load'] * 100:.1f}%".rjust(14) for n in names))
        print('  the same sound as with all'.ljust(34) + ''.join(f"{d[n]['alone']['sameSound']}/{d[n]['alone']['sameSound32']}".rjust(14) for n in names))
        print('  playing alone: load / worst'.ljust(34) + ''.join(f"{d[n]['alone']['playing']['load'] * 100:.1f}%/{d[n]['alone']['playing']['worst'] * 100:.0f}%".rjust(14) for n in names))
    for key, label in (('playing', 'playing: load / worst'), ('playingWhileEditing', 'while editing: load / worst')):
        print(label.ljust(34) + ''.join(f"{d[n][key]['load'] * 100:.1f}%/{d[n][key]['worst'] * 100:.0f}%".rjust(14) for n in names))
        print('  blocks too late / held silent'.ljust(34) + ''.join(f"{d[n][key]['over']}/{d[n][key]['held']} of {d[n][key]['blocks']}".rjust(14) for n in names))
if any('smallBlocks' in d[n] for n in names):
    sb0 = next(d[n]['smallBlocks'] for n in names if 'smallBlocks' in d[n])
    print(f"\nthrough the device itself ({sb0.get('device')}; it offers blocks of {sb0.get('sizes')}; it was at {sb0.get('was')} and is back at {sb0.get('back')}):")
    for want in (64, 32):
        key = f'block {want}'
        cells = []
        for n in names:
            v = (d[n].get('smallBlocks') or {}).get(key)
            cells.append((f"{v['load'] * 100:.1f}%/{v['worst'] * 100:.0f}% {v['over']}+{v.get('xruns')}" if v else '').rjust(14 if len(names) > 4 else 20))
        got = next(((d[n].get('smallBlocks') or {}).get(key, {}).get('got') for n in names if (d[n].get('smallBlocks') or {}).get(key)), None)
        print(f"  block {got}: load / worst, late + lost".ljust(34) + ''.join(cells))
sd = d.get('sound on disk')
if sd:
    print("\nsound kept on the disk against the same file held in memory:")
    for k, v in sd.items(): print(f"  {k}: {v}")
lf = d.get('long files')
if lf:
    print(f"\nlong files: {lf['files']} of {lf['minutesEach']} min each: first load {lf['firstLoadMs']} ms, memory {lf.get('memoryBefore')} MB before, +{lf['memoryHeld']} MB with them in; opened again in {lf['openAgainMs']} ms ({lf['memoryAfterOpen']} MB held after, {lf.get('memoryAfterPlaying')} MB after playing); playing load {lf['playing']['load'] * 100:.1f}%, worst {lf['playing']['worst'] * 100:.0f}%, late {lf['playing']['over']}; from bar 41: worst {lf['playingFromBar41']['worst'] * 100:.0f}%, late {lf['playingFromBar41']['over']}")
print('\npage errors:', d.get('page', {}).get('errors'), '  finished:', d.get('finished'), ' fail:', d.get('fail'))
