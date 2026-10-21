import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('mixing', t('mixing', '믹싱'),
  t('The mixer page, the way the sound takes through a track, where tracks play and send, and how mute, solo and the meters read.', '믹서 페이지, 소리가 트랙을 지나는 길, 트랙이 나가는 곳과 센드, 그리고 뮤트, 솔로, 미터가 읽는 방식.'), [

  page(t('the mixer', '믹서'), { kind: 'wide', cc: 3, txt:
    p('{{mixer}} [[X]] shows every track on one screen, each as large as there is room for, the transport panel up or not. When they no longer fit, the tracks chosen in the arrangement stay wide and the rest go narrower: with room, the number and name, pan, the fader and its level, the shapes, and how many plug-ins and sends (click: the patch, or the strip opened); with less, a large number, the name on its side, two meters and the handle. Scroll over the mixer to move along it when not all of them fit. Choose a track above and its strip opens here. Past about sixty tracks a row of their numbers runs along the top; click one to choose that track and bring it into sight.', '{{mixer}} [[X]]는 트랜스포트 패널이 있든 없든 모든 트랙을 한 화면에, 자리가 허락하는 만큼 크게 보여줍니다. 다 들어가지 않으면 편곡 화면에서 고른 트랙만 넓게 남고 나머지는 좁아집니다: 자리가 있으면 번호와 이름, 팬, 페이더와 레벨, 도형, 플러그인과 센드 수(누르면 패치, 또는 스트립이 펴짐), 더 좁으면 큰 번호, 옆으로 눕힌 이름, 미터 두 개와 손잡이. 다 들어가지 않을 때는 믹서 위에서 스크롤해 옆으로 움직입니다. 위에서 트랙을 고르면 여기서 그 스트립이 펴집니다. 60트랙쯤을 넘으면 맨 위에 번호 줄이 생기고, 번호를 누르면 그 트랙이 골라지고 화면에 들어옵니다.') +
    table(null,
      [1, ['the track’s number in its colour (chosen: on a block of ink) and its name. Click to choose it', '트랙 번호(트랙 색, 고르면 반전)와 이름. 클릭하면 선택']],
      [2, ['{{pan}} a knob: drag up or down', '{{pan}} 노브: 위아래로 드래그']],
      [3, ['the patch as a list of names: click one for its window, [[⌥]] drag to copy it; + plug-in opens the list', '패치를 이름 목록으로: 누르면 창이 열리고, [[⌥]] 드래그로 복사. + plug-in은 목록을 엽니다']]) +
    table(null,
      [4, ['the sends: round knobs beside the fader, the bus each goes to under it; with the pointer on a knob, how much it sends instead. Drag up or down; click to choose where it goes. The + knob adds one. A full column of knobs makes the strip wider by another, up to ten sends', '센드: 페이더 오른쪽의 동그란 노브, 아래에 보내는 버스 이름. 포인터를 올리면 대신 보내는 양이 나옵니다. 위아래로 드래그, 클릭하면 어디로 보낼지 고릅니다. + 노브로 추가. 노브 한 줄이 다 차면 스트립이 한 줄 더 넓어지고, 센드는 10개까지']],
      [5, ['two meters, left and right, in the track’s colour; the fader’s line, the white square for a handle, the level beside it (double-click to type)', '왼쪽 오른쪽 미터 두 개(트랙 색), 페이더 선, 흰 사각형 손잡이, 옆에 레벨(더블 클릭해서 입력)']],
      [6, ['record, monitor, mute, solo: a ring, a diamond, a square, a triangle, filled when on. Under them where the track goes', '녹음, 모니터, 뮤트, 솔로: 원, 마름모, 사각형, 삼각형, 켜지면 채워집니다. 그 아래 트랙이 나가는 곳']]),
    art: fig('mixpanel', { w: 214, calls: [[1, 'msel', 't'], [2, 'mpan', 't'], [3, 'mfxadd', 't'], [4, 'msendadd', 'r'], [5, 'mvol', 'b'], [6, 'mute', 'b']] }) }),

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
