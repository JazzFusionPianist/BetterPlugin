import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('mixing', t('mixing', '믹싱'),
  t('The mixer page, the way the sound takes through a track, where tracks play and send, and how mute, solo and the meters read.', '믹서 페이지, 소리가 트랙을 지나는 길, 트랙이 나가는 곳과 센드, 그리고 뮤트, 솔로, 미터가 읽는 방식.'), [

  page(t('the mixer', '믹서'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '{{fx}} the patch, one to a row: a square of its colour and its name, faint when off. + opens the list; [[⌥]] drag copies one', '{{fx}} 패치, 한 줄에 하나. 색 네모와 이름(꺼지면 흐림). +는 목록을 열고, [[⌥]] 드래그는 복사'],
      [2, '{{send}} its letter and a bar filled as far as it sends; + adds one', '{{send}} 글자와 보내는 만큼 채워지는 막대. +로 추가'],
      [3, '{{out}} where the track plays: the stereo out, a bus, or its stack', '{{out}} 트랙이 나가는 곳: 스테레오 아웃, 버스, 또는 스택'],
      [4, '{{pan}} click or drag; it catches at the middle', '{{pan}} 클릭하거나 드래그. 가운데에서 걸립니다'],
      [5, 'the fader and two meters in the track’s colour. The scale reads +6, 0, −6, −12, −24, −∞', '페이더와 트랙 색 미터 두 개. 눈금은 +6, 0, −6, −12, −24, −∞'],
      [6, 'the level in dB. Double-click to type it', '레벨 dB 값. 더블 클릭하면 입력'],
      [7, '{{r}} {{i}} {{m}} {{s}} as small squares, filled when on, as on the track head', '{{r}} {{i}} {{m}} {{s}}, 켜지면 채워지는 작은 네모. 트랙 헤드와 같습니다'],
      [8, 'the name: click to choose the track, [[⇧]] click for a range, [[⌘]] click to add or take one out, double-click to rename, right-click for the track menu', '이름: 클릭하면 트랙 선택, [[⇧]] 클릭은 범위, [[⌘]] 클릭은 더하거나 빼기, 더블 클릭은 이름 바꾸기, 오른쪽 클릭은 트랙 메뉴'],
      [9, 'the stereo out: a fader and meters. Click its name for its own patch, {{out 1-2}} for the audio settings', '스테레오 아웃: 페이더와 미터. 이름을 클릭하면 자체 패치가, {{out 1-2}}를 클릭하면 오디오 설정이 열립니다']) +
    table(null,
      [['fader', '페이더'], ['drag; it moves from where it stands. −∞ to +6 dB, landing on 0 when near. Double-click or [[⌥]] click: 0 dB', '드래그. 서 있는 자리에서 움직입니다. −∞~+6 dB, 0 근처에서는 0에 붙습니다. 더블 클릭이나 [[⌥]] 클릭: 0 dB']],
      [['pan', '팬'], ['goes to the pointer; with [[⇧]] finely from where it is. Double-click: centre', '포인터 위치로 갑니다. [[⇧]]를 누르면 지금 자리에서 미세하게. 더블 클릭: 가운데']],
      [['send', '센드'], ['drag left and right for its level; a click without moving asks where it goes, or {{no send}}', '좌우로 드래그하면 레벨. 움직이지 않고 클릭하면 보낼 곳을 묻습니다. {{no send}}도 여기']]) +
    p('One strip for every row of the track list, in the same order; the tracks of a closed stack are not shown. Scroll over the mixer to move along it. When the strip you act on is one of several chosen, the fader, pan, {{m}}, {{s}}, {{r}}, {{i}} and the input act on all of them. The tracks of a group that shares volume, mute or solo move with it as well (see “groups”).', '트랙 목록의 줄마다 스트립 하나, 같은 순서입니다. 닫힌 스택 안의 트랙은 보이지 않습니다. 믹서 위에서 스크롤하면 스트립이 옆으로 움직입니다. 조작하는 스트립이 여러 선택 중 하나면 페이더, 팬, {{m}}, {{s}}, {{r}}, {{i}}, 입력은 모두에게 적용됩니다. 볼륨, 뮤트, 솔로를 함께 하는 그룹의 트랙도 같이 움직입니다(“그룹” 참고).'),
    art: fig('mixer', { w: 232, calls: [[1, 'mfxadd#2', 't'], [2, [16, 54], 'l'], [3, [14, 102], 'l'], [4, 'mpan#3', 't'], [5, 'mvol#7', 't'], [6, 'volnum#2', 'b'], [7, 'mute#8', 'b'], [8, 'msel#8', 'b', 3], [9, 'mmaster', 't']] }) }),

  page(t('the way the sound takes', '소리가 지나는 길'), { kind: 'split', tw: 92, mid: true, txt:
    lead('Every track works the same way, whatever it holds.', '트랙은 무엇을 담든 같은 방식으로 동작합니다.') +
    legend(
      [1, '__what comes in__ an audio track’s regions, plus the live input when {{i}} is on; a track of notes adds its instrument; a bus or stack takes what plays or sends into it', '__들어오는 것__ 오디오 트랙의 리전, 그리고 {{i}}가 켜져 있으면 라이브 입력. 노트 트랙은 악기 소리. 버스나 스택은 그리로 나가거나 보내는 것'],
      [2, '__the patch__ the track’s wall: prints and plug-ins, the way you wired them (see “the patch”). Up to sixteen on a wall', '__패치__ 트랙의 벽. 프린트와 플러그인을 이은 그대로 지나갑니다(“패치” 참고). 벽 하나에 열여섯 개까지'],
      [3, '__fader__, and silence when the track is muted or shut out by a solo', '__페이더__. 뮤트되거나 솔로에 밀리면 무음'],
      [4, '__pan__ a balance: at centre both sides pass unchanged', '__팬__ 밸런스 방식: 가운데에서는 양쪽이 그대로 통과'],
      [5, '__sends__ taken after fader and pan, so a send follows the fader and the mute', '__센드__ 페이더와 팬 뒤에서 나갑니다. 그래서 센드는 페이더와 뮤트를 따릅니다'],
      [6, '__the stereo out__ its own wall when something stands on it, then its fader, then a guard that pulls the level down whenever a peak would pass full scale, then the meter', '__스테레오 아웃__ 무언가 놓여 있으면 먼저 자체 벽을 지나고, 이어서 페이더, 피크가 풀 스케일을 넘으려 할 때 레벨을 끌어내리는 가드, 그리고 미터'],
      [7, '__the click__ added last. The out fader does not change it, and it is never in a bounce or a hand off', '__클릭__ 맨 마지막에 더해집니다. 아웃 페이더의 영향을 받지 않고, 바운스나 내보내기에 들어가지 않습니다']) +
    note('Plug-ins that make the sound late are made up for: each track is read early by as much as its own way to the out is late, and a shorter way is held back to match.', '소리를 늦게 만드는 플러그인은 보정됩니다. 각 트랙은 아웃까지 가는 길이 늦는 만큼 일찍 읽히고, 더 짧은 길은 그에 맞춰 늦춰집니다.'),
    art: draw(160, 104,
      D.txt(0, 4, 'one track', '트랙 하나', 'b') +
      D.cell(0, 12, 26, 10, 'regions', '리전') + D.cell(0, 26, 26, 10, 'live input', '라이브 입력', 'dash') + D.cell(0, 40, 26, 10, 'instrument', '악기', 'dash') +
      D.arrow([[26, 17], [36, 17], [36, 30]]) + D.line(26, 31, 36, 31) + D.line(26, 45, 36, 45) + D.line(36, 45, 36, 31) + D.arrow([[36, 31], [42, 31]]) + D.num(13, 8, 1) +
      D.cell(42, 22, 86, 18, '', '', 'tint') + D.txt(85, 28, 'the patch: its wall, wired as you wired it', '패치: 이은 그대로의 벽', 's m') +
      D.line(42, 34.5, 128, 34.5, 'soft') + [52, 68, 84, 100].map(x => D.box(x, 32, 9, 5, 'soft')).join('') + D.num(85, 17, 2) +
      D.arrow([[128, 31], [133, 31]]) + D.cell(133, 26, 12, 10, 'fader', '페이더') + D.num(139, 21, 3) +
      D.arrow([[145, 31], [148, 31]]) + D.cell(148, 26, 12, 10, 'pan', '팬') + D.num(154, 21, 4) +
      // out of the track
      D.arrow([[154, 36], [154, 62]]) + D.arrow([[154, 46], [124, 46], [124, 62]]) + D.num(138, 50, 5) +
      D.txt(0, 60, 'where it goes', '가는 곳', 'b') +
      D.cell(104, 62, 34, 10, 'a bus: sends', '버스: 센드') + D.cell(142, 62, 18, 10, 'out', 'out') + D.txt(151, 76, 'stack, bus or stereo out', '스택, 버스, 스테레오 아웃', 'xs m') +
      // stereo out
      D.txt(0, 86, 'the stereo out', '스테레오 아웃', 'b') +
      D.cell(0, 90, 18, 10, 'the sum', '합') + D.arrow([[18, 95], [22, 95]]) + D.cell(22, 90, 18, 10, 'its wall', '자체 벽', 'dash') + D.arrow([[40, 95], [44, 95]]) + D.cell(44, 90, 16, 10, 'fader', '페이더') + D.arrow([[60, 95], [64, 95]]) + D.cell(64, 90, 16, 10, 'guard', '가드') + D.arrow([[80, 95], [84, 95]]) + D.cell(84, 90, 16, 10, 'meter', '미터') + D.arrow([[100, 95], [116, 95]]) + D.cell(116, 90, 26, 10, 'outputs 1 and 2', '출력 1, 2', 'on') +
      D.cell(98, 76, 20, 8, 'click', '클릭', 'dash') + D.arrow([[108, 84], [108, 94]]) + D.num(52, 86, 6) + D.num(122, 80, 7)) }),

  page(t('routing, solo, meters', '라우팅, 솔로, 미터'), { kind: 'split', tw: 160, txt:
    cols(2,
      h('where a track plays', '트랙이 나가는 곳') +
      p('Click the {{out}} row of a strip: {{stereo out}}, every bus and stack it may play into, and {{new bus}}. Picking a stack puts the track into that stack. There is one stereo out, on the device’s outputs 1 and 2.', '스트립의 {{out}} 줄을 클릭합니다. {{stereo out}}, 나갈 수 있는 모든 버스와 스택, 그리고 {{new bus}}. 스택을 고르면 트랙이 그 스택 안으로 들어갑니다. 스테레오 아웃은 하나이고 장치의 출력 1, 2로 나갑니다.') +
      h('sends', '센드') +
      p('Up to ten to a track. When a strip is too short to show more of them, it grows wider to the right by a column of sends. A new send comes in at −12 dB. [[⌥]] click sets it to 0 dB. Sends are after the fader and the pan; there is no pre-fader send. Removing a bus removes every send into it.', '트랙마다 열 개까지. 스트립의 높이에 더 들어가지 않으면 스트립이 오른쪽으로 센드 한 줄만큼 넓어집니다. 새 센드는 −12 dB로 들어옵니다. [[⌥]] 클릭하면 0 dB. 센드는 페이더와 팬 뒤에서 나가며, 프리 페이더 센드는 없습니다. 버스를 지우면 그리로 가는 센드도 모두 없어집니다.') +
      h('buses', '버스') +
      p('A bus has a patch, a fader, a pan, up to ten sends and an out of its own. It may play into another bus or a stack, as long as nothing comes back round to itself. Make one with [[⌃N]], or pick {{new bus}} in an out or send list.', '버스는 자체 패치, 페이더, 팬, 센드 열 개까지, 아웃을 가집니다. 다른 버스나 스택으로 나갈 수 있지만, 돌아서 자기 자신에게 오는 길은 만들 수 없습니다. [[⌃N]]으로 만들거나, 아웃이나 센드 목록에서 {{new bus}}를 고릅니다.'),
      h('mute and solo', '뮤트와 솔로') +
      list(
        ['Mute: the track is silent, and so are its sends.', '뮤트: 트랙이 조용해지고 센드도 함께 조용해집니다.'],
        ['Solo: a soloed track sounds, even if it is also muted. What it plays or sends into stays open, and whatever plays into a soloed bus or stack stays open. Everything else is silent.', '솔로: 솔로인 트랙은 뮤트 상태여도 소리가 납니다. 그 트랙이 나가거나 보내는 곳은 열려 있고, 솔로인 버스나 스택으로 들어오는 것도 열려 있습니다. 나머지는 모두 조용해집니다.'],
        ['A track that cannot reach the speakers is drawn dim.', '스피커에 닿지 못하는 트랙은 흐리게 그려집니다.']) +
      h('meters', '미터') +
      list(
        ['Peak levels, read after the fader and the pan, on the fader’s own scale.', '피크 레벨. 페이더와 팬 뒤에서 읽고, 페이더와 같은 눈금을 씁니다.'],
        ['Plain up to −6 dB, yellow from −6 dB, red over 0 dB. A thin line holds the highest level and sinks slowly.', '−6 dB까지는 기본색, −6 dB부터 노랑, 0 dB를 넘으면 빨강. 가는 선이 최고 레벨에 머물렀다가 천천히 내려옵니다.'],
        ['The {{out}} meter on the control bar shows left and right apart, after the out fader and the guard.', '컨트롤 바의 {{out}} 미터는 아웃 페이더와 가드 뒤의 왼쪽, 오른쪽을 따로 보여 줍니다.']) +
      note('A fader, a pan, a send level, mute and solo moved by hand are not steps of undo, except a fader that moves a volume line: that is one step.', '손으로 움직인 페이더, 팬, 센드 레벨, 뮤트, 솔로는 실행 취소 단계가 아닙니다. 볼륨 라인을 움직이는 페이더는 예외로, 한 단계입니다.')),
    art: fig('outlist', { w: 88, calls: [[1, [258, 120], 'l'], [2, [258, 152], 'l'], [3, [258, 200], 'l'], [4, [392, 250], 'r']] }) +
      `<div style="width:88mm">` + legend(
        [1, '{{in}} on the wide strip beside the patch: the input', '패치 옆 넓은 스트립의 {{in}}: 입력'],
        [2, 'a send to the bus plate, at −18 dB', 'plate 버스로 가는 센드, −18 dB'],
        [3, '{{out}}', '{{out}}'],
        [4, 'the list it opens', '클릭하면 열리는 목록']) + `</div>` }),
])
