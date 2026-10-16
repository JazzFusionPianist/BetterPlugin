import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('window', t('the window', '창'),
  t('One window holds the whole song. This chapter names its parts, from the control bar at the top to the foot, and shows how to get around in it.', '창 하나에 곡 전체가 담깁니다. 맨 위 컨트롤 바에서 맨 아래 줄까지 각 부분의 이름을 붙이고, 그 안에서 돌아다니는 방법을 보여 줍니다.'), [

  page(t('the window at a glance', '한눈에 보는 창'), { kind: 'split', tw: 88, txt:
    legend(
      [1, '__control bar__ transport, the display (position, time, tempo, measure, key, nudge, grid), the output level', '__컨트롤 바__ 패널, 트랜스포트, 디스플레이(위치, 시간, 템포, 박자, 키, 넛지, 그리드), 출력 레벨'],
      [2, '__the tracks’ bar__ new track, the two views, the tool, the mode, and what is chosen', '__트랙 바__ 새 트랙, 두 가지 보기, 도구, 모드, 선택된 것'],
      [3, '__markers__ the parts of the song, one cell each', '__마커__ 곡의 파트, 파트마다 칸 하나'],
      [4, '__bars__ the cycle on its upper strip, the playhead on its lower', '__마디 눈금__ 위쪽 띠에는 사이클, 아래쪽 띠에는 플레이헤드'],
      [5, '__track heads__ name, record, input, mute, solo, level', '__트랙 헤드__ 이름, 녹음, 입력, 뮤트, 솔로, 레벨'],
      [6, '__lanes__ the regions of each track', '__레인__ 트랙마다의 리전'],
      [7, '__playhead__', '__플레이헤드__'],
      [8, '__cycle__ yellow when on', '__사이클__ 켜지면 노란색'],
      [9, '__command line__ type what you want done', '__커맨드 라인__ 할 일을 글로 입력'],
      [10, '{{keys}} every key command on one sheet', '{{keys}} 모든 단축키를 한 장에']) +
    p('Under the lanes a panel opens for the {{patch}} [[B]] or the {{mixer}} [[X]], and at the right the Slur panel [[O]]; the Mac’s ((Window)) menu opens each of them too. {{hand off}} (stems, the mix, out to a folder) comes up in the middle of the window from ((File > Hand Off…)) [[⌘B]]. The window is never smaller than 1100 by 668 and opens as large as the screen allows.', '레인 아래에는 {{patch}} [[B]]나 {{mixer}} [[X]] 패널이, 오른쪽에는 Slur 패널 [[O]]이 열립니다. 맥의 ((Window)) 메뉴로도 열 수 있습니다. {{hand off}}(스템, 믹스를 폴더로)는 ((File > Hand Off…)) [[⌘B]]로 창 가운데에 뜹니다. 창은 1100 x 668보다 작아지지 않고, 화면이 허락하는 가장 큰 크기로 열립니다.'),
    art: fig('window', { w: 158, calls: [[1, [520, 22], 't'], [8, [714, 93], 't'], [2, [20, 57], 'l', -3], [3, [1160, 81], 'r', -2], [4, [1160, 104], 'r', 4], [5, [140, 330], 'l'], [6, [960, 330], 'r'], [7, [674, 470], 'b'], [9, [110, 709], 'b'], [10, [1152, 709], 'b']] }) }),

  page(t('the control bar', '컨트롤 바'), { kind: 'wide', cc: 3, txt:
    table(null,
      [1, ['to the start [[↩]]', '처음으로 [[↩]]']],
      [2, ['play. From the cycle’s start when the cycle is on, else from the playhead. [[space]]', '재생. 사이클이 켜져 있으면 사이클 시작에서, 아니면 플레이헤드에서. [[space]]']],
      [3, ['stop. Pressed when already stopped: back to the cycle’s start, then to bar 1, and every instrument is silenced', '정지. 이미 멈춘 상태에서 누르면 사이클 시작으로, 다시 누르면 1마디로 가고 모든 악기 소리가 꺼집니다']],
      [4, ['record [[R]]. See “recording”', '녹음 [[R]]. “녹음” 장 참고']]) +
    table(null,
      [5, ['cycle on, off [[C]]. With none set, it takes the part of the song the playhead is in', '사이클 켜기, 끄기 [[C]]. 정해 둔 것이 없으면 플레이헤드가 있는 파트를 잡습니다']],
      [6, ['click (metronome) [[K]]. The count-in has no cell: [[⇧K]]', '클릭(메트로놈) [[K]]. 카운트인은 칸이 없습니다. [[⇧K]]']],
      [7, ['position, as bar.beat.sixteenth. Click to type: a bar (17), bar beat sixteenth (17.3.2), or a time (12.5s, 1:02.25)', '위치. 마디.박.16분. 클릭해서 입력: 마디(17), 마디 박 16분(17.3.2), 또는 시간(12.5s, 1:02.25)']],
      [8, ['time, a readout only', '시간. 읽기 전용']],
      [9, ['tempo. Click to type, 40 to 240', '템포. 클릭해서 입력, 40~240']]) +
    table(null,
      [10, ['measure. Click for the list, 2/4 to 12/8', '박자. 클릭하면 목록, 2/4에서 12/8까지']],
      [11, ['key, a label of up to 8 characters. It is saved and written into the hand-off’s info page; nothing else uses it', '키. 8자까지의 메모. 저장되고 내보내기의 info 파일에 적힙니다. 다른 데는 쓰이지 않습니다']],
      [12, ['nudge: how far one nudge goes. Click for the list', '넛지: 한 번에 움직이는 거리. 클릭하면 목록']],
      [13, ['{{grid}}: the division the lanes’ lines are drawn at, 1/4 to begin with. Click for the list. See “the five modes and the grid”', '{{grid}}: 레인에 그려지는 선의 간격. 처음에는 1/4. 클릭하면 목록. “다섯 가지 모드와 그리드” 참고']],
      [14, ['{{out}}: the output meter and level. Drag up or down; double-click for 0 dB', '{{out}}: 출력 미터와 레벨. 위아래로 드래그, 더블 클릭하면 0 dB']]) +
    note('While a take is being recorded, the tempo and the measure cannot be changed and the playhead cannot be moved.', '녹음 중에는 템포와 박자를 바꿀 수 없고 플레이헤드도 옮길 수 없습니다.'),
    art: fig('bar', { w: 267, calls: [[1, 'tostart', 'b'], [2, 'play', 't'], [3, 'stop', 'b'], [4, 'rec', 't'], [5, 'loop', 'b'], [6, 'click', 't'], [7, 'pos', 'b'], [8, [578, 9], 't'], [9, 'tempo', 'b'], [10, 'meter', 't'], [11, 'key', 'b'], [12, 'nudge', 't'], [13, 'grid', 'b'], [14, 'master', 't']] }) }),

  page(t('the tracks’ bar', '트랙 바'), { kind: 'wide', cc: 3, txt:
    table(null,
      [1, ['new track: opens the new-track list [[⌥⌘N]]', '새 트랙: 새 트랙 목록을 엽니다 [[⌥⌘N]]']],
      [2, ['how many tracks, stacks and buses the song has', '곡의 트랙, 스택, 버스 개수']],
      [3, ['{{auto}} the automation view [[A]], {{flex}} the flex view [[⌘F]]. One turns the other off', '{{auto}} 오토메이션 보기 [[A]], {{flex}} 플렉스 보기 [[⌘F]]. 하나를 켜면 다른 하나는 꺼집니다']],
      [4, ['{{tool}}: the tool a click on the lanes uses. [[T]] opens the same list at the pointer', '{{tool}}: 레인을 클릭할 때 쓰는 도구. [[T]]를 누르면 같은 목록이 포인터 위치에 열립니다']]) +
    table(null,
      [5, ['{{cmd}}: the second tool, used while [[⌘]] is held', '{{cmd}}: 두 번째 도구. [[⌘]]를 누르는 동안 쓰입니다']],
      [6, ['{{mode}}: how a drag is placed: smart, grid, slip, shuffle, spot', '{{mode}}: 드래그가 놓이는 방식. smart, grid, slip, shuffle, spot']],
      [7, ['what is chosen: a region’s name, a count, a track, or a crossfade with its length and curve', '선택된 것: 리전 이름, 개수, 트랙, 또는 크로스페이드의 길이와 곡선']],
      [8, ['colour and outline keys: open the look list', '색과 모양 키: 모양 목록을 엽니다']]) +
    table(null,
      [9, ['{{gain}} of the chosen region. Drag up or down, −30 to +12 dB', '선택한 리전의 {{gain}}. 위아래로 드래그, −30~+12 dB']],
      [10, ['{{transpose}} in semitones, −24 to +24; beside it, on sound, {{fine}} in cents, −100 to +100', '{{transpose}} 반음 단위, −24~+24. 오디오면 옆에 {{fine}}, 센트 단위, −100~+100']],
      [11, ['zoom along the song', '곡 방향 줌']],
      [12, ['row height', '줄 높이']]) +
    p('With a region that has a fade, a file whose tempo is known, or the flex view on, more fields appear here: {{fade}}, its curve, {{bpm}}, {{quantize}} and its value. When the window is narrow the fields at the right drop off first.', '페이드가 있는 리전, 템포를 아는 파일, 플렉스 보기가 켜진 경우에는 여기에 칸이 더 나타납니다. {{fade}}와 곡선, {{bpm}}, {{quantize}}와 값. 창이 좁으면 오른쪽 칸부터 사라집니다.'),
    art: fig('toolrow', { w: 267, calls: [[1, 'addtrack', 't'], [2, [84, 21], 'b'], [3, [337, 6], 't'], [4, 'toolmenu', 'b'], [5, 'tool2menu', 't'], [6, 'modemenu', 'b'], [7, [727, 6], 't'], [8, 'look', 'b', 3], [9, 'rgain', 't'], [10, 'rtr', 'b'], [11, 'zoomx', 't'], [12, 'zoomy', 'b']] }) }),

  page(t('markers, bars, cycle, playhead', '마커, 마디 눈금, 사이클, 플레이헤드'), { kind: 'wide', cc: 3, txt:
    h('markers', '마커') +
    table(null,
      [['click a marker', '마커 클릭'], ['stopped: the playhead goes to its start. Playing: the song goes there at the next bar line, never mid-bar; a small square marks the one waiting', '멈춘 상태: 플레이헤드가 그 시작으로. 재생 중: 다음 마디 선에서 그곳으로 넘어갑니다. 마디 중간에는 넘어가지 않습니다. 기다리는 마커에 작은 네모가 표시됩니다']],
      [['double-click a marker', '마커 더블 클릭'], ['its part becomes the cycle, turned on', '그 파트가 사이클이 되고 켜집니다']],
      [['double-click the empty band', '빈 띠 더블 클릭'], ['a new marker on the nearest bar; its name box opens', '가장 가까운 마디에 새 마커. 이름 칸이 열립니다']],
      [['drag a marker', '마커 드래그'], ['to another whole bar', '다른 마디로 옮기기']],
      [['right-click a marker', '마커 오른쪽 클릭'], ['rename, cycle, repeat or move its part, cut it out of the song, delete', '이름 바꾸기, 사이클, 파트 반복이나 이동, 곡에서 잘라내기, 삭제']]) +
    h('cycle strip, the upper edge', '사이클 띠, 위쪽') +
    table(null,
      [['click', '클릭'], ['cycle on, off', '사이클 켜기, 끄기']],
      [['drag an empty stretch', '빈 곳 드래그'], ['a new cycle', '새 사이클']],
      [['drag its middle', '가운데 드래그'], ['it moves as it is', '그대로 이동']],
      [['drag an end', '끝 드래그'], ['that end moves', '그 끝만 이동']]) +
    h('playhead strip, the lower part', '플레이헤드 띠, 아래쪽') +
    table(null,
      [['click, drag', '클릭, 드래그'], ['the playhead goes there; while playing the song goes on from there', '플레이헤드가 그곳으로. 재생 중이면 거기서 이어집니다']],
      [['double-click', '더블 클릭'], ['plays from there; while playing, stops', '거기서 재생. 재생 중이면 정지']],
      [['drag the playhead’s head', '플레이헤드 머리 드래그'], ['it goes with the hand', '손을 따라 움직입니다']]) +
    h('by key', '키로') +
    table(null,
      ['[[,]] [[.]]', ['a bar back, on; held, bar after bar, while it plays too', '한 마디 뒤, 앞. 누르고 있으면 재생 중에도 한 마디씩 계속']],
      ['[[⇧,]] [[⇧.]]', ['eight bars', '여덟 마디']],
      ['[[⌥.]] [[⌥,]]', ['the next, the last marker', '다음, 이전 마커']],
      ['[[U]]', ['the cycle round what is chosen', '선택한 것 둘레로 사이클']],
      ['[[⌥\']]', ['a marker at the playhead', '플레이헤드에 마커']]),
    art: fig('ruler', { w: 267, calls: [[1, [680, 11], 't'], [2, [796, 25], 't'], [3, [714, 23], 'b', 6], [4, [674, 40], 'b'], [5, [1000, 11], 't']], cap: ['1 the marker of the part that is playing  2 an end of the cycle  3 the cycle  4 the playhead  5 another marker', '1 재생 중인 파트의 마커  2 사이클의 끝  3 사이클  4 플레이헤드  5 다른 마커'] }) }),

  page(t('getting around', '돌아다니기'), { kind: 'split', tw: 128, txt:
    table([['do this', '이렇게 하면'], ['and', '이렇게 됩니다']],
      [['the first slider on the tracks’ bar', '트랙 바의 첫 슬라이더'], ['zoom along the song, from all of it to 640 pixels a bar', '곡 방향 줌. 전체 보기에서 한 마디 640픽셀까지']],
      [['the second slider', '둘째 슬라이더'], ['row height, 20 to 120', '줄 높이, 20~120']],
      [['drag the line under a track’s head', '트랙 헤드 아래 선 드래그'], ['that row alone, 20 to 240 (the chosen ones together); double-click: back', '그 줄만, 20~240(선택한 줄은 함께). 더블 클릭: 원래대로']],
      ['[[⌘→]] [[⌘←]]', ['zoom in, out', '줌 인, 아웃']],
      ['[[⌘↓]] [[⌘↑]]', ['taller, shorter rows', '줄 높게, 낮게']],
      ['[[⌘+]] [[⌘−]]', ['taller, lower waveforms, up to ×1024', '파형 크게, 작게. 최대 1024배']],
      ['[[Z]]', ['zoomed in: back to the whole song. Showing all: zoom to what is chosen', '확대된 상태면 곡 전체로. 전체가 보이면 선택한 것으로 확대']],
      ['[[⌃⇧Z]]', ['zoom to the cycle', '사이클로 확대']],
      [['scroll', '스크롤'], ['up and down through the rows; sideways (or with [[⇧]]) along the song', '위아래는 줄, 옆으로(또는 [[⇧]]와 함께)는 곡 방향']],
      [['[[⌥]] or [[⌃]] and scroll, or a pinch', '[[⌥]]나 [[⌃]]와 스크롤, 또는 핀치'], ['zoom about the pointer', '포인터 중심으로 줌']],
      [['the zoom tool', '줌 도구'], ['drag across a stretch to fill the window with it; a click zooms out by half', '구간을 드래그하면 그 구간이 창을 채웁니다. 클릭하면 절반으로 축소']],
      ['[[home]] [[end]]', ['a page left, right', '한 화면 왼쪽, 오른쪽']],
      ['[[pgup]] [[pgdn]]', ['a page of rows up, down', '줄 한 화면 위, 아래']],
      ['[[`]]', ['find the playhead', '플레이헤드 찾기']],
      ['[[⇧`]]', ['find what is chosen', '선택한 것 찾기']]) +
    p('The view goes in as far as single samples: past 640 pixels a bar the bar numbers go on dividing into beats, sixteenths, ticks and finally sample numbers, and the grid, the nudge and the shortest region follow. When a drag reaches the edge of the lanes, the view turns under your hand.', '확대는 샘플 하나까지 들어갑니다. 한 마디 640픽셀을 넘으면 눈금이 박, 16분, 틱, 마지막엔 샘플 번호로 나뉘고, 그리드와 넛지, 가장 짧은 리전 길이도 따라갑니다. 드래그가 레인 가장자리에 닿으면 화면이 손 밑에서 넘어갑니다.'),
    art: `<div style="width:122mm">` + h('the panel under the lanes', '레인 아래 패널') +
      p('Two pages, {{patch}} and {{mixer}}. Drag its top edge to resize it; it leaves at least four rows of lanes. On a track of notes, the instrument’s own page stands in the patch’s place.', '{{patch}}와 {{mixer}} 두 페이지. 위쪽 가장자리를 드래그해 크기를 바꿉니다. 레인은 최소 네 줄이 남습니다. 노트 트랙에서는 악기 페이지가 패치 자리에 설 수 있습니다.') +
      h('the foot', '맨 아래 줄') + `</div>` +
      fig('foot', { w: 122, pad: { t: 7.5, b: 7.5 }, calls: [[1, [14, 11], 't'], [2, [80, 11], 'b'], [3, [1153, 11], 't']] }) +
      `<div style="width:122mm">` + legend(
        [1, 'the command line’s mark. [[/]] puts the keys there', '커맨드 라인 표시. [[/]]를 누르면 키 입력이 그리로 갑니다'],
        [2, 'the command line, and beside it what the last line did and anything the app has to say', '커맨드 라인. 그 옆에는 마지막 줄이 한 일과 앱이 하는 말이 나옵니다'],
        [3, '{{keys}} opens the sheet of key commands [[⇧/]]', '{{keys}}는 단축키 표를 엽니다 [[⇧/]]']) +
      p('In the app the right end also shows {{cpu}}, {{rate}}, {{buffer}} and {{saved}} with the time of the last save.', '앱에서는 오른쪽 끝에 {{cpu}}, {{rate}}, {{buffer}}, 그리고 마지막 저장 시각이 붙은 {{saved}}도 보입니다.') + `</div>` }),
  page(t('the menu bar, and finding a thing', '메뉴 바, 그리고 기능 찾기'), { kind: 'text', cc: 3, txt:
    lead('Everything the app does is a line of the Mac’s menu bar, with the key that does the same at its right. When you know what you want but not where it is, the bar is the place to look.', '앱이 하는 모든 일은 Mac 메뉴 바의 한 줄이고, 그 오른쪽에 같은 일을 하는 키가 적혀 있습니다. 하고 싶은 일은 아는데 어디 있는지 모를 때 메뉴 바를 보면 됩니다.') +
    h('finding a thing', '기능 찾기') +
    p('Open ((Help)) and type a word into its search field: “fade”, “transpose”, “marker”. Every line with that word is listed with its menu; point at one and the Mac opens its menu and shows where it is. Press it to do it.', '((Help))를 열고 검색 칸에 단어를 칩니다. “fade”, “transpose”, “marker” 같은 식입니다. 그 단어가 든 모든 줄이 메뉴와 함께 나옵니다. 하나에 포인터를 올리면 Mac이 그 메뉴를 열어 위치를 보여 주고, 누르면 실행됩니다.') +
    h('the menus', '메뉴') +
    table(null,
      ['((Slur Studio))', ['settings and each of their parts, the key commands', '설정과 그 각 항목, 단축키 표']],
      ['((File))', ['new, open, recent projects, save, import, hand off, bounce in place', '새로 만들기, 열기, 최근 프로젝트, 저장, 가져오기, 내보내기, 제자리 바운스']],
      ['((Edit))', ['undo, cut, copy, paste, every way of choosing, split, join, the song’s time by the cycle', '실행 취소, 잘라내기, 복사, 붙여넣기, 모든 선택 방법, 나누기, 합치기, 사이클 기준 곡 시간 편집']],
      ['((Region))', ['what is done to the chosen regions: gain, transpose and fine tune, fades, nudge, tempo, quantize', '선택한 리전에 하는 일: 게인, 트랜스포즈와 미세 조정, 페이드, 넛지, 템포, 퀀타이즈']],
      ['((Track))', ['new tracks, duplicate, delete, mute, solo, stacks, groups, the typing keyboard', '새 트랙, 복제, 삭제, 뮤트, 솔로, 스택, 그룹, 타이핑 키보드']],
      ['((Transport))', ['play, record, going around the song, the cycle, click and count-in', '재생, 녹음, 곡 안에서 이동, 사이클, 클릭과 카운트인']],
      ['((Markers))', ['adding, naming, going to them', '추가, 이름 붙이기, 이동']],
      ['((Tools))', ['the tool, the edit mode, the grid, the nudge value, the quantize value', '도구, 편집 모드, 그리드, 넛지 값, 퀀타이즈 값']],
      ['((View))', ['the panels, automation, flex, zoom, scrolling, the command line', '패널, 오토메이션, 플렉스, 줌, 스크롤, 커맨드 라인']],
      ['((Window)) ((Help))', ['the panels and the window; this guide, the key commands', '패널과 창. 이 설명서, 단축키 표']]) +
    h('ticks and keys', '체크와 키') +
    p('A line that is on or off carries a tick: the tool in use, the grid, the cycle, the click, the panels that are open. A key shown on a line works the same pressed in the room. Keys without [[⌘]] or [[⌃]] (a letter, an arrow) are the room’s: while you type in a box they type, as everywhere else in the app.', '켜고 끄는 줄에는 체크가 붙습니다. 쓰고 있는 도구, 그리드, 사이클, 클릭, 열린 패널 같은 것입니다. 줄에 적힌 키는 방에서 눌러도 똑같이 동작합니다. [[⌘]]나 [[⌃]]가 없는 키(글자, 화살표)는 방의 키라서, 칸에 글을 쓰는 동안에는 앱의 다른 곳과 마찬가지로 글자가 쳐집니다.') }),
])
