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
    p('The panel is 300 wide. When it opens, the tracks’ bar, the markers, the lanes and the panel under them end at its left edge; the control bar and the foot keep the whole width. Whether it was open is saved with the project.', '패널 폭은 300입니다. 열리면 트랙 바, 마커, 레인, 아래 패널이 그 왼쪽 가장자리에서 끝나고, 컨트롤 바와 맨 아래 줄은 전체 폭을 유지합니다. 열려 있었는지는 프로젝트에 저장됩니다.') +
    note('The effects button of the Slur page is hidden here: in Slur Studio the patch is the app’s own.', 'Slur 페이지의 이펙트 버튼은 여기서 숨겨집니다. Slur Studio에서는 패치가 앱 자체의 것이기 때문입니다.'),
    art: draw(150, 92,
      D.box(0, 4, 150, 84, 'k') +
      `<rect x="0" y="4" width="150" height="7" class="db k2"/>` + D.txt(4, 9, 'control bar', '컨트롤 바', 'xs wh2') +
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
      [5, '{{low latency}} with the bolt on the control bar lit, what is heard live steps past any plug-in later than this: 1, 3, 5, 10 or 20 ms, 5 at first', '{{low latency}} 컨트롤 바의 번개가 켜져 있으면, 직접 듣는 소리는 이보다 늦는 플러그인을 건너뜁니다: 1, 3, 5, 10, 20 ms, 처음엔 5'],
      [6, '{{threads}} how many of the Mac’s cores work on the sound. {{all}} at first', '{{threads}} 소리 처리에 쓰는 Mac 코어 수. 처음엔 {{all}}'],
      [7, '{{test tone}} {{play}}', '{{test tone}} {{play}}']) +
    p('The device, rate, buffer and threads cannot be changed while a take or a print is under way. When the device moves to another rate, the app follows and says so at the foot: “now at 48k”.', '녹음이나 바운스가 진행 중일 때는 장치, 레이트, 버퍼, 스레드를 바꿀 수 없습니다. 장치의 레이트가 바뀌면 앱이 따라가고 아래에 알려 줍니다. “now at 48k”.') +
    note('{{display}} and {{plug-ins}} have pages of their own, next. The parts drawn dim down the left (recording, editing, notes, command line, slur, hand off, storage) are not made yet.', '{{display}}와 {{plug-ins}}는 다음 쪽부터 따로 설명합니다. 왼쪽에 흐리게 그려진 항목(recording, editing, notes, command line, slur, hand off, storage)은 아직 만들어지지 않았습니다.'),
    art: fig('settings', { w: 140, calls: [[1, [1072, 117], 'r'], [2, [1072, 161], 'r'], [3, [1072, 240], 'r'], [4, [1072, 285], 'r', -2], [5, [1072, 314], 'r', 3], [6, [1072, 377], 'r'], [7, [1050, 410], 'b']] }) }),

  page(t('display: every part, every quality', 'display: 모든 부분, 모든 속성'), { kind: 'split', tw: 104, txt:
    lead('Settings › {{display}} lists every part of the room and every quality of it as plain values. Nothing is chosen for you: the room as it comes is the one starting point, and a look is only what you changed.', '설정 › {{display}}는 방의 모든 부분과 그 모든 속성을 값 그대로 보여 줍니다. 미리 정해 둔 것은 없습니다. 처음 그대로의 방이 유일한 출발점이고, 모습(look)은 바꾼 것만으로 이루어집니다.') +
    legend(
      [1, '{{look}} the look in use: {{as it comes}} or one you kept, and how many changes since. Click it to wear another', '{{look}} 지금 쓰는 모습. {{as it comes}} 또는 간직한 모습과, 그 뒤로 바뀐 곳의 수. 클릭해서 다른 모습을 입힙니다'],
      [2, '{{find a part}} by its name, or by the name of one of its qualities', '{{find a part}} 부분의 이름이나 그 속성의 이름으로 찾습니다'],
      [3, 'the parts of the room. One with a caret opens into smaller parts', '방의 부분들. 꺾쇠가 있는 것은 더 작은 부분으로 열립니다'],
      [4, 'a colour: its well opens the Mac’s colour panel, its value can be typed as #rrggbb, and the % is how much of it', '색. 색 칸은 Mac의 색상 패널을 열고, 값은 #rrggbb로 직접 칠 수 있으며, %는 그 색의 세기입니다'],
      [5, 'a number: drag it up or down ([[⇧]] for finer steps), or click it and type', '숫자. 위아래로 드래그하거나([[⇧]]를 누르면 더 잘게) 클릭해서 칩니다'],
      [6, 'a dot before a quality: it is not as the room comes. Click the dot to put it back', '속성 앞의 점: 처음 그대로가 아니라는 뜻입니다. 점을 클릭하면 되돌아갑니다'],
      [7, '{{keep as…}} keeps the look by a name. {{open…}} and {{share…}} read and write a .slurlook file, to hand a look to someone', '{{keep as…}}는 모습을 이름 붙여 간직합니다. {{open…}}과 {{share…}}는 .slurlook 파일을 읽고 써서 모습을 다른 사람에게 건넵니다']) +
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
    p('Slur Studio 0.1.0 is an alpha and a sketch tool. Knowing what is not there yet saves looking for it.', 'Slur Studio 0.1.0은 알파이자 스케치 도구입니다. 아직 없는 것을 알아 두면 찾느라 헤매지 않습니다.') +
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
      ['a clip light on the mixer’s strips that stays lit', '믹서 스트립에 계속 켜져 있는 클립 표시등']) +
    h('the app', '앱') +
    list(
      ['changing key commands: the sheet only lists them', '단축키 바꾸기: 표는 보여 주기만 합니다'],
      ['a way back to the start page without quitting; more than one project open', '종료 없이 시작 화면으로 돌아가기. 프로젝트 여러 개 동시에 열기'],
      ['templates of your own', '직접 만든 템플릿'],
      ['settings other than general, display, audio and plug-ins', 'general, display, audio, plug-ins 외의 설정'],
      ['a Windows version', 'Windows 버전']) }),
])
