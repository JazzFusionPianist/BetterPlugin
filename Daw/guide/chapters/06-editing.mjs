import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

// a region for the drawings: an outlined body, with a few strokes of sound in it
const reg = (x, y, w, hh, cls = '') => D.box(x, y, w, hh, cls || 'tint') + `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx=".7" class="db ${cls === 'blf' ? 'bl' : ''}"/>`
const curve = (x, y, w, hh, kind) => {
  let d = ''
  for (let i = 0; i <= 24; i++) { const f = i / 24, v = kind === 0 ? f : kind === 1 ? Math.sin(f * Math.PI / 2) : (1 - Math.cos(f * Math.PI)) / 2; d += (i ? 'L' : 'M') + (x + f * w).toFixed(2) + ' ' + (y + hh - v * hh).toFixed(2) }
  return D.box(x, y, w, hh, 'soft') + D.path(d, 'thick')
}

export default () => chapter('editing', t('editing regions', '리전 편집'),
  t('Everything done to regions on the lanes: choosing, the tools, moving and cutting, fades and crossfades, the five modes, nudging, timing and pitch.', '레인 위의 리전에 하는 모든 일. 선택, 도구, 옮기기와 자르기, 페이드와 크로스페이드, 다섯 가지 모드, 넛지, 타이밍과 피치.'), [

  page(t('choosing', '선택'), { kind: 'text', cc: 3, txt:
    h('with the pointer', '포인터로') +
    table(null,
      [['click a region', '리전 클릭'], ['it alone is chosen', '그것만 선택']],
      [['[[⇧]] click', '[[⇧]] 클릭'], ['added, or taken out', '추가하거나 빼기']],
      [['drag on empty lane', '빈 레인에서 드래그'], ['a rubber band: every region it touches', '고무줄 상자: 닿는 모든 리전']],
      [['click a track’s head', '트랙 헤드 클릭'], ['every region on the chosen tracks', '선택한 트랙의 모든 리전']],
      ['[[esc]]', ['let go of everything', '모든 선택 해제']]) +
    p('A chosen region is drawn lighter with an ink outline and named in the transport panel. The other regions of its region group, and the regions over the same stretch on the other tracks of a group that shares editing, are chosen with it.', '선택된 리전은 밝게, 검은 윤곽선과 함께 그려지고 트랜스포트 패널에 이름이 나옵니다. 같은 리전 그룹의 리전과, 편집을 함께 하는 그룹의 다른 트랙에서 같은 구간에 있는 리전도 함께 선택됩니다.') +
    h('a stretch of time: the marquee', '시간 구간: 마키') +
    p('With the marquee tool (by default the tool under [[⌘]]), drag across lanes to pick a stretch of time over those rows. [[⇧]] click extends it. It stays up while the tool is marquee or smart.', '마키 도구(기본으로 [[⌘]]를 누르면 나오는 도구)로 레인을 가로질러 드래그하면 그 줄들의 시간 구간이 잡힙니다. [[⇧]] 클릭으로 늘립니다. 도구가 마키나 스마트인 동안 유지됩니다.') +
    p('Click inside a marquee with the pointer tool and the stretch becomes regions of its own: cut at both its edges on every track it covers, chosen, and ready to move.', '포인터 도구로 마키 안을 클릭하면 그 구간이 독립된 리전이 됩니다. 걸친 모든 트랙에서 양 끝이 잘리고, 선택되어 바로 옮길 수 있습니다.') +
    p('What acts on a marquee: [[⌫]] delete, [[⌘C]] copy, [[⌘X]] cut, [[N]] mute, [[⌘T]] cut at its two edges, [[F]] fades over it, [[U]] cycle round it, [[⇧space]] play from it.', '마키에 작용하는 것: [[⌫]] 삭제, [[⌘C]] 복사, [[⌘X]] 잘라내기, [[N]] 뮤트, [[⌘T]] 양 끝에서 자르기, [[F]] 그 길이로 페이드, [[U]] 그 둘레로 사이클, [[⇧space]] 거기서 재생.') +
    table(null,
      ['[[⇧tab]]', ['a marquee from the playhead to the next beginning; again, one further', '플레이헤드에서 다음 시작점까지 마키. 다시 누르면 하나 더']],
      ['[[←]] [[→]]', ['with a marquee up: its end to the last, the next beginning', '마키가 있을 때: 끝을 이전, 다음 시작점으로']],
      ['[[⇧←]] [[⇧→]]', ['its start', '시작을 옮기기']],
      ['[[⌥←]] [[⌥→]]', ['the whole marquee, by one nudge', '마키 전체를 넛지 한 번만큼']]) +
    h('by key', '키로') +
    table(null,
      ['[[⌘A]]', ['every region', '모든 리전']],
      ['[[⇧D]]', ['nothing', '선택 없음']],
      ['[[⇧I]]', ['the others', '나머지']],
      ['[[⇧F]]', ['all that follow, on every track', '모든 트랙에서 뒤따르는 것 전부']],
      ['[[⌃⇧F]]', ['all that follow on the same tracks', '같은 트랙에서 뒤따르는 것 전부']],
      ['[[⇧L]]', ['every region inside the cycle', '사이클 안의 모든 리전']],
      ['[[⇧M]]', ['every muted region', '뮤트된 모든 리전']],
      ['[[←]] [[→]]', ['the region before, after on the track', '트랙의 이전, 다음 리전']],
      ['[[⇧←]] [[⇧→]]', ['one more to that side', '그쪽으로 하나 더']],
      ['[[⇧home]] [[⇧end]]', ['the first, the last on the chosen tracks', '선택한 트랙의 처음, 마지막']]) +
    h('a crossfade', '크로스페이드') +
    p('A crossfade can itself be chosen: click it with the fade tool, or with the smart tool at the foot of the join. It gets an ink frame and the transport panel shows its length and curve. [[⌫]] takes it off.', '크로스페이드 자체도 선택할 수 있습니다. 페이드 도구로 클릭하거나, 스마트 도구로 이음매 아래쪽을 클릭합니다. 검은 테두리가 생기고 트랜스포트 패널에 길이와 곡선이 나옵니다. [[⌫]]로 없앱니다.') }),

  page(t('the tools', '도구'), { kind: 'split', tw: 168, txt:
    p('[[T]] opens the tool menu at the pointer; then one letter picks a tool ([[T]] [[T]] is the pointer). Right-clicking the lanes opens the same menu.', '[[T]]를 누르면 포인터 위치에 도구 메뉴가 열리고, 이어서 글자 하나로 도구를 고릅니다([[T]] [[T]]는 포인터). 레인을 오른쪽 클릭해도 같은 메뉴가 열립니다.') +
    table([['tool', '도구'], ['', ''], ['click', '클릭'], ['drag', '드래그']],
      ['{{pointer}}', '[[T]]', ['choose', '선택'], ['a region’s body: move. An end: trim. [[⌥]] at the press: carry a copy', '리전 몸통: 이동. 끝: 트림. 누를 때 [[⌥]]: 사본을 들고 이동']],
      ['{{smart}}', '[[S]]', ['depends on where it lands; see the next page', '닿는 위치에 따라 다릅니다. 다음 쪽 참고'], ['', '']],
      ['{{pencil}}', '[[P]]', ['on empty lane: a new region of the track’s last sound; on a track of notes an empty region', '빈 레인: 그 트랙의 마지막 소리로 새 리전. 노트 트랙에서는 빈 리전'], ['its end follows the pointer', '끝이 포인터를 따라갑니다']],
      ['{{eraser}}', '[[E]]', ['the region is deleted', '리전 삭제'], ['', '']],
      ['{{scissors}}', '[[I]]', ['cuts the region at the pointer', '포인터 위치에서 자르기'], ['', '']],
      ['{{join}}', '[[J]]', ['makes regions one: pressed on one of several chosen regions, all of them; else the region and the one after it. Inside a marquee: the marquee’s stretch', '리전을 하나로: 선택한 여러 리전 중 하나를 누르면 전부, 아니면 그 리전과 다음 리전. 마키 안을 누르면 마키 구간'], ['', '']],
      ['{{mute}}', '[[M]]', ['mute, unmute the region', '리전 뮤트, 해제'], ['', '']],
      ['{{gain}}', '[[G]]', ['[[⌥]] click: gain back to 0', '[[⌥]] 클릭: 게인을 0으로'], ['up louder, down quieter, 0.1 dB a pixel', '위로 크게, 아래로 작게. 픽셀당 0.1 dB']],
      ['{{fade}}', '[[A]]', ['on a join: a 20 ms crossfade, or choose the one there', '이음매에서: 20 ms 크로스페이드, 이미 있으면 선택'], ['in a region’s left half a fade in, right half a fade out; across a join a crossfade', '리전 왼쪽 절반에서는 페이드 인, 오른쪽 절반에서는 페이드 아웃, 이음매를 가로지르면 크로스페이드']],
      ['{{marquee}}', '[[R]]', ['clears the marquee', '마키 지우기'], ['a stretch of time over rows', '줄에 걸친 시간 구간']],
      ['{{rubato}}', '[[X]]', ['in the rubato view: a pin anywhere in a region', '루바토 보기에서: 리전 어디든 핀'], ['the pin', '핀 이동']],
      ['{{zoom}}', '[[Y]]', ['zoom out by half', '절반으로 축소'], ['zoom in to that stretch', '그 구간으로 확대']],
      ['{{velocity}}', '[[V]]', ['on the lanes it is the gain tool: how hard a region of notes plays is its gain', '레인에서는 게인 도구와 같습니다. 노트 리전의 세기가 곧 게인입니다'], ['on the notes page: a note dragged up or down plays harder or softer', '노트 페이지에서: 노트를 위아래로 드래그하면 더 세게, 더 약하게']]),
    art: fig('toolmenu', { w: 44 }) +
      `<div style="width:76mm;margin-top:6mm">` + note('The letters pick tools only while the tool menu is up; at other times the same keys are commands. A grab does not move until the hand has gone 3 pixels, so a click meant to choose does not shift a region. In the automation view every tool except zoom and marquee works the lines instead.', '글자로 도구를 고르는 것은 도구 메뉴가 떠 있을 때뿐이고, 평소에는 같은 키가 명령입니다. 잡은 것은 손이 3픽셀 움직여야 움직이기 시작하므로, 선택하려던 클릭이 리전을 밀지 않습니다. 오토메이션 보기에서는 줌과 마키를 뺀 모든 도구가 라인에 작용합니다.') + `</div>` }),

  page(t('the smart tool', '스마트 도구'), { kind: 'split', tw: 96, mid: true, txt:
    lead('One tool whose click depends on where it lands on a region. The pointer shows what a click would do.', '리전의 어디에 닿느냐에 따라 하는 일이 달라지는 도구 하나. 포인터 모양이 클릭하면 일어날 일을 알려 줍니다.') +
    legend(
      [1, '__top corners__ a fade in at the left, a fade out at the right. Drag to make it longer', '__위쪽 모서리__ 왼쪽은 페이드 인, 오른쪽은 페이드 아웃. 드래그해서 늘립니다'],
      [2, '__the ends__ under the corners: trim that end', '__양 끝__ 모서리 아래: 그 끝을 트림'],
      [3, '__upper half__ pick a stretch of time (a marquee). A click without a drag puts the playhead there', '__위쪽 절반__ 시간 구간(마키) 잡기. 드래그 없이 클릭하면 플레이헤드가 그곳으로'],
      [4, '__lower half__ take hold of the region: choose, move, [[⌥]] copy', '__아래쪽 절반__ 리전 잡기: 선택, 이동, [[⌥]] 복사'],
      [5, '__the foot of a join__ a click makes a 20 ms crossfade; a drag draws one about the join. One that is there is taken hold of and moves along the two regions', '__이음매 아래쪽__ 클릭하면 20 ms 크로스페이드, 드래그하면 이음매를 중심으로 크로스페이드를 그립니다. 이미 있는 것은 잡혀서 두 리전을 따라 움직입니다']) +
    p('On empty lane the smart tool picks a stretch of time. In the rubato view, near a pin, it takes the pin first. Fades and crossfades do not exist on regions of notes.', '빈 레인에서 스마트 도구는 시간 구간을 잡습니다. 루바토 보기에서 핀 가까이에서는 핀을 먼저 잡습니다. 노트 리전에는 페이드와 크로스페이드가 없습니다.') +
    note('Choose it from the tool menu: [[T]] then [[S]].', '도구 메뉴에서 고릅니다. [[T]] 다음 [[S]].'),
    art: draw(150, 82,
      D.txt(0, 4, 'two regions that meet on one track', '한 트랙에서 만나는 두 리전', 's') +
      reg(12, 22, 68, 36) + reg(80, 22, 58, 36) +
      // zones
      D.box(12, 22, 13, 9, 'blf') + D.box(125, 22, 13, 9, 'blf') +
      D.box(12, 31, 6, 27, 'blf') + D.box(132, 31, 6, 27, 'blf') +
      D.box(70, 49, 20, 9, 'blf') +
      D.line(18, 40, 132, 40, 'dash') +
      D.txt(46, 36, 'range', '구간', 's m') + D.txt(46, 50, 'grab', '잡기', 's m') + D.txt(110, 36, 'range', '구간', 's m') + D.txt(110, 50, 'grab', '잡기', 's m') +
      // numbers
      D.line(18.5, 22, 18.5, 14, 'soft') + D.num(18.5, 12, 1) + D.line(131.5, 22, 131.5, 14, 'soft') + D.num(131.5, 12, 1) +
      D.line(12, 46, 5, 46, 'soft') + D.num(3, 46, 2) + D.line(138, 46, 145, 46, 'soft') + D.num(147, 46, 2) +
      D.line(60, 31, 60, 14, 'soft') + D.num(60, 12, 3) +
      D.line(30, 54, 30, 66, 'soft') + D.num(30, 68, 4) +
      D.line(80, 58, 80, 66, 'soft') + D.num(80, 68, 5) +
      D.txt(0, 80, 'at the usual row height: corners 12 by 8 pixels, ends 6 wide, the foot of a join 20 by 8', '보통 줄 높이에서: 모서리 12 x 8픽셀, 끝 6픽셀 폭, 이음매 아래 20 x 8', 'xs')) }),

  page(t('moving, copying, and the overlap rule', '옮기기, 복사, 그리고 겹침 규칙'), { kind: 'split', tw: 124, txt:
    h('by hand', '손으로') +
    list(
      ['Drag a chosen region by its body: everything chosen moves together. Move to another row and all change rows by the same number.', '선택한 리전의 몸통을 드래그하면 선택한 것 전체가 함께 움직입니다. 다른 줄로 옮기면 모두 같은 줄 수만큼 옮겨집니다.'],
      ['Hold [[⌥]] when pressing a region’s body, then drag: the original stays and a copy is carried. The option key is read at the press only. (On a region’s right end, [[⌥]] stretches it instead.)', '리전 몸통을 누를 때 [[⌥]]를 잡고 드래그하면 원본은 남고 사본을 들고 갑니다. option 키는 누르는 순간에만 읽습니다. (리전의 오른쪽 끝에서는 [[⌥]]가 늘이기입니다.)'],
      ['Audio moves only between audio tracks, notes only between tracks of notes, and nothing crosses between your tracks and someone else’s.', '오디오는 오디오 트랙끼리만, 노트는 노트 트랙끼리만 옮겨지고, 내 트랙과 남의 트랙 사이로는 넘어가지 않습니다.']) +
    h('by key', '키로') +
    table(null,
      ['[[⌘C]] [[⌘X]] [[⌘V]]', ['copy, cut, paste at the playhead', '복사, 잘라내기, 플레이헤드에 붙이기']],
      ['[[⌘R]]', ['repeat: a copy right after what is chosen', '반복: 선택한 것 바로 뒤에 사본']],
      ['[[L]]', ['fill to the next: again and again, up to the next region or the end of the song', '다음 것까지 채우기: 다음 리전이나 곡 끝까지 계속 반복']],
      ['[[;]]', ['what is chosen goes to the playhead; [[⇧;]] then chooses the next region, to bring it along in its turn', '선택한 것을 플레이헤드로. [[⇧;]]는 이어서 다음 리전을 선택해 차례로 가져올 수 있게 합니다']],
      ['[[⌥[]] [[⌥]]]', ['push it up against the region before, after', '이전, 다음 리전에 딱 붙이기']],
      ['[[⌥←]] [[⌥→]]', ['nudge earlier, later', '넛지: 앞으로, 뒤로']]) +
    p('With a marquee up, [[⌘R]] puts its stretch again right after it and the marquee goes onto the copy, so the next press follows on; [[⌘C]] then [[⌘V]] does the same. Without a marquee and with the song stopped, a paste takes the playhead to its end.', '마키가 있으면 [[⌘R]]은 그 구간을 바로 뒤에 한 번 더 놓고 마키가 사본으로 옮겨 가므로, 다시 누르면 이어서 놓입니다. [[⌘C]] 뒤 [[⌘V]]도 같습니다. 마키가 없고 곡이 멈춰 있으면 붙여넣은 뒤 플레이헤드가 그 끝으로 갑니다.') +
    p('A paste goes back on the tracks the copy came from when the chosen track is one of them; otherwise the topmost copied track lands on the chosen track. There is no duplicate-region key: [[⌘D]] duplicates the track.', '선택한 트랙이 복사해 온 트랙 중 하나면 붙여넣기는 원래 트랙으로 돌아가고, 아니면 복사한 것 중 맨 위 트랙이 선택한 트랙에 놓입니다. 리전 복제 키는 없습니다. [[⌘D]]는 트랙을 복제합니다.'),
    art: draw(134, 96,
      D.txt(0, 4, 'one sound at a time on a track', '트랙에서는 한 번에 한 소리', 'b') +
      D.txt(0, 10, 'a region put somewhere covers what was under it', '어딘가에 놓인 리전은 밑에 있던 것을 덮습니다', 's') +
      // case 1: crosses an edge
      D.txt(0, 21, 'before', '전', 'xs') + D.txt(72, 21, 'after', '후', 'xs') +
      reg(0, 23, 44, 9) + reg(30, 34, 28, 9, 'blf') + D.arrow([[44, 35], [44, 31]]) +
      reg(72, 23, 30, 9) + reg(102, 23, 28, 9, 'blf') + D.txt(72, 37.5, 'what crosses its edge is cut back there', '가장자리에 걸친 것은 거기서 잘립니다', 'xs') +
      // case 2: lands in the middle
      reg(0, 48, 58, 9) + reg(20, 59, 18, 9, 'blf') + D.arrow([[29, 59], [29, 57]]) +
      reg(72, 48, 20, 9) + reg(92, 48, 18, 9, 'blf') + reg(110, 48, 20, 9) + D.txt(72, 62.5, 'one it lands in the middle of is left as two pieces', '가운데에 놓이면 양쪽 두 조각이 남습니다', 'xs') +
      // case 3: wholly under
      reg(18, 73, 20, 9) + reg(8, 84, 44, 9, 'blf') + D.arrow([[30, 84], [30, 82]]) +
      reg(80, 73, 44, 9, 'blf') + D.txt(72, 87.5, 'one that lay wholly under it is gone', '완전히 덮인 것은 사라집니다', 'xs') +
      D.txt(0, 95.5, 'a region that was only cut back is still its file: pull its edge out again and the sound is back', '잘려 들어간 리전은 여전히 원래 파일입니다. 끝을 다시 당기면 소리가 돌아옵니다', 'xs')) }),

  page(t('trimming, cutting, joining', '트림, 자르기, 잇기'), { kind: 'text', cc: 3, txt:
    h('trim', '트림') +
    p('Drag an end with the pointer or the smart tool. A file cannot be trimmed out past its own beginning or end; a region of notes can be pulled out as far as you like. Pulled outwards over a neighbour, the neighbour gives way. With several regions chosen, the end of one pulled moves the same end of all of them by as much.', '포인터나 스마트 도구로 끝을 드래그합니다. 파일은 자기 시작과 끝 너머로 늘릴 수 없고, 노트 리전은 원하는 만큼 늘릴 수 있습니다. 이웃 위로 늘리면 이웃이 자리를 내줍니다. 여러 리전을 선택하고 하나의 끝을 끌면 모두의 같은 끝이 같은 만큼 움직입니다.') +
    table(null,
      ['[[[]] [[]]]', ['what is chosen begins, ends at the playhead. It trims or extends, and works while the song runs. With a marquee up, they move its start, its end', '마키가 있으면 마키의 시작, 끝을 옮깁니다. 선택한 것이 플레이헤드에서 시작, 끝나게. 줄이거나 늘리며, 재생 중에도 됩니다']],
      ['[[⌥⇧←]] [[⌥⇧→]]', ['shorter, longer by one nudge', '넛지 한 번만큼 짧게, 길게']]) +
    p('An end that is half of a crossfade moves the join: both regions go with it and the crossfade stays as long as it was.', '크로스페이드의 한쪽인 끝을 움직이면 이음매가 움직입니다. 두 리전이 함께 가고 크로스페이드 길이는 그대로입니다.') +
    h('stretch', '늘이기') +
    p('Hold [[⌥]] and drag a region’s right end: what is in it plays slower or faster to fill its new length, at the pitch it had, between a quarter of and four times its file’s own speed. The file follows the tempo from then on. In a region of notes each note begins and lasts so much later and longer.', '[[⌥]]를 누른 채 리전의 오른쪽 끝을 드래그하면, 안의 소리가 새 길이를 채우도록 느리게 또는 빠르게 재생됩니다. 피치는 그대로이고, 파일 원래 속도의 4분의 1에서 4배 사이입니다. 그 뒤로 파일은 템포를 따라갑니다. 노트 리전에서는 노트마다 시작과 길이가 그만큼 늘어납니다.') +
    h('cut', '자르기') +
    table(null,
      [['scissors', '가위'], ['at the pointer', '포인터 위치에서']],
      ['[[⌘T]]', ['the chosen regions at the playhead; with a marquee up, at its two edges', '선택한 리전을 플레이헤드에서. 마키가 있으면 그 양 끝에서']],
      ['[[⌥⌘T]]', ['at the cycle’s two ends', '사이클의 양 끝에서']]) +
    p('A cut is never made inside a crossfade: the two are two already. On a track of a group that shares editing, the group’s other tracks are cut at the same place.', '크로스페이드 안에서는 자르지 않습니다. 이미 둘이기 때문입니다. 편집을 함께 하는 그룹의 트랙에서는 그룹의 다른 트랙도 같은 자리에서 잘립니다.') +
    h('join', '잇기') +
    p('[[J]] (also [[⌘J]]) or the join tool makes the chosen regions of a track one. Pieces of one sound that lie end to end are mended, and nothing is written. Anything else is consolidated: what the regions sound like from the first one’s beginning to the last one’s end, with their gains and fades and with silence in the gaps, is written to a new file in the project’s Audio Files, and one region that plays it takes their place. Whatever lies between the first and the last goes into it; a muted region is left out. What the track does to its sound afterwards (patch, plug-ins, fader) is not in the file, so the song sounds as it did.', '[[J]](또는 [[⌘J]])나 잇기 도구는 한 트랙에서 선택한 리전들을 하나로 만듭니다. 한 소리를 자른 조각들이 맞닿아 있으면 그대로 이어 붙이고 아무것도 쓰지 않습니다. 그 밖에는 하나로 합칩니다(consolidate). 첫 리전의 시작부터 마지막 리전의 끝까지, 게인과 페이드를 포함해 들리는 그대로, 빈 곳은 무음으로 프로젝트 Audio Files의 새 파일에 쓰고, 그 파일을 재생하는 리전 하나가 자리를 대신합니다. 처음과 마지막 사이에 있는 것은 모두 들어가고, 뮤트한 리전은 빠집니다. 트랙이 그 뒤에 하는 일(패치, 플러그인, 페이더)은 파일에 들어가지 않으므로 곡은 전과 똑같이 들립니다.') +
    p('With a marquee it is the marquee’s stretch on each of its tracks, empty bars and all. Regions of notes become one region that holds what each of them sounded. It is one step of undo; the file that was written stays in Audio Files.', '마키가 있으면 마키가 놓인 트랙마다 마키 구간이 빈 마디까지 포함해 하나가 됩니다. 노트 리전들은 각자 내던 소리를 담은 리전 하나가 됩니다. 실행 취소 한 번으로 되돌아가며, 쓴 파일은 Audio Files에 남습니다.') +
    h('the shortest thing', '가장 짧은 것') +
    p('In ordinary views nothing shorter than 1/32 of a bar can be made or kept. Zoomed in close this shrinks to 4 pixels’ worth, down to two samples.', '보통 보기에서는 1/32마디보다 짧은 것을 만들거나 남길 수 없습니다. 가까이 확대하면 4픽셀만큼, 최소 두 샘플까지 줄어듭니다.') +
    h('delete', '삭제') +
    p('[[⌫]] deletes what is chosen and leaves a gap. In shuffle mode what follows closes up. The eraser tool deletes the region it clicks.', '[[⌫]]는 선택한 것을 지우고 빈자리를 남깁니다. 셔플 모드에서는 뒤따르는 것이 당겨집니다. 지우개 도구는 클릭한 리전을 지웁니다.') +
    h('mute', '뮤트') +
    p('[[N]] mutes the chosen regions, or what a marquee holds. A muted region is drawn faint. This is a region’s mute; [[M]] mutes whole tracks.', '[[N]]은 선택한 리전, 또는 마키 안의 것을 뮤트합니다. 뮤트된 리전은 흐리게 그려집니다. 이것은 리전의 뮤트이고, [[M]]은 트랙 전체를 뮤트합니다.') +
    h('names', '이름') +
    p('[[⇧↩]] with regions chosen opens a name box at the region’s start. All chosen regions get the name. A region shows its name on the lane only when it differs from its track’s; after it the lane says what was done to the region: {{+2 st}}, {{+15 ct}}, {{rev}}, its gain. A name keeps its capitals as it was typed.', '리전을 선택하고 [[⇧↩]]를 누르면 리전 시작에 이름 칸이 열립니다. 선택한 리전 모두에 그 이름이 붙습니다. 리전 이름은 트랙 이름과 다를 때만 레인에 보이고, 그 뒤에 리전에 한 일이 붙습니다. {{+2 st}}, {{+15 ct}}, {{rev}}, 게인. 이름은 입력한 대문자 그대로 남습니다.') +
    h('region groups', '리전 그룹') +
    p('Choose two or more regions, on any tracks, and press [[⌥⌘G]]: from then on clicking one chooses all. [[⌥⌘U]] lets them go.', '아무 트랙에서나 리전을 둘 이상 선택하고 [[⌥⌘G]]를 누르면, 이후로 하나를 클릭할 때 모두 선택됩니다. [[⌥⌘U]]로 풉니다.') }),

  page(t('fades and crossfades', '페이드와 크로스페이드'), { kind: 'split', tw: 122, txt:
    table(null,
      [['fade tool, smart tool', '페이드 도구, 스마트 도구'], ['drag from a region’s end inwards; across a join for a crossfade. [[⌃⇧]] and the pointer do the same; all chosen regions get it', '리전 끝에서 안쪽으로 드래그. 이음매를 가로지르면 크로스페이드. [[⌃⇧]]를 누르면 포인터로도 됩니다. 여러 리전을 선택했으면 전부에 걸립니다']],
      ['[[F]]', ['fades for what is chosen: every join between chosen regions gets a 20 ms crossfade, every open end a 10 ms fade. With a marquee up, the marquee says how long', '선택한 것에 페이드: 선택한 리전 사이 이음매마다 20 ms 크로스페이드, 열린 끝마다 10 ms 페이드. 마키가 있으면 그 길이대로']],
      ['[[D]]', ['a fade in from the region’s start up to the playhead', '리전 시작에서 플레이헤드까지 페이드 인']],
      ['[[G]]', ['a fade out from the playhead to its end', '플레이헤드에서 리전 끝까지 페이드 아웃']],
      [['take one off', '없애기'], ['choose a crossfade and press [[⌫]]; or [[⌥]] click with the fade tool; or drag it to nothing', '크로스페이드를 선택하고 [[⌫]]. 또는 페이드 도구로 [[⌥]] 클릭. 또는 0이 될 때까지 드래그']]) +
    h('curves', '곡선') +
    p('Three curves: {{linear}}, {{equal power}}, {{s curve}}. Pick it from the curve’s word in the transport panel. A new crossfade is linear when the two regions are one sound cut in two (it gives back exactly what was there) and equal power when they are different sounds. A fade alone falls evenly; [[⌃]] and up or down bends it.', '곡선은 세 가지. {{linear}}, {{equal power}}, {{s curve}}. 트랜스포트 패널에서 지금 곡선을 보여 주는 말({{crossfade}} 옆, 또는 {{fade}} 칸 뒤)에서 고릅니다. 새 크로스페이드는 두 리전이 하나의 소리를 자른 것이면 linear(원래 소리를 그대로 돌려줍니다), 서로 다른 소리면 equal power로 시작합니다. 크로스페이드가 아닌 페이드는 귀에 고르게 줄어듭니다. [[⌃]]+위아래 드래그로 휩니다.') +
    draw(122, 24, [['linear', 'linear'], ['equal power', 'equal power'], ['s curve', 's curve']].map(([en, ko], i) => curve(i * 37, 2, 30, 15, i) + D.txt(i * 37 + 15, 21.5, en, ko, 's m')).join('')) +
    h('how a crossfade behaves', '크로스페이드의 동작') +
    list(
      ['Each region is let run on past the join as far as it has sound; if neither has any, each fades inside itself.', '각 리전은 소리가 남아 있는 만큼 이음매 너머로 이어집니다. 둘 다 남은 소리가 없으면 각자 안쪽에서 페이드됩니다.'],
      ['Move both regions and it goes with them. Move or delete one and the two meet plainly first.', '두 리전을 함께 옮기면 따라가고, 하나만 옮기거나 지우면 먼저 평범한 이음매로 돌아갑니다.'],
      ['Copies leave their crossfades behind.', '사본에는 크로스페이드가 따라가지 않습니다.']) +
    note('Fades are dragged freely in every mode except grid.', '페이드는 grid를 뺀 모든 모드에서 자유롭게 드래그됩니다.'),
    art: fig('fades', { w: 132, calls: [[1, [609, 50], 't'], [2, [540, 114], 'b'], [3, [660, 117], 'b']] }) +
      `<div style="width:132mm">` + legend(
        [1, 'a crossfade, chosen: one body through the shared stretch with both lines', '선택된 크로스페이드: 겹치는 구간을 지나는 한 몸, 두 곡선과 함께'],
        [2, 'a fade out: a bent line, the sound darkened above it', '페이드 아웃: 휘어진 선, 그 위의 소리는 어둡게'],
        [3, 'a fade in on the next region', '다음 리전의 페이드 인']) +
      h('speed up, slow down', '스피드 업, 슬로 다운') +
      p('Right-click a fade in for {{speed up}}, a fade out for {{slow down}}, as in Logic: the sound runs up from a standstill or down to one, its pitch with it, at its own level, like a tape or a record stopped by hand. Its line is drawn broken, deep blue above it; {{fade}} makes it a fade again. Half of a crossfade stays a fade.', '페이드 인을 우클릭하면 {{speed up}}, 페이드 아웃은 {{slow down}}(Logic과 같음). 멈춘 소리가 속도를 올리거나 멈출 때까지 느려지고, 음정도 같이 움직이며 레벨은 그대로입니다. 손으로 세우는 테이프나 판 소리. 선은 끊어진 선, 그 위는 짙은 남색으로 그려지고, {{fade}}로 다시 페이드가 됩니다. 크로스페이드의 한쪽은 페이드로 남습니다.') + `</div>` }),

  page(t('the five modes and the grid', '다섯 가지 모드와 그리드'), { kind: 'split', tw: 150, txt:
    p('The mode says how a drag is placed. Set it from {{mode}} in the transport panel, or by key: [[F1]] shuffle, [[F2]] slip, [[F3]] spot, [[F4]] grid. [[F2]] again goes back to the mode before slip. The mode is kept with the project.', '모드는 드래그가 놓이는 방식을 정합니다. 트랜스포트 패널의 {{mode}}에서, 또는 키로 정합니다. [[F1]] 셔플, [[F2]] 슬립, [[F3]] 스팟, [[F4]] 그리드. [[F2]]를 다시 누르면 슬립 전의 모드로 돌아갑니다. 모드는 프로젝트에 저장됩니다.') +
    table([['mode', '모드'], ['a drag', '드래그'], ['paste', '붙이기'], ['delete', '삭제']],
      ['{{smart}}', ['goes to the grid; region ends on every track, the playhead and the cycle’s ends pull harder than the grid when within 6 pixels', '그리드에 맞습니다. 6픽셀 안에 있으면 모든 트랙의 리전 끝, 플레이헤드, 사이클 끝이 그리드보다 강하게 당깁니다'], ['at the playhead', '플레이헤드에'], ['leaves a gap', '빈자리 남김']],
      ['{{grid}}', ['the grid alone', '그리드만'], ['at the playhead put on the grid', '그리드에 맞춘 플레이헤드에'], ['leaves a gap', '빈자리 남김']],
      ['{{slip}}', ['nothing pulls', '아무것도 당기지 않음'], ['at the playhead', '플레이헤드에'], ['leaves a gap', '빈자리 남김']],
      ['{{shuffle}}', ['a track’s regions stand end to start: a moved region is put in at the nearest join and what stands after makes room; the gap it left closes', '트랙의 리전이 끝과 시작을 맞대고 섭니다. 옮긴 리전은 가장 가까운 이음매에 끼워지고 뒤의 것이 자리를 내주며, 떠난 자리는 닫힙니다'], ['what follows makes room', '뒤의 것이 자리를 내줌'], ['what follows closes up', '뒤의 것이 당겨짐']],
      ['{{spot}}', ['nothing pulls; a chosen region clicked asks where it should begin. Type a place and [[↩]]', '아무것도 당기지 않음. 선택한 리전을 클릭하면 어디서 시작할지 묻습니다. 위치를 입력하고 [[↩]]'], ['at the playhead', '플레이헤드에'], ['leaves a gap', '빈자리 남김']]) +
    h('the grid', '그리드') +
    p('The lanes show lines at the division chosen at {{grid}} in the transport panel: 1/4 to begin with; 1/1 to 1/32, and the triplet ones 1/3, 1/6, 1/12, 1/24. A bar line is the strongest, a line on a beat weaker, the rest much fainter. From far away the lines thin out instead of running together. The choice is kept with the project.', '레인에는 트랜스포트 패널의 {{grid}}에서 고른 간격으로 선이 그려집니다. 처음에는 1/4. 1/1부터 1/32까지, 그리고 셋잇단인 1/3, 1/6, 1/12, 1/24. 마디 선이 가장 진하고, 박에 놓인 선은 더 옅고, 나머지는 훨씬 옅습니다. 멀리서 보면 선이 뭉치지 않도록 성기게 그려집니다. 고른 값은 프로젝트에 저장됩니다.') +
    p('What a drag goes to follows the zoom: the smallest of these still at least 14 pixels wide on screen: 4 bars, 2 bars, a bar, half a bar, the beat, the beat halved again and again, 5 ticks, a tick, then whole samples. With a triplet grid chosen it is thirds, sixths, twelfths of a whole note instead.', '드래그가 맞춰지는 단계는 줌을 따라갑니다. 화면에서 14픽셀 이상인 가장 작은 단계입니다. 4마디, 2마디, 한 마디, 반 마디, 박, 박을 계속 반으로 나눈 것, 5틱, 1틱, 그다음은 샘플 단위. 셋잇단 그리드를 고르면 온음표의 3분의 1, 6분의 1, 12분의 1로 바뀝니다.') +
    table(null,
      [['hold [[⌃]] in a drag', '드래그 중 [[⌃]]'], ['a grid two steps finer, and nothing else pulls', '두 단계 더 촘촘한 그리드, 다른 것은 당기지 않음']],
      [['hold [[⌃⇧]]', '[[⌃⇧]]'], ['free', '자유롭게']]) +
    note('Held before pressing on a region of sound, [[⌃⇧]] makes the pointer the fade tool instead (see “fades and crossfades”).', '소리 리전을 누르기 전에 [[⌃⇧]]를 잡고 있으면 포인터가 대신 페이드 도구가 됩니다(“페이드와 크로스페이드” 참고).'),
    art: fig('modemenu', { w: 60 }) +
      draw(96, 46,
        D.txt(0, 4, 'shuffle: a region moved between two others', '셔플: 두 리전 사이로 옮긴 리전', 's') +
        D.txt(0, 11, 'before', '전', 'xs') + reg(0, 13, 26, 9) + reg(26, 13, 30, 9) + reg(56, 13, 22, 9, 'blf') + D.arrow([[67, 12], [67, 8], [26, 8], [26, 12]]) +
        D.txt(0, 31, 'after', '후', 'xs') + reg(0, 33, 26, 9) + reg(26, 33, 22, 9, 'blf') + reg(48, 33, 30, 9) + D.txt(0, 45.5, 'what stood after makes room; the gap it left has closed', '뒤에 있던 것이 자리를 내주고, 떠난 자리는 닫힙니다', 'xs')) }),

  page(t('nudge, and going to the sound', '넛지, 그리고 소리로 가기'), { kind: 'split', tw: 164, txt:
    cols(2,
      h('nudge', '넛지') +
      table(null,
        ['[[⌥←]] [[⌥→]]', ['what is chosen goes one nudge earlier, later. With nothing chosen the playhead moves. Held down, it repeats', '선택한 것을 넛지 한 번만큼 앞으로, 뒤로. 선택이 없으면 플레이헤드가 움직입니다. 누르고 있으면 반복']],
        ['[[⌥⇧←]] [[⌥⇧→]]', ['shorter, longer by one nudge', '넛지 한 번만큼 짧게, 길게']]) +
      p('How far one nudge goes is shown in the transport panel. Click it for the list; each value has a key.', '넛지 한 번의 거리는 트랜스포트 패널에 나옵니다. 클릭하면 목록이 열리고 값마다 키가 있습니다.') +
      table([['value', '값'], ['key', '키'], ['length', '길이']],
        ['{{bar}}', '[[⌥⇧M]]', ['one bar', '한 마디']],
        ['{{beat}}', '[[⌥⇧B]]', ['one beat of the measure', '박자의 한 박']],
        ['{{1/16}}', '[[⌥⇧S]]', ['a sixteenth note', '16분음표']],
        ['{{10 ticks}}', '[[⌥⇧T]]', ['a tick is 1/960 of a quarter note', '1틱은 4분음표의 1/960']],
        ['{{tick}}', '[[⌥⇧Q]]', ['', '']],
        ['{{10 ms}}', '[[⌃⌥0]]', ['whatever the tempo', '템포와 무관']],
        ['{{1 ms}}', '[[⌃⌥1]]', ['', '']],
        ['{{sample}}', '[[⌃⌥S]]', ['one sample', '샘플 하나']]),
      h('to the next beginning', '다음 시작점으로') +
      table(null,
        ['[[tab]] [[⌥tab]]', ['the playhead goes to the next, the last place where something begins: a region’s edge, or a beginning the app heard inside a file (a transient)', '플레이헤드가 다음, 이전 시작점으로 갑니다. 리전의 가장자리, 또는 앱이 파일 안에서 들은 시작점(트랜지언트)']],
        ['[[⇧tab]] [[⌥⇧tab]]', ['a marquee from the playhead to that place', '플레이헤드에서 그곳까지 마키']],
        ['[[⌃.]] [[⌃,]]', ['the same as [[tab]] [[⌥tab]]', '[[tab]] [[⌥tab]]와 같음']]) +
      p('It looks on the tracks under the marquee, else the tracks of the chosen regions, else the chosen audio tracks.', '마키 아래 트랙, 없으면 선택한 리전의 트랙, 그것도 없으면 선택한 오디오 트랙에서 찾습니다.') +
      h('other moves of the playhead', '플레이헤드의 다른 이동') +
      table(null,
        ['[[↩]]', ['to the start', '처음으로']],
        ['[[⌥↩]]', ['to the end of the last sound', '마지막 소리의 끝으로']],
        ['[[⌃home]] [[⌃end]]', ['to where what is chosen begins, ends', '선택한 것의 시작, 끝으로']],
        ['[[⇧space]]', ['play what is chosen from its start', '선택한 것을 처음부터 재생']],
        ['[[⌃⇧,]] [[⌃⇧.]]', ['to the cycle’s start, end', '사이클의 시작, 끝으로']]) +
      note('[[D]], [[G]], [[[]], [[]]], [[;]], [[⌘T]] and [[⌘V]] read the playhead where it is at that moment, so they work while the song runs.', '[[D]], [[G]], [[[]], [[]]], [[;]], [[⌘T]], [[⌘V]]는 그 순간의 플레이헤드 위치를 읽으므로 재생 중에도 동작합니다.')),
    art: fig('nudgelist', { w: 64 }) }),

  page(t('what a region carries', '리전이 지니는 것'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['how', '방법'], ['values', '값'], ['notes', '참고']],
      [['gain', '게인'], ['[[⌃⇧↑]] [[⌃⇧↓]] by 1 dB, [[⌃⌥⇧↑]] [[⌃⌥⇧↓]] by 0.1 dB; drag the {{gain}} field; the gain tool. Double-click the field, or ((Region > Gain > Back to 0 dB)), for 0', '[[⌃⇧↑]] [[⌃⇧↓]] 1 dB씩, [[⌃⌥⇧↑]] [[⌃⌥⇧↓]] 0.1 dB씩. {{gain}} 칸 드래그. 게인 도구. 칸을 더블 클릭하거나 ((Region > Gain > Back to 0 dB))로 0'], ['−30 to +12 dB in tenths', '−30~+12 dB, 0.1 단위'], ['One value for the whole region; the drawn sound grows with it. On notes, gain is how hard they are played.', '리전 전체에 값 하나. 그려진 소리도 함께 커집니다. 노트에서는 연주 세기입니다.']],
      [['pitch', '피치'], ['[[⌥↑]] [[⌥↓]] a semitone, [[⌥⇧↑]] [[⌥⇧↓]] an octave; drag the {{transpose}} field', '[[⌥↑]] [[⌥↓]] 반음, [[⌥⇧↑]] [[⌥⇧↓]] 옥타브. {{transpose}} 칸 드래그'], ['−24 to +24 semitones, whole steps', '−24~+24 반음, 정수 단위'], ['The app renders the file anew: “rendering”, then “rendered”. Length is kept.', '앱이 파일을 다시 만듭니다. “rendering” 뒤에 “rendered”. 길이는 유지됩니다.']],
      [['fine tune', '미세 조정'], ['drag the {{fine}} field ([[⇧]] for finer steps). Double-click the field for 0, or ((Region > Transpose > Fine Tune Up 10 Cents)) and ((Fine Tune Down 10 Cents)). ((Region > Transpose > Back to the Original Pitch)) puts transpose and fine tune back to 0', '{{fine}} 칸 드래그([[⇧]]를 누르면 더 잘게). 칸을 더블 클릭하면 0. ((Region > Transpose > Fine Tune Up 10 Cents)), ((Fine Tune Down 10 Cents))로도 됩니다. ((Region > Transpose > Back to the Original Pitch))는 트랜스포즈와 미세 조정을 0으로 되돌립니다'], ['−100 to +100 cents, on top of the transpose', '−100~+100 센트, 트랜스포즈에 더해짐'], ['Sound only, not notes. Rendered with the transpose, length kept; the region’s name shows “+15 ct”.', '오디오만, 노트는 아님. 트랜스포즈와 함께 렌더링되고 길이는 그대로. 리전 이름에 “+15 ct”가 붙습니다.']],
      [['reverse', '리버스'], ['[[⌃⇧R]]', '[[⌃⇧R]]'], ['on, off', '켜기, 끄기'], ['The same stretch of the file, backwards. Its rubato pins are dropped.', '파일의 같은 구간을 거꾸로. 루바토 핀은 없어집니다.']],
      [['strip silence', '무음 제거'], ['[[⌃X]] ((Region > Strip Silence)) opens its band in the foot; ((Region > Strip Silence in Whole Bars)) opens it in whole bars. [[↩]] (or [[⌃X]] again) strips, [[esc]] leaves. Typed: `strip the empty bars`, `strip silence -50 db`', '[[⌃X]] ((Region > Strip Silence))로 아래 띠가 열립니다. ((Region > Strip Silence in Whole Bars))는 마디째로 엽니다. [[↩]](또는 [[⌃X]] 한 번 더)로 자르고, [[esc]]로 닫습니다. 입력: `strip the empty bars`, `strip silence -50 db`'], ['{{each silence}}: {{threshold}} −40 dB, {{shortest}} 0.30 s, {{before}} 10 ms, {{after}} 60 ms, {{zero crossings}}. {{whole bars}}: {{threshold}}, {{empty bars}} at least 1, {{after}}. Pull a value up or down; press it twice to type; ⌥ press for where it starts', '{{each silence}}: {{threshold}} −40 dB, {{shortest}} 0.30초, {{before}} 10 ms, {{after}} 60 ms, {{zero crossings}}. {{whole bars}}: {{threshold}}, {{empty bars}} 최소 1, {{after}}. 값은 위아래로 끌고, 두 번 눌러 입력하고, ⌥ 누르면 처음 값'], ['While the band is up the lanes show the pieces that would stay, inside a dashed frame, and the band says how many. Each silence: a quiet stretch of the shortest length or more is taken out, each piece a little early and late, cut where the sound crosses zero. Whole bars: what sounds stays whole (eight bars of hi-hat are one region) and only empty bars go, cut on the bar lines, or on the beat line beyond where a sound leans over one. What was stripped with is remembered.', '띠가 열려 있는 동안 레인에 남을 조각이 점선 틀 안에 보이고, 띠에 조각 수가 나옵니다. 무음마다: 가장 짧은 길이 이상 조용한 구간을 걷어내고, 조각은 조금 일찍 시작해 조금 늦게 끝나며 소리가 0을 지나는 곳에서 잘립니다. 마디째: 소리 나는 부분은 통째로 남고(하이햇 8마디는 리전 하나) 빈 마디만 마디선에서 잘려 나갑니다. 소리가 마디선을 살짝 넘으면 그 너머 박자선에서 자릅니다. 자를 때 쓴 값은 기억됩니다.']],
      [['bounce in place', '제자리 바운스'], ['[[⌃B]]', '[[⌃B]]'], ['', ''], ['The chosen regions are printed through the patch and plug-ins onto a new track; the originals are muted. See “hand off and bounce”.', '선택한 리전을 패치와 플러그인을 거쳐 새 트랙에 찍습니다. 원본은 뮤트됩니다. “내보내기와 바운스” 참고.']],
      [['colour, outline', '색, 모양'], ['the colour beside what is chosen, in the transport panel', '트랜스포트 패널에서 선택된 것 옆의 색'], ['', ''], ['See “tracks”.', '“트랙” 장 참고.']]) +
    note('Reverse, follow the tempo, the tempo commands and strip silence are for files of sound: they skip regions of notes.', '리버스, 템포 따라가기, 템포 명령, 무음 제거는 소리 파일을 위한 것이며 노트 리전은 건너뜁니다.') }),

  page(t('a region and the tempo', '리전과 템포'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['how', '방법'], ['values', '값'], ['notes', '참고']],
      [['follow the tempo', '템포 따라가기'], ['[[⌃F]]', '[[⌃F]]'], ['on, off', '켜기, 끄기'], ['On: when the tempo moves, the file keeps its bars and is stretched, pitch kept. Off, as a file comes in: it keeps its length in seconds.', '켜면 템포가 바뀔 때 파일이 마디 수를 유지하며 늘어납니다. 피치는 그대로. 끄면(가져올 때의 기본) 초 단위 길이를 유지합니다.']],
      [['a file’s own tempo', '파일 자체의 템포'], ['shown as {{bpm}} in the transport panel once known. Click the number to type it', '알게 되면 트랜스포트 패널에 {{bpm}}으로 표시. 숫자를 클릭해 입력'], ['30 to 300', '30~300'], ['The app cannot tell a tempo from its double or half; type it right when it is wrong.', '앱은 템포와 그 두 배, 절반을 구별하지 못합니다. 틀렸으면 직접 입력하세요.']],
      [['song to file', '곡을 파일에 맞추기'], ['[[⌃⌥T]] ((Region > Tempo > Set Project Tempo from Region))', '[[⌃⌥T]] ((Region > Tempo > Set Project Tempo from Region))'], ['40 to 240', '40~240'], ['The song takes the tempo of the first chosen file.', '곡이 선택한 첫 파일의 템포를 따릅니다.']],
      [['file to song', '파일을 곡에 맞추기'], ['[[⌃⌥F]] ((Region > Tempo > Fit Region to Project Tempo))', '[[⌃⌥F]] ((Region > Tempo > Fit Region to Project Tempo))'], ['', ''], ['The chosen files are stretched so their own beat is the song’s, and follow the tempo from then on. Only files between half and twice the song’s tempo.', '선택한 파일을 늘려 자체 박을 곡에 맞추고, 이후로는 템포를 따라갑니다. 곡 템포의 절반에서 두 배 사이인 파일만.']]) }),

  page(t('rubato and quantize', '루바토와 퀀타이즈'), { kind: 'split', tw: 112, mid: true, txt:
    p('Rubato is time that gives and takes; each region has its own. [[⌘F]] or {{rubato}} turns it on or off for the chosen regions (none chosen: shows the view); in the view, so does the square at a region’s foot. Off, a region plays as it is and keeps its pins. Where it is on, faint marks show where something begins, as the app heard it: a line is a __hit__ (something struck), a dotted line a __note__ (the pitch changed without anything struck: a slur, a voice going to its next note). Bright lines with a small head are pins.', '루바토는 박을 당기고 늦추는 시간이고, 리전마다 따로 켭니다. 리전을 고르고 [[⌘F]]나 {{rubato}} 칸을 누르면 그 리전들만 루바토가 켜지거나 꺼지고 루바토 보기가 열립니다. 아무것도 고르지 않았으면 보기만 열고 닫습니다. 보기에서는 리전 아래쪽의 작은 네모로 켜고 끕니다. 끄면 원래대로 재생되고 핀은 나중을 위해 남겨 둡니다. 루바토가 켜진 리전에는 앱이 들은 시작점이 흐리게 표시됩니다. 실선은 __히트__(무언가를 친 곳), 점선은 __음 변화__(치지 않고 음정만 바뀐 곳: 슬러, 다음 음으로 넘어가는 목소리)입니다. 작은 머리가 달린 밝은 선이 핀입니다.') +
    p('How many marks a region shows is its track’s: the rails {{hits}} and {{notes}} on the bar, 0 to 100 (70 and 60 at first). To the right, more of them; [[⌥]] and a press sets one back. Nothing is listened to again.', '리전에 표시가 몇 개 보일지는 트랙마다 정합니다. 바의 {{hits}}와 {{notes}} 레일, 0~100(처음엔 70과 60). 오른쪽으로 갈수록 더 많이 보입니다. [[⌥]]를 누른 채 누르면 처음 값으로 돌아갑니다. 다시 분석하지 않습니다. 앱은 모든 위치를 한 번 듣고 얼마나 확실한지까지 기억합니다.') +
    h('pins', '핀') +
    table(null,
      [['make, move', '만들기, 옮기기'], ['with the pointer or the smart tool, drag from a mark or a pin; with the rubato tool, press anywhere in a region. While the pin moves the sound is drawn as it will be', '포인터나 스마트 도구로 표시나 핀에서 드래그. 루바토 도구로는 리전 어디든 누르면 됩니다. 핀을 움직이는 동안 바뀐 파형이 그대로 그려집니다']],
      [['what moves', '움직이는 것'], ['a new pin also pins the nearest mark on either side, so only what lies between them is stretched', '새 핀은 양옆의 가장 가까운 표시도 함께 고정하므로 그 사이만 늘어납니다']],
      [['limits', '한계'], ['a stretch cannot be squeezed below a quarter nor pulled beyond four times', '구간은 4분의 1보다 줄일 수 없고 4배보다 늘릴 수 없습니다']],
      [['double-click', '더블 클릭'], ['on a pin: it lets go. Where there is none: a pin that holds', '핀 위: 풀림. 핀이 없는 곳: 그 자리를 잡는 핀']],
      [['let all go', '모두 풀기'], ['[[⌥⌘Q]] for the chosen regions', '선택한 리전에 [[⌥⌘Q]]']]) +
    h('quantize', '퀀타이즈') +
    p('[[Q]] pulls every place shown in the chosen files to the nearest line of the quantize value, and says how many: “12 pulled to 1/16”. The value is set from the key beside {{quantize}}: 1/4, 1/8, 1/8 triplet, 1/16, 1/16 triplet, 1/32.', '[[Q]]는 선택한 파일에 표시된 모든 위치를 퀀타이즈 값의 가장 가까운 선으로 당기고 개수를 알려 줍니다. “12 pulled to 1/16”. 값은 {{quantize}} 옆 키로 정합니다. 1/4, 1/8, 1/8 triplet, 1/16, 1/16 triplet, 1/32.') +
    note('For files, quantize is all the way or not at all (regions of notes have strength and swing). Pieces of one take, and the tracks of a group sharing rubato, share their pins: a kit’s microphones stay in step.', '파일의 퀀타이즈는 끝까지 당기거나 안 당기거나입니다. 강도나 스윙은 없습니다(노트 리전에는 둘 다 있습니다. “노트와 악기” 참고). 한 레인 위 같은 테이크의 조각들과, 루바토를 함께 하는 그룹의 트랙들은 핀을 공유하므로 드럼 한 세트의 여러 마이크가 어긋나지 않습니다.'),
    art: draw(140, 86,
      D.txt(0, 4, 'a file region in the rubato view', '루바토 보기의 파일 리전', 's') +
      reg(4, 10, 132, 26) +
      [14, 30, 63, 82, 98, 116].map(x => D.line(x, 10, x, 36, 'soft')).join('') + `<path d="M49 10V36" class="soft" stroke-dasharray="1.2 1"/>` +
      // pins
      [30, 63, 98].map(x => D.line(x, 10, x, 36, 'thick') + `<path d="M${x - 1.6} 10H${x + 1.6}L${x} 12.6Z" class="dd"/>`).join('') +
      D.txt(14, 42, 'a hit the app heard', '앱이 들은 히트', 'xs m') + D.txt(49, 42, 'a note', '음 변화', 'xs m') + D.txt(30, 46.5, 'a pin', '핀', 'xs m') + D.line(30, 36, 30, 44, 'soft') +
      // after dragging the middle pin
      D.txt(0, 56, 'the middle pin dragged later: only what lies between its neighbours is stretched', '가운데 핀을 뒤로 드래그: 양옆 핀 사이만 늘어납니다', 's') +
      reg(4, 60, 132, 20) +
      [14, 30, 52, 72, 86, 98, 116].map(x => D.line(x, 60, x, 80, 'soft')).join('') +
      [30, 98].map(x => D.line(x, 60, x, 80, 'thick') + `<path d="M${x - 1.6} 60H${x + 1.6}L${x} 62.6Z" class="dd"/>`).join('') +
      D.line(72, 60, 72, 80, 'bl thick') + `<path d="M70.4 60H73.6L72 62.6Z" class="dd bl"/>` +
      D.arrow([[63, 57.5], [71, 57.5]]) +
      D.txt(51, 85, 'longer', '길게', 'xs m blue') + D.txt(85, 85, 'shorter', '짧게', 'xs m blue')) }),

  page(t('how a track is stretched', '트랙을 늘이는 방식'), { kind: 'text', cc: 2, txt:
    p('Each track is stretched one way, chosen in the rubato view from the key beside {{stretch}} on the bar while one of its regions is chosen (Logic’s name for each in grey), or at the left of the rubato panel. The tracks of a group that shares rubato take the same way. A region played backwards, and a loop, are always stretched as {{chords}}.', '트랙마다 늘이는 방식이 하나 있습니다. 루바토 보기에서 그 트랙의 리전을 선택한 채 바의 {{stretch}} 옆 키에서 고르거나, 루바토 패널 왼쪽에서 고릅니다(회색 글씨는 로직에서의 이름). 루바토를 함께 하는 그룹의 트랙은 같은 방식을 따릅니다. 거꾸로 재생하는 리전과 루프는 항상 {{chords}}로 늘입니다.') +
    table(null,
      ['{{chords}}', ['anything; every pitch is kept (polyphonic). What a track has until another is chosen', '무엇이든. 모든 음정을 지킵니다(polyphonic). 다른 방식을 고르기 전까지의 기본값']],
      ['{{voice}}', ['one line: a voice, a bass, a solo (monophonic). The beginning of each hit as it was; the rest stretched from stretches of itself that agree with what was just played, so it keeps its pitch and its colour', '한 줄: 목소리, 베이스, 솔로(monophonic). 히트의 시작은 그대로 두고, 나머지는 방금 연주된 것과 잘 맞는 자기 소리 조각을 이어 붙여 늘입니다. 음정과 음색이 유지됩니다']],
      ['{{cut}}', ['cut at each hit, never stretched: drums (slicing). Each piece plays at its own speed from where the map puts it; with room left over, a silence follows it', '히트마다 자르고 늘이지 않습니다: 드럼(slicing). 조각마다 제 속도로, 맵이 정한 자리에서 재생됩니다. 자리가 남으면 뒤가 조용합니다']],
      ['{{beat}}', ['each hit as played, the gap after it held: rhythm guitars, keys (rhythmic). Like cut, but the room left over is filled with the end of the piece, played again', '히트는 연주한 그대로, 그 뒤 빈자리는 이어서: 리듬 기타, 건반(rhythmic). cut과 같지만 남는 자리를 조각의 끝부분을 반복해 채웁니다']]) +
    note('cut, beat and voice cut where the hits are shown: turning {{hits}} up or down changes where they cut, and the track is rendered again when the rail is let go.', 'cut, beat, voice는 표시된 히트에서 자릅니다. {{hits}}를 올리거나 내리면 자르는 위치가 바뀌고, 레일에서 손을 떼면 트랙이 다시 렌더링됩니다.') }),

  page(t('the rubato panel', '루바토 패널'), { kind: 'split', tw: 112, mid: true, txt:
    p('[[W]], or ((Window > Rubato Panel)), opens the bottom panel on its {{rubato}} page; [[W]] again closes it. It shows the chosen region of sound close up, as it is played and as it was recorded.', '[[W]]나 ((Window > Rubato Panel))은 하단 패널을 {{rubato}} 페이지로 엽니다. [[W]]를 다시 누르면 닫힙니다. 선택한 소리 리전을 크게, 연주되는 대로와 녹음된 대로 함께 보여 줍니다.') +
    table(null,
      [['{{as played}}', '{{as played}}'], ['above: the sound as the pins have it, its pins, its marks and the lines of the quantize value. Under a hit that is not on its line, how far from it, in ms', '위: 핀대로의 소리, 핀, 표시, 퀀타이즈 값의 선. 선 위에 있지 않은 히트 아래에는 선에서 몇 ms 떨어졌는지']],
      [['{{as recorded}}', '{{as recorded}}'], ['below: the file itself, each mark where it is in it', '아래: 파일 그대로, 표시는 파일 속 제자리에']],
      [['the lines between', '사이의 선'], ['from each mark below to where it is played above: upright where nothing moved, leaning where it did, in the track’s colour', '아래 표시에서 위의 연주 위치까지: 안 움직였으면 곧게, 움직였으면 트랙 색으로 기울어']]) +
    h('in it', '패널에서 하는 일') +
    table(null,
      [['a pin', '핀'], ['drag a mark or a pin above, as on the lanes (the rubato tool: anywhere); press a pin twice to let it go', '레인에서처럼 위쪽의 표시나 핀을 드래그(루바토 도구로는 어디든). 핀을 두 번 누르면 풀립니다']],
      [['at the left', '왼쪽'], ['how the track is stretched, {{hits}} and {{notes}}, {{quantize}}, {{let go of every pin}}', '트랙을 늘이는 방식, {{hits}}와 {{notes}}, {{quantize}}, {{let go of every pin}}']],
      [['closer, further', '확대, 축소'], ['[[⌘]] and the wheel; the wheel alone goes along; {{fit}} shows all of it again', '[[⌘]]와 휠. 휠만 쓰면 옆으로 갑니다. {{fit}}을 누르면 전체가 다시 보입니다']]),
    art: draw(140, 86,
      D.txt(0, 4, 'as played', '연주되는 소리', 's') +
      reg(4, 8, 132, 26) +
      [14, 30, 52, 72, 86, 98, 116].map(x => D.line(x, 8, x, 34, 'soft')).join('') +
      [30, 98].map(x => D.line(x, 8, x, 34, 'thick') + `<path d="M${x - 1.6} 8H${x + 1.6}L${x} 10.6Z" class="dd"/>`).join('') +
      D.line(72, 8, 72, 34, 'bl thick') + `<path d="M70.4 8H73.6L72 10.6Z" class="dd bl"/>` +
      D.txt(73.5, 32, '+18', '+18', 'xs m blue') +
      // the lines between: upright, and leaning where it moved
      [14, 30, 98, 116].map(x => D.line(x, 36, x, 48, 'soft')).join('') +
      D.line(63, 48, 72, 36, 'bl thick') + D.line(49, 48, 52, 36, 'bl') + D.line(82, 48, 86, 36, 'bl') +
      D.txt(0, 52, 'as recorded', '녹음된 소리', 's') +
      reg(4, 56, 132, 22) +
      [14, 30, 49, 63, 82, 98, 116].map(x => D.line(x, 56, x, 78, 'soft')).join('') +
      D.txt(100, 84, 'leaning: it moved', '기울면: 움직인 것', 'xs m blue')) }),
])
