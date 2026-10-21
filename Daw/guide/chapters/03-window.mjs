import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('window', t('the window', '창'),
  t('One window holds the whole song. This chapter names its parts, from the transport panel at the left to the foot, and shows how to get around in it.', '창 하나에 곡 전체가 담깁니다. 왼쪽 트랜스포트 패널에서 맨 아래 줄까지 각 부분의 이름을 붙이고, 그 안에서 돌아다니는 방법을 보여 줍니다.'), [

  page(t('the window at a glance', '한눈에 보는 창'), { kind: 'split', tw: 88, txt:
    legend(
      [1, '__transport panel__ play, stop, record; where the song is and its time; tempo, measure, cycle, key; the out; the tool, mode, grid, nudge, the two views and the zooms; what is chosen. [[H]] hides it', '__트랜스포트 패널__ 재생, 정지, 녹음. 곡의 위치와 시간. 템포, 박자, 사이클, 키. 아웃. 도구, 모드, 그리드, 넛지, 두 가지 보기와 줌. 선택된 것. [[H]]로 숨김'],
      [2, '__markers__ the parts of the song, one cell each', '__마커__ 곡의 파트, 파트마다 칸 하나'],
      [3, '__bars__ the cycle on its upper strip, the playhead on its lower', '__마디 눈금__ 위쪽 띠에는 사이클, 아래쪽 띠에는 플레이헤드'],
      [4, '__track heads__ name, record, input, mute, solo, level', '__트랙 헤드__ 이름, 녹음, 입력, 뮤트, 솔로, 레벨'],
      [5, '__lanes__ the regions of each track', '__레인__ 트랙마다의 리전'],
      [6, '__playhead__', '__플레이헤드__'],
      [7, '__cycle__ yellow when on', '__사이클__ 켜지면 노란색'],
      [8, '__command line__ type what you want done', '__커맨드 라인__ 할 일을 글로 입력'],
      [9, '{{keys}} every key command on one sheet', '{{keys}} 모든 단축키를 한 장에']) +
    p('Under the lanes a panel opens on one of its pages: {{patch}} [[B]], {{mixer}} [[X]], {{notes}} [[P]], {{prompt}} [[/]] or {{rubato}} [[W]]; at the right, the Slur panel [[O]]. The Mac’s ((Window)) menu opens them too. {{hand off}} (stems, or a bounce of the mix) comes up in the middle of the window from ((File > Hand Off…)) [[⌘B]]. The window is never smaller than 1100 by 668 and opens as large as the screen allows.', '레인 아래에는 패널이 열리고 {{patch}} [[B]], {{mixer}} [[X]], {{notes}} [[P]], {{prompt}} [[/]], {{rubato}} [[W]] 중 한 페이지를 보여 줍니다. 오른쪽에는 Slur 패널 [[O]]이 열립니다. Mac의 ((Window)) 메뉴로도 열 수 있습니다. {{hand off}}(스템, 또는 믹스 바운스)는 ((File > Hand Off…)) [[⌘B]]로 창 가운데에 뜹니다. 창은 1100 x 668보다 작아지지 않고, 화면이 허락하는 가장 큰 크기로 열립니다.'),
    art: fig('window', { w: 158, calls: [[1, 'pos', 'l'], [2, 'scene#5', 'r', -10], [3, 'seek', 'r'], [4, 'sel#2', 't'], [5, 'lanes', 'r'], [6, 'playhead', 't', 6], [7, 'cycle#1', 't', -6], [8, 'cmdline', 'b'], [9, 'sheet', 'b']] }) }),

  page(t('the transport panel', '트랜스포트 패널'), { kind: 'split', tw: 112, txt:
    p('The app begins with the transport panel down the left: what is pressed to play, where the song is, the tools and what is chosen, in one column, each thing as large as it matters. [[H]] hides it (and brings it back); hidden, nothing stands in its place, and the song has all the room. ((View)) > ((Transport Panel)) does the same. The app remembers which.', '앱은 왼쪽에 트랜스포트 패널을 띄운 채 시작합니다. 재생, 곡의 위치, 도구, 선택된 것을 한 열에 모아, 중요한 것일수록 크게 그렸습니다. [[H]]로 숨기고 다시 띄웁니다. 숨기면 그 자리에 아무것도 없고 곡이 창 전체를 씁니다. ((View)) > ((Transport Panel))도 같습니다. 앱이 어느 쪽이었는지 기억합니다.') +
    table(null,
      [1, ['play, stop, record: a triangle, a square, a ring. The one the room is doing is filled. Beside them, to the start', '재생, 정지, 녹음: 삼각형, 사각형, 원. 지금 하고 있는 것이 채워집니다. 옆에 처음으로']],
      [2, ['the bar the song is in, large, with beat . division . tick at its foot. Click to type a place (17.3.2.120)', '지금 마디를 크게, 그 옆에 박 . 16분 . 틱. 클릭해서 위치 입력(17.3.2.120)']],
      [3, ['the time as SMPTE. Click to type a time; right-click for its start and frame rate', 'SMPTE 시간. 클릭해서 시간 입력, 우클릭으로 시작 시간과 프레임레이트']],
      [4, ['the measure, its beats as squares (the one sounding filled); click for the list', '박자. 박을 사각형으로, 지금 박이 채워집니다. 클릭하면 목록']],
      [5, ['the tempo in its ring; the dot goes round once a bar. Click to type', '템포와 그 둘레. 점이 한 마디에 한 바퀴 돕니다. 클릭해서 입력']],
      [6, ['the cycle: the triangle turns it on and off. Beside it the key, click and low latency', '사이클: 삼각형으로 켜고 끕니다. 옆에 키, 클릭, 저지연']]) +
    table(null,
      [7, ['the song as a line: its parts as ticks, the cycle yellow, the playhead a dot', '곡을 선으로: 파트는 눈금, 사이클은 노랑, 플레이헤드는 점']],
      [8, ['{{out}}: a ring filled as loud as the mix; the white square is its level, drag up or down. The light fills red once the mix has clipped, the loudest peak beside it; click the light to let go of it', '{{out}}: 믹스 소리만큼 차는 링. 흰 사각형이 레벨이고 위아래로 드래그. 믹스가 클립하면 빨간 불이 켜지고 옆에 가장 큰 피크가 나옵니다. 불을 클릭하면 초기화']],
      [9, ['how many tracks; the circle adds one. Beside it what is chosen: its colour opens the look list; a region shows its gain and transpose (drag them)', '트랙 수, 원으로 새 트랙. 옆에 선택된 것: 색을 누르면 모양 목록, 리전이면 게인과 트랜스포즈(드래그)']],
      [10, ['the tool, the mode, the grid, the nudge: click for their lists', '도구, 모드, 그리드, 넛지: 클릭하면 목록']],
      [11, ['automation and rubato, the two views [[A]] [[⌘F]]; the zoom along the song and the rows’ height', '오토메이션과 루바토 두 보기 [[A]] [[⌘F]]. 가로 줌과 줄 높이']]),
    art: fig('panel', { w: 48, calls: [[1, 'play', 'l'], [2, 'pos', 'l', 4], [3, 'smpte', 'l'], [4, 'meter', 'l'], [5, 'tempo', 'r'], [6, 'loop', 'l'], [7, [40, 398], 'l'], [8, 'master', 'r'], [9, 'addtrack', 'r'], [10, 'toolmenu', 'l'], [11, 'autokey', 'l']] }) }),

  page(t('markers, bars, cycle, playhead', '마커, 마디 눈금, 사이클, 플레이헤드'), { kind: 'wide', cc: 3, txt:
    h('markers', '마커') +
    table(null,
      [['click a marker', '마커 클릭'], ['stopped: the playhead goes to its start. Playing: the song goes there at the next bar line, never mid-bar; a small square marks the one waiting', '멈춘 상태: 플레이헤드가 그 시작으로. 재생 중: 다음 마디 선에서 그곳으로 넘어갑니다. 마디 중간에는 넘어가지 않습니다. 기다리는 마커에 작은 네모가 표시됩니다']],
      [['double-click a marker', '마커 더블 클릭'], ['its name box opens, as in Logic. To cycle its part: its menu, or [[⌃⌥C]]', '이름 칸이 열립니다(Logic과 같음). 그 파트를 사이클로 하려면 마커 메뉴나 [[⌃⌥C]]']],
      [['double-click the empty band', '빈 띠 더블 클릭'], ['a new marker on the nearest bar; its name box opens', '가장 가까운 마디에 새 마커. 이름 칸이 열립니다']],
      [['drag a marker', '마커 드래그'], ['to another whole bar', '다른 마디로 옮기기']],
      [['right-click a marker', '마커 오른쪽 클릭'], ['rename, cycle, repeat or move its part, cut it out of the song, a new marker at the playhead, delete', '이름 바꾸기, 사이클, 파트 반복이나 이동, 곡에서 잘라내기, 삭제']]) +
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
      ['[[⌥\']]', ['a marker at the playhead', '플레이헤드에 마커']],
      ['[[⇧\']]', ['rename the marker', '마커 이름 바꾸기']],
      ['[[⌃⌥C]]', ['its part becomes the cycle, turned on', '그 파트가 사이클이 되고 켜집니다']]),
    art: fig('ruler', { w: 267, calls: [[1, [680, 11], 't'], [2, [796, 25], 't'], [3, [714, 23], 'b', 6], [4, [674, 40], 'b'], [5, [1000, 11], 't']], cap: ['1 the marker of the part that is playing  2 an end of the cycle  3 the cycle  4 the playhead  5 another marker', '1 재생 중인 파트의 마커  2 사이클의 끝  3 사이클  4 플레이헤드  5 다른 마커'] }) }),

  page(t('getting around', '돌아다니기'), { kind: 'split', tw: 118, txt:
    table([['do this', '이렇게 하면'], ['and', '이렇게 됩니다']],
      [['{{zoom across}} in the transport panel', '트랜스포트 패널의 {{zoom across}}'], ['zoom along the song, from all of it to 640 pixels a bar', '곡 방향 줌. 전체 보기에서 한 마디 640픽셀까지']],
      [['{{zoom down}}', '{{zoom down}}'], ['row height, 20 to 120', '줄 높이, 20~120']],
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
    p('The view goes in as far as single samples: the bar numbers divide into beats, sixteenths, ticks and samples, and the grid and nudge follow. When a drag reaches the edge of the lanes, the view turns under your hand.', '확대는 샘플 하나까지 들어갑니다. 눈금이 박, 16분, 틱, 샘플로 나뉘고 그리드와 넛지도 따라갑니다. 드래그가 레인 가장자리에 닿으면 화면이 손 밑에서 넘어갑니다.'),
    art: `<div style="width:122mm">` + h('the panel under the lanes', '레인 아래 패널') +
      p('Up to five pages: {{patch}}, {{mixer}}, {{notes}}, {{prompt}} and {{rubato}}. Drag its top edge to resize it; it leaves at least four rows of lanes. On a track of notes, the instrument’s own page stands in the patch’s place.', '{{patch}}, {{mixer}}, {{notes}}, {{prompt}}, {{rubato}}까지 다섯 페이지. 위쪽 가장자리를 드래그해 크기를 바꿉니다. 레인은 최소 네 줄이 남습니다. 노트 트랙에서는 악기 페이지가 패치 자리에 설 수 있습니다.') +
      h('the foot', '맨 아래 줄') + `</div>` +
      fig('foot', { w: 122, pad: { t: 7.5, b: 7.5 }, calls: [[1, [14, 11], 't'], [2, [80, 11], 'b'], [3, [1153, 11], 't']] }) +
      `<div style="width:122mm">` + legend(
        [1, 'the command line’s mark: click it to type at the foot. [[/]] opens the {{prompt}} page in the panel instead, the keys in its field; while that page is up, the foot shows only how the machine stands', '커맨드 라인 표시. 클릭하면 맨 아래 줄에 입력합니다. [[/]]를 누르면 패널에 {{prompt}} 페이지가 열리고 키 입력이 그 칸으로 갑니다. 그 페이지가 열려 있는 동안 맨 아래 줄에는 기기 상태만 나옵니다'],
        [2, 'the command line, and beside it what the last line did and anything the app has to say', '커맨드 라인. 그 옆에는 마지막 줄이 한 일과 앱이 하는 말이 나옵니다'],
        [3, '{{keys}} opens the sheet of key commands [[⇧/]]', '{{keys}}는 단축키 표를 엽니다 [[⇧/]]']) +
      p('In the app the right end also shows {{cpu}}, {{rate}}, {{buffer}} and {{saved}} with the time of the last save, and {{keyboard}} with its lowest key while [[⌘K]] makes the computer’s keys a keyboard.', '앱에서는 오른쪽 끝에 {{cpu}}, {{rate}}, {{buffer}}, 마지막 저장 시각이 붙은 {{saved}}가 보이고, [[⌘K]]로 자판을 건반으로 쓰는 동안에는 가장 낮은 음과 함께 {{keyboard}}도 나옵니다.') + `</div>` }),
  page(t('the menu bar, and finding a thing', '메뉴 바, 그리고 기능 찾기'), { kind: 'text', cc: 3, txt:
    lead('Everything the app does is a line of the Mac’s menu bar, with the key that does the same at its right. When you know what you want but not where it is, the bar is the place to look.', '앱이 하는 모든 일은 Mac 메뉴 바의 한 줄이고, 그 오른쪽에 같은 일을 하는 키가 적혀 있습니다. 하고 싶은 일은 아는데 어디 있는지 모를 때 메뉴 바를 보면 됩니다.') +
    h('finding a thing', '기능 찾기') +
    p('Open ((Help)) and type a word into its search field: “fade”, “transpose”, “marker”. Every line with that word is listed with its menu; point at one and the Mac opens its menu and shows where it is. Press it to do it.', '((Help))를 열고 검색 칸에 단어를 칩니다. “fade”, “transpose”, “marker” 같은 식입니다. 그 단어가 든 모든 줄이 메뉴와 함께 나옵니다. 하나에 포인터를 올리면 Mac이 그 메뉴를 열어 위치를 보여 주고, 누르면 실행됩니다.') +
    p('With the app set to Korean, the menu bar is in Korean too (파일, 편집, 보기, 윈도우, 도움말), and Help’s search finds Korean words. Names you gave, such as a project under Open Recent, stay as they are.', '앱을 한국어로 두면 메뉴 막대도 한국어(파일, 편집, 보기, 윈도우, 도움말)로 나오고, 도움말 검색도 한국어 단어를 찾습니다. 최근 사용 열기의 프로젝트처럼 직접 붙인 이름은 그대로입니다. 이 책은 메뉴 항목을 영어 이름으로 적습니다.') +
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
      ['((View))', ['the panels, automation, rubato, zoom, scrolling, the command line', '패널, 오토메이션, 루바토, 줌, 스크롤, 커맨드 라인']],
      ['((Window)) ((Help))', ['the panels and the window; this guide (as a PDF, in the app’s language), the key commands, the command line', '패널과 창. 이 설명서(PDF, 앱의 언어로), 단축키 표, 커맨드 라인']]) +
    h('ticks and keys', '체크와 키') +
    p('A line that is on or off carries a tick: the tool in use, the grid, the cycle, the click, the panels that are open. A key shown on a line works the same pressed in the room. Keys without [[⌘]] or [[⌃]] (a letter, an arrow) are the room’s: while you type in a box they type, as everywhere else in the app.', '켜고 끄는 줄에는 체크가 붙습니다. 쓰고 있는 도구, 그리드, 사이클, 클릭, 열린 패널 같은 것입니다. 줄에 적힌 키는 방에서 눌러도 똑같이 동작합니다. [[⌘]]나 [[⌃]]가 없는 키(글자, 화살표)는 방의 키라서, 칸에 글을 쓰는 동안에는 앱의 다른 곳과 마찬가지로 글자가 쳐집니다.') }),
])
