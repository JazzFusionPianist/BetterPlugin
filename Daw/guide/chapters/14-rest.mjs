import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('rest', t('slur, settings, and when things go wrong', 'slur, 설정, 그리고 문제가 생겼을 때'),
  t('The Slur panel beside the song, the Settings window, what the app does after a crash or a plug-in that hangs, and what this version does not do yet.', '곡 옆의 Slur 패널, 설정 창, 충돌이나 멈춘 플러그인 뒤에 앱이 하는 일, 그리고 이 버전에 아직 없는 것.'), [

  page(t('the slur panel', 'slur 패널'), { kind: 'split', tw: 104, mid: true, txt:
    lead('Slur itself, in a column down the right side of the window: your rooms, chats and shared files beside the song you are working on.', '창 오른쪽에 세로로 서는 Slur 자체입니다. 작업 중인 곡 옆에 방, 채팅, 공유 파일이 놓입니다.') +
    table(null,
      [['open, close', '열기, 닫기'], ['[[O]], or ((Window > Slur))', '[[O]], 또는 ((Window > Slur))']],
      [['what it shows', '보여 주는 것'], ['Slur’s own page, loaded from the net. With no connection the column has nothing to show', 'Slur의 자체 페이지. 인터넷에서 불러옵니다. 연결이 없으면 보여 줄 것이 없습니다']],
      [['signing in', '로그인'], ['in the panel itself, with your Slur account', '패널 안에서 Slur 계정으로']],
      [['links', '링크'], ['a link the page wants opened elsewhere opens in the Mac’s browser', '다른 곳에서 열어야 하는 링크는 Mac의 브라우저에서 열립니다']]) +
    p('The panel is 300 wide. When it opens, the markers, the lanes and the panel under them end at its left edge; the foot keeps the whole width. Whether it was open is saved with the project.', '패널 폭은 300입니다. 열리면 마커, 레인, 아래 패널이 그 왼쪽 가장자리에서 끝나고, 맨 아래 줄은 전체 폭을 유지합니다. 열려 있었는지는 프로젝트에 저장됩니다.') +
    note('The effects button of the Slur page is hidden here: in Slur Studio the patch is the app’s own.', 'Slur 페이지의 이펙트 버튼은 여기서 숨겨집니다. Slur Studio에서는 패치가 앱 자체의 것이기 때문입니다.'),
    art: draw(150, 92,
      D.box(0, 4, 150, 84, 'k') +
      `<rect x="0" y="4" width="150" height="7" class="db k2"/>` + D.txt(4, 9, 'markers', '마커', 'xs wh2') +
      `<rect x="0" y="84" width="150" height="4" class="db k2"/>` + D.txt(4, 87.2, 'foot', '맨 아래 줄', 'xs wh2') +
      `<rect x="0" y="11" width="37" height="45" class="db k2"/>` + D.txt(4, 20, 'track heads', '트랙 헤드', 'xs wh2') +
      D.txt(42, 20, 'lanes', '레인', 'xs wh2') +
      `<rect x="0" y="56" width="112" height="28" class="db k3"/>` + D.txt(4, 64, 'patch or mixer', 'patch 또는 mixer', 'xs wh2') +
      `<rect x="112" y="11" width="38" height="73" fill="#FBFAF7"/>` + D.txt(131, 22, 'slur', 'slur', 'b m') + D.txt(131, 28, 'rooms, chat, files', '방, 채팅, 파일', 'xs m')) }),

  page(t('settings', '설정'), { kind: 'split', tw: 112, txt:
    p('((Slur Studio > Settings…)) [[⌘,]] opens a window of its own. Each part also opens from its own line: ((Slur Studio > Settings > Audio)). A change is taken at once; there is no OK or Cancel. [[esc]] or [[⌘W]] closes it.', '((Slur Studio > Settings…)) [[⌘,]]는 별도의 창을 엽니다. 각 항목은 자기 메뉴 줄로도 열립니다: ((Slur Studio > Settings > Audio)). 바꾸면 바로 적용되고, OK나 Cancel은 없습니다. [[esc]]나 [[⌘W]]로 닫습니다.') +
    h('general', 'general') +
    table(null,
      ['{{language}}', ['{{english}} or {{한국어}}. The app, its menu bar too, is written again in that language at once, without a restart. Names you gave and the Mac’s own panels (open, save, colours) never change. The command line reads English either way', '{{english}} 또는 {{한국어}}. 재시작 없이 메뉴 막대까지 바로 그 언어로 다시 그려집니다. 직접 붙인 이름과 Mac 자체 패널(열기, 저장, 색상)은 바뀌지 않습니다. 커맨드 라인은 어느 쪽이든 영어를 읽습니다']]) +
    h('audio', 'audio') +
    legend(
      [1, '{{output}} and {{input}}: the device. Choosing an input does not open it; it opens when a track asks for it', '{{output}}과 {{input}}: 장치. 입력을 골라도 열리지는 않습니다. 트랙이 요청할 때 열립니다'],
      [2, '{{what comes in}} a level meter while the input is open; else a {{listen}} key that opens it', '{{what comes in}} 입력이 열려 있으면 레벨 미터, 아니면 입력을 여는 {{listen}} 키'],
      [3, '{{rate}} in kHz and {{buffer}} in samples: those the device offers', '{{rate}}(kHz)와 {{buffer}}(샘플): 장치가 제공하는 값'],
      [4, '{{latency}} a readout: in, out, there and back', '{{latency}} 읽기 전용: 입력, 출력, 왕복'],
      [5, '{{low latency}} with low latency on in the transport panel, what is heard live steps past any plug-in later than this: 1, 3, 5, 10 or 20 ms, 5 at first', '{{low latency}} 트랜스포트 패널에서 저지연이 켜져 있으면, 직접 듣는 소리는 이보다 늦는 플러그인을 건너뜁니다: 1, 3, 5, 10, 20 ms, 처음엔 5'],
      [6, '{{threads}} how many of the Mac’s cores work on the sound. {{all}} at first', '{{threads}} 소리 처리에 쓰는 Mac 코어 수. 처음엔 {{all}}'],
      [7, '{{test tone}} {{play}}', '{{test tone}} {{play}}']) +
    p('The device, rate, buffer and threads cannot be changed while a take or a print is under way. When the device moves to another rate, the app follows and says so at the foot: “now at 48k”.', '녹음이나 바운스가 진행 중일 때는 장치, 레이트, 버퍼, 스레드를 바꿀 수 없습니다. 장치의 레이트가 바뀌면 앱이 따라가고 아래에 알려 줍니다. “now at 48k”.') +
    note('{{display}} and {{plug-ins}} have pages of their own, next. The parts drawn dim down the left (recording, editing, notes, command line, slur, hand off, storage) are not made yet.', '{{display}}와 {{plug-ins}}는 다음 쪽부터 따로 설명합니다. 왼쪽에 흐리게 그려진 항목(recording, editing, notes, command line, slur, hand off, storage)은 아직 만들어지지 않았습니다.'),
    art: fig('settings', { w: 140, calls: [[1, [1072, 117], 'r'], [2, [1072, 161], 'r'], [3, [1072, 240], 'r'], [4, [1072, 285], 'r', -2], [5, [1072, 314], 'r', 3], [6, [1072, 377], 'r'], [7, [1050, 410], 'b']] }) }),

  page(t('themes: a whole room at once', '테마: 방 전체를 한 번에'), { kind: 'split', tw: 104, txt:
    lead('Over the parts of Settings › {{display}} stand the themes: the room as it comes, {{bauhaus}}, and your own. Clicking one puts it on at once: every colour, the type, the grounds and the shapes of the parts.', '설정 › {{display}}의 맨 위에 테마가 있습니다. 처음 그대로의 방, {{bauhaus}}, 그리고 내가 만든 테마. 클릭하면 바로 입혀집니다. 모든 색, 글자, 바탕, 부분의 모양이 함께 바뀝니다.') +
    table([['theme', '테마'], ['what it is', '무엇인가']],
      ['{{bauhaus}}', ['a poster of primary colours. A composition down the left holds the transport and what the tool row held, each as large as it matters: play a large red disc, where the song is a large figure, the tempo a yellow disc, the metre a blue square, the cycle a yellow triangle, the out a ring as loud as the mix; under it the chosen track’s strip: pan, level, input, group, plug-ins, and sends as knobs, each with its bus (its amount under the pointer); the tool, mode, grid, nudge, automation, rubato and zoom small at its foot. The black band at the foot says what is chosen: the track, or the region with its gain, transpose and fades. Numbers and shapes on the tracks; the markers shapes; the cycle a yellow length of the rule; the playhead a disc on a bar. The mixer keeps every track in sight: the chosen tracks stand open (their patch, sends, pan, level and buttons), the others close to their number, their name turned up the strip, a bar as loud as they sound and their level; a closed strip pressed opens. The panel’s tabs are words, the open one on black', '원색 포스터. 왼쪽을 따라 내려가는 구성에 트랜스포트와 툴 줄에 있던 것들이 중요한 만큼의 크기로 들어 있습니다. 재생은 큰 빨간 원, 곡의 위치는 큰 숫자, 템포는 노란 원, 박자는 파란 사각형, 사이클은 노란 삼각형, 출력은 믹스만큼 차는 고리입니다. 그 아래에는 고른 트랙의 스트립이 있습니다. 팬, 소리만큼 차는 두 막대 옆 빨간 원의 레벨, 입력, 그룹, 플러그인, 그리고 노브로 된 센드(아래에 버스 이름, 포인터를 올리면 양). 툴, 모드, 그리드, 넛지, 오토메이션, 루바토, 줌은 맨 아래에 작게 있습니다. 아래의 검은 띠는 고른 것을 말합니다. 트랙, 또는 리전과 그 게인, 트랜스포즈, 페이드. 트랙에는 숫자와 도형, 마커는 도형, 사이클은 자의 노란 구간, 재생선은 막대 위의 원. 믹서는 모든 트랙을 한 화면에 둡니다. 고른 트랙은 펼쳐져(패치, 센드, 팬, 레벨, 버튼) 있고, 나머지는 번호, 세로로 선 이름, 소리만큼 차는 막대와 레벨로 접혀 있습니다. 접힌 스트립을 누르면 펼쳐집니다. 패널의 탭은 글자이고, 열린 탭은 검은 칸입니다']]) +
    p('Its parts work as the room’s own: a word of the transport is pressed as its key, a level dragged, a tempo or a bar typed by pressing it twice. A theme is every quality of the room, so any of it can be changed after: {{type}}, {{background}} and, under {{the parts}} › {{their shapes}}, each part’s shape on its own. {{keep as my own…}} keeps it by a name; {{share as .sst…}} and {{open .sst…}} write and read a .sst file (Slur Studio / Themes), to hand a theme to someone.', '부분은 방의 원래 부분처럼 동작합니다. 트랜스포트의 글자는 누르면 그 키처럼, 레벨은 끌어서, 템포와 마디는 두 번 눌러 입력합니다. 테마는 방의 모든 속성이라 그 뒤에 어느 것이든 바꿀 수 있습니다. {{type}}, {{background}}, 그리고 {{the parts}} › {{their shapes}}에서 부분마다 모양을 따로 고릅니다. {{keep as my own…}}는 이름 붙여 간직하고, {{share as .sst…}}와 {{open .sst…}}는 .sst 파일을 쓰고 읽습니다(Slur Studio / Themes 폴더). 테마를 다른 사람에게 건넬 수 있습니다.'),
    art: fig('theme-bauhaus', { w: 150, cap: ['the room in {{bauhaus}}', '{{bauhaus}} 테마를 입은 방'] }) }),
  page(t('display: every part, every quality', 'display: 모든 부분, 모든 속성'), { kind: 'split', tw: 104, txt:
    lead('Settings › {{display}} lists every part of the room and every quality of it as plain values. Nothing is chosen for you: the room as it comes is the one starting point, and a look is only what you changed.', '설정 › {{display}}는 방의 모든 부분과 그 모든 속성을 값 그대로 보여 줍니다. 미리 정해 둔 것은 없습니다. 처음 그대로의 방이 유일한 출발점이고, 모습(look)은 바꾼 것만으로 이루어집니다.') +
    legend(
      [1, '{{theme}} the theme in use: {{as it comes}}, a built-in one or one you kept, and how many changes since. Click it to wear another', '{{theme}} 지금 쓰는 테마. {{as it comes}}, 내장 테마 또는 간직한 테마와, 그 뒤로 바뀐 곳의 수. 클릭해서 다른 테마를 입힙니다'],
      [2, '{{find a part}} by its name, or by the name of one of its qualities', '{{find a part}} 부분의 이름이나 그 속성의 이름으로 찾습니다'],
      [3, 'the parts of the room. One with a caret opens into smaller parts', '방의 부분들. 꺾쇠가 있는 것은 더 작은 부분으로 열립니다'],
      [4, 'a colour: its well opens the Mac’s colour panel, its value can be typed as #rrggbb, and the % is how much of it', '색. 색 칸은 Mac의 색상 패널을 열고, 값은 #rrggbb로 직접 칠 수 있으며, %는 그 색의 세기입니다'],
      [5, 'a number: drag it up or down ([[⇧]] for finer steps), or click it and type', '숫자. 위아래로 드래그하거나([[⇧]]를 누르면 더 잘게) 클릭해서 칩니다'],
      [6, 'a dot before a quality: it is not as the room comes. Click the dot to put it back', '속성 앞의 점: 처음 그대로가 아니라는 뜻입니다. 점을 클릭하면 되돌아갑니다'],
      [7, '{{keep as my own…}} keeps the theme by a name. {{open .sst…}} and {{share as .sst…}} read and write a .sst file, to hand a theme to someone', '{{keep as my own…}}는 테마를 이름 붙여 간직합니다. {{open .sst…}}와 {{share as .sst…}}는 .sst 파일을 읽고 써서 테마를 다른 사람에게 건넵니다']) +
    p('The room wears every change at once. [[⌘Z]] in the window takes the last one back. The Settings window itself always stays as the room comes, so whatever a look does, it can be undone from there.', '방은 바뀐 것을 바로 입습니다. 창에서 [[⌘Z]]를 누르면 마지막 변경이 되돌아갑니다. 설정 창 자체는 언제나 처음 그대로라서, 모습이 무엇을 하든 거기서 되돌릴 수 있습니다.'),
    art: fig('display', { w: 150, calls: [[1, 'd-looks', 't'], [7, 'd-keep', 't'], [2, 'd-find', 'l'], [3, 'd-group', 'l'], [6, 'd-reset:reg.corners', 'l'], [4, 'd-well:reg.fill', 'r', 0, { fx: .5 }], [5, 'd-num:reg.corners', 'r']] }) }),

  page(t('what a look reaches', '모습이 닿는 곳'), { kind: 'split', tw: 112, mid: true, txt:
    table([['part', '부분'], ['its qualities', '속성']],
      ['{{the window}}', ['the tones: ground, raised (the top bar, the foot, menus), a control at rest and under the hand, the deepest (the lanes). The ink of every word and mark; the lines between, and their strength', '톤: 바탕, 올라온 면(위 막대, 아래 줄, 메뉴), 가만히 있거나 손이 닿은 컨트롤, 가장 깊은 면(레인). 모든 글자와 표시의 잉크, 사이의 선과 그 세기']],
      ['{{the bars and the playhead}}', ['the bars’ ground and numbers; the playhead’s colour and width; the cycle’s colour', '마디 줄의 바탕과 숫자, 플레이헤드의 색과 굵기, 사이클의 색']],
      ['{{tracks’ heads}}', ['ground, the track’s colour down the edge, its number, the size of its name; the wash of the chosen one', '바탕, 가장자리의 트랙 색, 번호, 이름 크기, 고른 헤드의 물들임']],
      ['{{the lanes}}', ['every other lane, the chosen lane; how strong the grid and the song’s end are', '한 줄 걸러 레인, 고른 레인, 그리드와 곡 끝 선의 세기']],
      ['{{regions}}', ['fill (its family’s, or one colour for all), edge and its width, corners, shape by instrument, gap; the sound’s colour, drawn filled, as a line or as a half standing on the foot; the name’s colour, size, weight and place; the fades’ line and shade; when chosen, fill and edge', '채움(가족 색, 또는 모두 한 색), 테두리와 굵기, 모서리, 악기별 모양, 간격. 소리의 색과 그리는 법(채움, 선, 바닥에 선 반쪽). 이름의 색, 크기, 두께, 위치. 페이드의 선과 그늘. 골랐을 때의 채움과 테두리']],
      ['{{the families}}', ['drums, bass, keys, guitar, voice, effects: a deep end and a light end each, between which the family’s tracks are laid; buses one colour', '드럼, 베이스, 키, 기타, 보컬, 효과: 각각 짙은 끝과 밝은 끝이 있고 가족의 트랙들이 그 사이에 놓입니다. 버스는 한 색']],
      ['{{meanings}}', ['recording, solo, listening to the input, a level', '녹음, 솔로, 입력 듣기, 레벨']],
      ['{{slur}}', ['the panel’s look: by the ground, always dark or always light', '패널의 모습: 바탕에 따라, 늘 어둡게, 늘 밝게']]) +
    note('By the ground, the Slur panel turns light by itself when the window’s ground grows lighter than the mark ({{light when the ground is lighter than}}, 60% at first), and dark again below it.', '바탕에 따라로 두면, 창의 바탕이 기준({{light when the ground is lighter than}}, 처음엔 60%)보다 밝아질 때 Slur 패널이 저절로 밝아지고, 그 아래로 내려가면 다시 어두워집니다.'),
    art: fig('display-room', { w: 150, cap: ['the room in a look of its own: a light ground, dark ink, round corners, the sound standing on each region’s foot, drums from red to amber', '직접 만든 모습을 입은 방: 밝은 바탕, 짙은 잉크, 둥근 모서리, 리전 바닥에 선 소리, 빨강에서 호박색으로 가는 드럼'] }) }),

  page(t('key commands: every key, and other programs’ keys', 'key commands: 모든 키, 다른 프로그램의 키'), { kind: 'split', tw: 104, txt:
    lead('Settings › {{key commands}} ([[⌥K]]) holds every key of the room. Any of them can be changed, and with one press the keys become those of Logic Pro, Ableton Live, Cubase or Pro Tools.', '설정 › {{key commands}}([[⌥K]])에는 방의 모든 키가 있습니다. 어느 키든 바꿀 수 있고, 한 번 눌러 Logic Pro, Ableton Live, Cubase, Pro Tools의 키로 바꿀 수 있습니다.') +
    legend(
      [1, '{{keys like}} slur studio, logic pro, ableton live, cubase or pro tools: each as that program comes. What only Slur Studio has keeps its own key, with ⌃⇧ or ⌥⇧ added where the program uses it, and a key the program gives something Slur Studio does not have is left empty', '{{keys like}} slur studio, logic pro, ableton live, cubase, pro tools: 각 프로그램의 기본 키 그대로입니다. Slur Studio에만 있는 기능은 원래 키를 쓰되, 그 프로그램이 쓰는 키라면 ⌃⇧나 ⌥⇧를 붙여 옮깁니다. 그 프로그램에만 있는 기능의 키는 비워 둡니다'],
      [2, '{{from my own set…}} reads your own set of Logic Pro (the set in use, or a .logikcs), Cubase (Key Commands.xml) or Pro Tools (the set in use, or a .ptpreset) and turns it into the room’s keys. Ableton Live’s keys cannot be changed, so its set is the one above', '{{from my own set…}}는 내가 쓰는 Logic Pro(지금 쓰는 설정이나 .logikcs), Cubase(Key Commands.xml), Pro Tools(지금 쓰는 설정이나 .ptpreset)의 키 설정을 읽어 방의 키로 바꿉니다. Ableton Live는 키를 바꿀 수 없어 위의 기본 설정이 곧 그 설정입니다'],
      [3, 'the keyboard: what each key does, with no key held or with ⇧, ⌥, ⌃, ⌘ …; click a key to find its command', '키보드: 아무것도 누르지 않았을 때나 ⇧, ⌥, ⌃, ⌘ … 를 누른 채일 때 각 키가 하는 일. 키를 클릭하면 그 명령을 찾아 줍니다'],
      [4, 'a command and its keys. Click it, then press its new key; [[⌫]] leaves it without, [[esc]] keeps it. A key another command has is asked for first', '명령과 그 키. 클릭한 뒤 새 키를 누릅니다. [[⌫]]는 키 없음, [[esc]]는 그대로. 다른 명령이 쓰는 키면 가져올지 먼저 묻습니다'],
      [5, 'a dot before a command: its key is not its set’s. Click the dot to put it back', '명령 앞의 점: 그 설정의 키와 다르다는 뜻입니다. 점을 클릭하면 되돌아갑니다'],
      [6, '{{save as default}} keeps the keys as {{my default}}, one press away. {{export .sska…}} and {{import…}} write and read a set as a .sska file, in Slur Studio / Key Commands', '{{save as default}}는 지금 키를 {{my default}}로 간직해 한 번에 돌아올 수 있게 합니다. {{export .sska…}}와 {{import…}}는 키 설정을 .sska 파일로 쓰고 읽습니다(Slur Studio / Key Commands 폴더)']) +
    p('Every change is the room’s at once: its keys, and the keys the menu bar shows (so Help’s search shows them too). [[⌘Z]] in the window takes the last change back.', '바뀐 키는 바로 방에 적용됩니다. 방의 키도, 메뉴 막대에 보이는 키도(그래서 도움말 검색에도) 바뀝니다. 창에서 [[⌘Z]]를 누르면 마지막 변경이 되돌아갑니다.'),
    art: fig('keycommands', { w: 150, calls: [[1, 'k-base', 't'], [2, 'k-foreign', 't'], [3, 'k-layer', 'l'], [4, 'k-cmd', 'l'], [6, 'k-default', 't']] }) }),

  page(t('plug-ins: in the lists or left out', 'plug-ins: 목록에 두기, 빼기'), { kind: 'split', tw: 104, txt:
    lead('Settings › {{plug-ins}} shows every plug-in on this Mac, sorted by kind or by maker. One you never use can be left out, and the room’s lists stop showing it.', '설정 › {{plug-ins}}는 이 Mac에 깔린 모든 플러그인을 종류별이나 제작사별로 보여 줍니다. 쓰지 않는 것은 뺄 수 있고, 그러면 방의 목록에 더는 나오지 않습니다.') +
    legend(
      [1, '{{by kind}} sorts them as the room’s list does (instruments, eq, dynamics…); {{by maker}} by who made them, the makers with the most first', '{{by kind}}는 방의 목록처럼(악기, EQ, 다이내믹…) 나누고, {{by maker}}는 만든 회사별로, 가장 많은 회사부터 나눕니다'],
      [2, '{{find a plug-in}} by its name or its maker’s. [[esc]] clears it', '{{find a plug-in}} 이름이나 제작사 이름으로 찾습니다. [[esc]]로 지웁니다'],
      [3, 'a kind or a maker, and how many of it are in the lists: 13 of 14 when one is left out', '종류나 제작사, 그리고 그중 목록에 있는 수. 하나를 빼면 13/14처럼 나옵니다'],
      [4, 'a tick: in the lists. Click the row to leave it out, and again to take it back in', '체크: 목록에 있음. 줄을 클릭하면 빠지고, 다시 클릭하면 돌아옵니다'],
      [5, '{{leave all out}} and {{take all in}} do it to everything shown', '{{leave all out}}과 {{take all in}}은 보이는 모든 것에 한 번에 합니다'],
      [6, '{{bring every one back}} puts every plug-in back in the lists. {{look again}} finds plug-ins installed since', '{{bring every one back}}은 모든 플러그인을 목록에 되돌립니다. {{look again}}은 그 뒤에 깐 플러그인을 찾습니다'],
      [7, 'a plug-in’s kind: the row under the pointer shows it; click it to choose another (the one the room reads from the name says {{as the room reads it}}), or drag the row onto a kind on the left', '플러그인의 종류. 포인터가 올라간 줄에 나타나며, 클릭해서 다른 종류를 고릅니다(이름으로 읽은 종류에는 {{as the room reads it}}이라고 적혀 있습니다). 줄을 왼쪽의 종류로 끌어다 놓아도 됩니다'],
      [8, 'a dot before a row: its kind was set by hand. Click the dot to give it back', '줄 앞의 점: 종류를 직접 정했다는 뜻입니다. 점을 클릭하면 되돌아갑니다']) +
    p('What is left out is gone from the plug-in list of the patch and the wall, and from the instruments of a track of notes. A song that already uses one still opens with it. A kind set by hand is the kind everywhere the room sorts plug-ins by kind. [[⌘Z]] in the window takes the last change back.', '뺀 것은 패치와 월의 플러그인 목록, 노트 트랙의 악기 목록에서 사라집니다. 이미 그것을 쓰는 곡은 그대로 열립니다. 직접 정한 종류는 방이 플러그인을 종류별로 나누는 모든 곳에 그대로 쓰입니다. 창에서 [[⌘Z]]를 누르면 마지막 변경이 되돌아갑니다.'),
    art: fig('plugins', { w: 150, calls: [[1, 'p-by', 't'], [6, 'p-again', 't'], [2, 'p-find', 'l'], [3, 'p-group#3', 'l'], [4, 'p-tick#3', 'r'], [5, 'p-none', 't'], [7, 'p-kind', 'r'], [8, 'p-read', 'l']] }) }),

  page(t('the reference', '레퍼런스'), { kind: 'text', cc: 2, txt:
    p('((Track > Create Reference Track)) [[⌥⌘R]] brings in a song to hold the mix against. It stands in a row of its own above track 1, twice a track’s height; it keeps that height when the rows are zoomed and stays there while the tracks scroll. A press anywhere in its row and the reference is heard instead of the mix; a press on the room and the mix is heard again. It plays straight out, not through the stereo out’s wall, fader or guard. {{close}} puts the row away; [[⌥⌘R]] brings it back as it was.', '((Track > Create Reference Track)) [[⌥⌘R]]로 믹스와 비교할 곡을 가져옵니다. 트랙 1 위에 트랙 두 배 높이의 자기 줄로 서고, 줄 높이를 줌해도 그 높이 그대로, 트랙을 스크롤해도 그 자리에 있습니다. 그 줄 어디든 누르면 믹스 대신 레퍼런스가 들리고, 방을 누르면 다시 믹스가 들립니다. 스테레오 아웃의 벽, 페이더, 가드를 거치지 않고 바로 나갑니다. {{close}}로 줄을 치우고, [[⌥⌘R]]로 그대로 다시 띄웁니다.') +
    p('Its regions are edited with the room’s tools, as a track’s are: the pointer moves one along the song or trims it by an end (no further than the file goes); scissors cut it; the eraser takes it away; mute mutes it; gain makes it louder or softer; the fade tool pulls a fade in or out; join makes two one again where they meet as the file runs; [[⌫]] takes the chosen away. Each is a step of undo, and [[⌃]] pulls finely. So a reference can be lined up with the song, its intro cut off, or a chorus set beside the chorus.', '리전은 트랙처럼 방의 도구로 편집합니다. 포인터로 곡 위에서 옮기거나 끝을 잡아 줄입니다(파일이 있는 데까지만). 가위로 자르고, 지우개로 없애고, mute로 끄고, gain으로 키우거나 줄이고, 페이드 도구로 페이드 인·아웃을 끕니다. join은 파일 순서대로 맞닿은 두 리전을 다시 하나로 합칩니다. [[⌫]]는 선택한 리전을 지웁니다. 모두 실행 취소 한 단계이고, [[⌃]]로 미세하게 끕니다. 그래서 레퍼런스를 곡에 맞춰 정렬하거나, 인트로를 잘라 내거나, 코러스를 코러스 옆에 둘 수 있습니다.') }),

  page(t('quick help', '빠른 도움말'), { kind: 'text', cc: 2, txt:
    p('The small {{?}} at the top right of the transport panel, or ((Help > Quick Help)), turns quick help on. Then whatever the pointer rests on says, in a small card just under the pointer, what it is, what a press or a pull of it does, and the key that does it with the menu line that key runs. The key is the one of the set in use (settings > key commands), so with another DAW’s keys the card says those.', '트랜스포트 패널 오른쪽 위의 작은 {{?}}나 ((Help > Quick Help))로 빠른 도움말을 켭니다. 그러면 포인터가 놓인 것이 무엇인지, 누르거나 끌면 무엇을 하는지, 그 일을 하는 키와 그 키가 실행하는 메뉴 항목을 포인터 바로 아래 작은 카드에 알려 줍니다. 키는 지금 쓰는 키 세트(settings > key commands)의 키라서, 다른 DAW의 키를 쓰면 그 키로 나옵니다.') +
    p('On the lanes it says what the tool would do just there: on a region with the smart tool, its fades at the top corners, its ends, a crossfade where two meet, picking a stretch or moving it. Off again, nothing is shown. The app remembers which.', '레인에서는 그 자리에서 도구가 할 일을 알려 줍니다. 스마트 도구로 리전 위에 있으면 위쪽 모서리의 페이드, 양 끝, 두 리전이 만나는 크로스페이드, 구간 고르기나 옮기기. 다시 끄면 아무것도 나오지 않습니다. 앱은 켜고 끈 상태를 기억합니다.') }),
  page(t('keeping the machine light', '컴퓨터를 가볍게'), { kind: 'text', cc: 3, txt:
    h('tracks at rest', '쉬는 트랙') +
    p('A track that has had nothing coming in and nothing going out for longer than its plug-ins ring on (eight seconds at least, up to thirty when a plug-in says its tail is long) is not worked at all: its plug-ins and its patch rest until sound comes to it again, in the very block it comes. What you hear is the same; only silence is not worked out. With the song stopped, a room full of plug-ins comes down to a tenth of the work.', '들어오는 소리도 나가는 소리도 없이 플러그인의 꼬리보다 오래(최소 8초, 꼬리가 긴 플러그인은 최대 30초) 지난 트랙은 아예 계산하지 않습니다. 플러그인과 패치는 소리가 다시 오는 바로 그 블록까지 쉽니다. 들리는 소리는 같고, 무음만 계산하지 않습니다. 곡을 멈추면 플러그인이 가득한 방의 일이 10분의 1로 줄어듭니다.') +
    p('A muted track, or one soloed away, takes no sound in: its plug-ins ring out and then rest. A track that something listens to (a key, a side) is always worked, and nothing rests while a print is made.', '뮤트되었거나 솔로로 빠진 트랙은 소리를 받지 않으므로 플러그인이 울림을 마친 뒤 쉽니다. 무언가가 듣고 있는 트랙(키, 사이드)은 항상 계산하고, 프린트하는 동안에는 아무것도 쉬지 않습니다.') +
    h('freezing a track', '트랙 프리즈') +
    p('((Track > Freeze Track)), or {{freeze track}} in a track’s menu, prints the track once, before its fader, through its patch and plug-ins (an instrument and all), and from then on it plays that print: its plug-ins, instrument and patch rest even while the song plays. The head says {{frozen}} after its name. Fader, pan, sends and their lines go on as they were.', '((Track > Freeze Track))이나 트랙 메뉴의 {{freeze track}}은 트랙을 페이더 앞에서, 패치와 플러그인(악기 포함)을 거쳐 한 번 프린트하고, 그다음부터는 그 프린트를 재생합니다. 곡이 재생될 때도 플러그인, 악기, 패치가 쉽니다. 헤드의 이름 뒤에 {{frozen}}이 붙습니다. 페이더, 팬, 센드와 그 라인은 그대로 작동합니다.') +
    list(
      ['Change anything the print was made from (a region, a note, a plug-in put on, taken off or opened, the patch, a line of a print or plug-in, the tempo) and the track thaws by itself.', '프린트의 재료가 바뀌면(리전, 노트, 플러그인 추가, 제거, 열기, 패치, 프린트나 플러그인의 라인, 템포) 트랙은 저절로 풀립니다.'],
      ['The same line again, or {{unfreeze track}}, thaws it by hand.', '같은 메뉴를 다시 누르거나 {{unfreeze track}}으로 직접 풀 수 있습니다.'],
      ['A song keeps its frozen tracks: the print is a file in its folder, read again when the song opens.', '곡은 프리즈된 트랙을 그대로 간직합니다. 프린트는 곡 폴더의 파일이며, 곡을 열 때 다시 읽습니다.']) +
    h('switching a track off', '트랙 끄기') +
    p('((Track > Disable Track)) leaves a track out altogether: nothing of it is worked and it is silent until it is switched on again.', '((Track > Disable Track))은 트랙을 통째로 뺍니다. 다시 켤 때까지 아무것도 계산하지 않고 소리도 나지 않습니다.') }),
  page(t('after a bad end', '비정상 종료 뒤에'), { kind: 'text', cc: 3, txt:
    h('what protects the work', '작업을 지키는 것') +
    list(
      ['The song is written every 3 seconds when something changed.', '바뀐 것이 있으면 3초마다 곡을 저장합니다.'],
      ['A take being recorded is made whole on the disk every second.', '녹음 중인 테이크는 1초마다 디스크에 온전한 파일로 정리됩니다.'],
      ['Earlier copies of the song are kept for ((File > Revert To…)).', '곡의 이전 사본이 ((File > Revert To…))를 위해 보관됩니다.'],
      ['The app notes which plug-in it is inside at every moment, so it can say which one it was.', '앱은 매 순간 어느 플러그인 안에 있는지 적어 두므로, 문제가 된 것이 무엇인지 말해 줄 수 있습니다.']) +
    h('at the next start', '다음에 시작할 때') +
    p('The project that was open comes back by itself, as it was last saved, and a notice says once what happened. Its title is one of:', '열려 있던 프로젝트가 마지막으로 저장된 상태로 저절로 돌아오고, 무슨 일이 있었는지 안내가 한 번 뜹니다. 제목은 다음 중 하나입니다.') +
    list(
      ['{{the app stopped by itself last time}}: a crash', '{{the app stopped by itself last time}}: 충돌'],
      ['{{the app was not closed last time}}: a forced quit, or the power going', '{{the app was not closed last time}}: 강제 종료 또는 전원 차단'],
      ['{{a print did not come back when the app was closed}}: you quit while a hand off or bounce was stuck inside a plug-in', '{{a print did not come back when the app was closed}}: 내보내기나 바운스가 플러그인 안에서 멈춘 채로 종료함']) +
    p('Its lines name what came back and what is left out, for example a plug-in that “was playing when the app stopped, and is left out”, or “a take that was being recorded is back on” its track. Press {{ok}}, or anywhere, to put it away.', '안내의 각 줄은 돌아온 것과 빠진 것을 알려 줍니다. 예를 들어 플러그인이 “was playing when the app stopped, and is left out”, 또는 녹음 중이던 테이크가 트랙에 돌아왔다는 줄. {{ok}}나 아무 곳이나 누르면 닫힙니다.') +
    h('plug-ins left out', '빠진 플러그인') +
    p('A plug-in that is left out keeps its place in the patch and all its settings. Click it to open it again; [[⌥]] click one to bring back every one of the song.', '빠진 플러그인은 패치에서의 자리와 모든 설정을 유지합니다. 클릭하면 다시 열고, 하나를 [[⌥]] 클릭하면 곡의 모든 것이 돌아옵니다.') +
    p('The plug-in that was playing or being opened when the app went down is not trusted from then on: the app will not open it by itself in any project. It comes back only by a click of its own, and is trusted again once it opens and the app is still standing.', '앱이 꺼질 때 재생 중이었거나 열리던 플러그인은 그때부터 믿지 않습니다. 어떤 프로젝트에서도 앱이 스스로 열지 않습니다. 직접 클릭해야만 돌아오고, 열린 뒤 앱이 멀쩡하면 다시 믿습니다.') +
    p('If the app ends badly twice running on the same song and no plug-in could be named, the song comes back without any of its plug-ins; each keeps its place and is brought back by hand.', '같은 곡에서 연달아 두 번 비정상 종료했는데 탓할 플러그인을 가려내지 못하면, 곡은 플러그인 없이 돌아옵니다. 자리는 그대로이며 손으로 되살립니다.') +
    h('takes', '테이크') +
    p('A take that was being recorded is mended on the disk and put back where it was being played. The foot says “1 take brought back”.', '녹음 중이던 테이크는 디스크에서 복구되어 연주하던 자리에 돌아옵니다. 아래에 “1 take brought back”이라고 나옵니다.') +
    h('going further back', '더 이전으로') +
    p('((File > Revert To…)) lists the song as it was at up to 24 earlier moments.', '((File > Revert To…))는 최대 24개의 이전 시점을 보여 줍니다.') }),

  page(t('not in this version', '이 버전에 없는 것'), { kind: 'text', cc: 3, txt:
    p('Slur Studio 0.1.7 is an alpha and a sketch tool. Knowing what is not there yet saves looking for it.', 'Slur Studio 0.1.7는 알파이자 스케치 도구입니다. 아직 없는 것을 알아 두면 찾느라 헤매지 않습니다.') +
    h('time', '시간') +
    list(
      ['tempo changes or measure changes along the song: one tempo, one measure', '곡 중간의 템포, 박자 변경: 템포 하나, 박자 하나'],
      ['dotted grids', '점음표 그리드']) +
    h('editing', '편집') +
    list(
      ['comping and take folders', '컴핑과 테이크 폴더'],
      ['a gain line inside a region', '리전 안의 게인 라인'],
      ['quantize strength and swing for regions of sound (notes have them)', '오디오 리전의 퀀타이즈 강도와 스윙(노트에는 있음)'],
      ['settings for strip silence', '무음 제거 설정'],
      ['slipping the sound inside a region', '리전 안에서 소리만 밀기']) +
    h('notes', '노트') +
    list(
      ['a choice of MIDI input or channel for a track; MIDI out', '트랙별 MIDI 입력이나 채널 선택. MIDI 출력'],
      ['undo for what is done on an instrument’s page', '악기 페이지에서 한 일의 실행 취소']) +
    h('recording', '녹음') +
    list(
      ['loop recording, punch in and out', '루프 녹음, 펀치 인/아웃'],
      ['a count-in other than one bar, a click level or sound', '한 마디 이외의 카운트인, 클릭 레벨이나 소리 선택'],
      ['input monitoring that switches by itself', '저절로 켜지는 입력 모니터링']) +
    h('mixing', '믹싱') +
    list(
      ['pre-fader sends; more than one output', '프리 페이더 센드. 둘 이상의 출력'],
      ['a plug-in’s own presets chosen from the room (a whole patch is kept as a preset)', '앱 안에서 플러그인 자체 프리셋 고르기(패치 전체는 프리셋으로 저장됨)'],
      ['writing automation by moving a control', '컨트롤을 움직여 오토메이션 쓰기'],
      ['undo for mixer moves made by hand', '손으로 한 믹서 조작의 실행 취소'],
      ['a clip light on the mixer’s strips that stays lit', '믹서 스트립에 계속 켜져 있는 클립 표시등'],
      ['requests made by the sound other than two tracks apart (wider, further back…)', '두 트랙 떼어 놓기 말고 소리로 하는 다른 요청(wider, further back…)']) +
    h('the app', '앱') +
    list(
      ['a way back to the start page without quitting; more than one project open', '종료 없이 시작 화면으로 돌아가기. 프로젝트 여러 개 동시에 열기'],
      ['templates of your own', '직접 만든 템플릿'],
      ['settings other than general, display, audio, key commands and plug-ins', 'general, display, audio, key commands, plug-ins 외의 설정'],
      ['a Windows version', 'Windows 버전']) }),
])
