import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('start', t('the start page and projects', '시작 화면과 프로젝트'),
  t('The app opens on a page of its own: a new project across the top, every project you have under it. This chapter also covers saving, earlier copies, and bringing sound in.', '앱은 자기만의 첫 화면으로 열립니다. 위에는 새 프로젝트, 아래에는 가지고 있는 모든 프로젝트. 저장, 이전 사본, 소리 가져오기도 이 장에서 다룹니다.'), [

  page(t('the start page', '시작 화면'), { kind: 'split', tw: 104, txt:
    p('The start page shows every time the app is opened by itself. It is skipped when you open a project from the Finder, and when the app comes back after a bad end with a project that was open. Nothing is written to the disk while it is up.', '앱을 열면 언제나 시작 화면이 뜹니다. Finder에서 프로젝트를 열었을 때와 비정상 종료 뒤 프로젝트가 되돌아올 때만 건너뜁니다. 이 화면에서는 디스크에 아무것도 쓰지 않습니다.') +
    legend(
      [1, '__new project__ tempo, measure and key for the new song, and {{create}}. Click a number to type it', '__new project__ 새 곡의 템포, 박자, 키와 {{create}}. 숫자를 클릭하면 입력할 수 있습니다'],
      [2, '__templates__ what the project begins as. The lit one is chosen', '__템플릿__ 프로젝트가 처음 갖고 시작할 트랙. 밝은 것이 선택된 것'],
      [3, '{{find}} narrows the list as you type; {{open from disk}} opens a project anywhere', '{{find}}는 입력하는 대로 목록을 좁히고, {{open from disk}}는 디스크 어디에 있는 프로젝트든 엽니다'],
      [4, '__a project__ name, when it was saved, tempo, key, tracks, length, size on disk', '__프로젝트 한 줄__ 이름, 저장 시각, 템포, 키, 트랙 수, 길이, 디스크 크기'],
      [5, '__the project from far away__ one thin line for each track, where its regions lie, on a scale of minutes shared by all rows', '__멀리서 본 프로젝트__ 트랙마다 가는 선 하나, 리전이 놓인 자리. 모든 줄이 같은 분 단위 눈금을 씁니다'],
      [6, '__the machine__ input, output, rate, buffer, free disk, and {{audio settings}}', '__기기 상태__ 입력, 출력, 레이트, 버퍼, 디스크 여유, {{audio settings}}']) +
    table(null,
      ['[[↑]] [[↓]]', ['the project above, below', '위, 아래 프로젝트']],
      ['[[←]] [[→]]', ['the template before, after', '이전, 다음 템플릿']],
      ['[[tab]]', ['between the projects and the templates', '프로젝트 목록과 템플릿 사이 이동']],
      ['[[↩]]', ['open the chosen project, or create when the templates were touched last', '선택한 프로젝트 열기. 마지막으로 템플릿을 건드렸다면 만들기']],
      ['[[⌘N]]', ['create from the chosen template', '선택한 템플릿으로 만들기']],
      ['[[⌘O]]', ['open a project from anywhere on the disk', '디스크 어디서든 프로젝트 열기']],
      ['[[⌘F]]', ['find; or just type a letter', '찾기. 그냥 글자를 쳐도 됩니다']],
      [['double-click a row', '줄 더블 클릭'], ['open it', '열기']]),
    art: fig('start', { w: 136, calls: [[1, [60, 60], 't'], [2, [470, 40], 't'], [3, [1010, 203], 'r'], [4, [150, 262], 'l'], [5, [820, 348], 'r'], [6, [930, 708], 'b']] }) +
      `<div style="width:140mm">` + table([['template', '템플릿'], ['tracks it makes', '만드는 트랙']],
        ['{{empty}}', ['one audio track', '오디오 트랙 하나']],
        ['{{voice and guitar}}', ['vox, vox double, guitar, guitar 2; buses plate (reverb) and slap (delay)', 'vox, vox double, guitar, guitar 2. 버스 plate(리버브), slap(딜레이)']],
        ['{{band}}', ['drums, bass, keys, guitar left, guitar right, lead vox, backing vox; bus plate', 'drums, bass, keys, guitar left, guitar right, lead vox, backing vox. 버스 plate']],
        ['{{beat}}', ['kit, bass, keys, pad as tracks of notes; lead vox; bus plate', 'kit, bass, keys, pad는 노트 트랙. lead vox. 버스 plate']],
        ['{{mixing}}', ['buses drums, bass, music, vocals, plate, slap, all playing into a bus print', '버스 drums, bass, music, vocals, plate, slap. 모두 print 버스로 나갑니다']]) +
        note('This page cannot be reached from inside a project. Rename a project with ((File > Rename…)); remove one by putting its folder (from before: its .sls file) in the Trash.', '프로젝트 안에서 이 화면으로 돌아올 수는 없고, 이 화면에서 이름을 바꾸거나 지울 수도 없습니다. 이름은 ((File > Rename…))로 바꾸고, 지울 때는 프로젝트 폴더(예전 프로젝트는 .sls 파일)를 휴지통에 넣습니다.') + `</div>` }),

  page(t('folders', '폴더'), { kind: 'split', tw: 104, txt:
    p('Projects can be kept in folders on the start page. A folder is a row of the list: a mark that opens it, its name, how many projects it holds. Open, its projects stand under it, set in.', '시작 화면에서 프로젝트를 폴더에 넣어 둘 수 있습니다. 폴더는 목록의 한 줄입니다. 여닫는 표시, 이름, 들어 있는 프로젝트 수. 열면 그 안의 프로젝트가 한 칸 들어간 채 아래에 섭니다.') +
    table(null,
      [['a new folder', '새 폴더'], ['{{new folder}} beside the count, or [[⇧⌘N]]. A row appears at the top with its name being typed: [[↩]] makes it, [[esc]] lets it go', '개수 옆의 {{new folder}} 또는 [[⇧⌘N]]. 맨 위에 줄이 생기고 이름을 입력합니다. [[↩]]로 만들고 [[esc]]로 취소']],
      [['put a project in', '프로젝트 넣기'], ['drag its row onto the folder, or onto a project inside it', '줄을 폴더 위로, 또는 폴더 안의 프로젝트 위로 드래그']],
      [['take it out', '꺼내기'], ['drag its row onto a project that is in no folder', '줄을 폴더 밖의 프로젝트 위로 드래그']],
      [['open, close', '열기, 닫기'], ['click the mark, double-click the row, or [[↩]]', '표시를 클릭, 줄을 더블 클릭, 또는 [[↩]]']],
      [['remove', '지우기'], ['[[⌫]] on an empty folder. One that holds projects stays', '빈 폴더에서 [[⌫]]. 프로젝트가 들어 있으면 지워지지 않습니다']]) +
    note('On the disk a folder is a plain folder in ~/Music/Slur Studio/Projects, so the Finder shows the same. While you are finding by name the folders step back: every project that matches is listed, with its folder’s name beside it. A folder cannot be renamed here yet.', '디스크에서 폴더는 ~/Music/Slur Studio/Projects 안의 보통 폴더라서 Finder에서도 똑같이 보입니다. 이름으로 찾는 동안에는 폴더가 물러나고, 맞는 프로젝트가 폴더 이름과 함께 모두 나옵니다. 폴더 이름 바꾸기는 아직 여기서 할 수 없습니다.'),
    art: fig('folders', { w: 150, calls: [[1, 'st-folder', 't'], [2, 'st-fold', 'l'], [3, 'st-row#2', 'r']] }) +
      legend(
        [1, '{{new folder}}', '{{new folder}}'],
        [2, '__the mark__ opens and closes the folder', '__표시__ 폴더를 여닫습니다'],
        [3, '__a project in the folder__ set in under it', '__폴더 안의 프로젝트__ 한 칸 들어가서 섭니다']) }),

  page(t('saving and opening', '저장과 열기'), { kind: 'split', tw: 150, txt:
    table([['what', '무엇'], ['how', '방법'], ['what happens', '일어나는 일']],
      [['save', '저장'], '[[⌘S]] ((File > Save))', ['Saves now, plug-in settings included; the foot says {{saved}}. A project never named yet: the Mac’s panel asks where and under what name, and the project goes there in a folder of its own. The app also saves by itself every 3 seconds when something changed, never in the middle of a drag or a take.', '지금 저장합니다. 플러그인 설정도 함께. 아래에 {{saved}}라고 나옵니다. 아직 이름을 붙인 적 없는 프로젝트면 Mac의 저장 창이 위치와 이름을 묻고, 프로젝트는 그곳에 자기 폴더로 들어갑니다. 바뀐 것이 있으면 3초마다 저절로 저장하며, 드래그나 녹음 도중에는 하지 않습니다.']],
      [['save as', '다른 이름으로'], '[[⇧⌘S]] ((File > Save As…))', ['The Mac’s panel, offering “name 2”. The project goes there in a folder of its own (the project, Audio Files, Bounces) with all its sounds, and you carry on in the copy; the old one stays as it was last saved.', 'Mac의 저장 창이 “이름 2”를 제안합니다. 프로젝트가 소리와 함께 그곳에 자기 폴더(프로젝트, Audio Files, Bounces)로 들어가고, 이후로는 사본에서 작업합니다. 원래 것은 마지막 저장 상태로 남습니다.']],
      [['new', '새로 만들기'], '[[⌘N]] ((File > New))', ['The open project is saved, then a project called untitled opens with one audio track. It keeps the tempo and measure of the song that was open.', '열린 프로젝트를 저장한 뒤 untitled라는 프로젝트가 오디오 트랙 하나와 함께 열립니다. 열려 있던 곡의 템포와 박자를 이어받습니다.']],
      [['open', '열기'], '[[⌘O]] ((File > Open…))', ['The Mac’s panel, for a project anywhere on the disk. A project also opens by double-clicking its file in the Finder. A project that takes more than a moment to open shows a card in the middle: what is being made ready and how far along it is.', 'Mac의 열기 창. 디스크 어디에 있는 프로젝트든 엽니다. Finder에서 파일을 더블 클릭해도 열립니다. 여는 데 시간이 걸리는 프로젝트는 창 가운데에 카드가 떠서 무엇을 준비하는지와 얼마나 진행됐는지 보여 줍니다.']],
      [['open recent', '최근 항목'], '((File > Open Recent))', ['The twelve projects worked on last, the open one ticked. ((File > Open Recent > More…)) opens a list in the window of up to 24.', '마지막에 작업한 프로젝트 12개가 나오고, 열린 것에는 체크가 붙습니다. ((File > Open Recent > More…))는 창 안에 최대 24개의 목록을 엽니다.']],
      [['rename', '이름 바꾸기'], '((File > Rename…))', ['A small box labelled {{name}}. The project, and its folder, are renamed where they lie. A name keeps its capitals, 40 characters at most.', '{{name}}이라는 작은 칸. 프로젝트와 그 폴더가 제자리에서 이름이 바뀝니다. 이름은 대문자를 그대로 지키며 최대 40자.']]),
    art: `<div style="width:100mm">` + h('what a project remembers', '프로젝트가 기억하는 것') +
      list(
        ['tempo, measure, key, markers, the cycle', '템포, 박자, 키, 마커, 사이클'],
        ['every track with its regions, alternatives, sends, lines, patch, instrument, and plug-ins with their settings', '모든 트랙과 그 리전, 대체 버전, 센드, 오토메이션 라인, 패치, 악기, 설정이 담긴 플러그인'],
        ['the click and the count-in, the stereo out’s level and its patch', '클릭과 카운트인, 스테레오 아웃 레벨과 그 패치'],
        ['the view: zoom, scroll, row height, which panels were open', '보기 상태: 줌, 스크롤, 줄 높이, 열려 있던 패널'],
        ['the edit mode, the nudge value, the grid, the quantize value', '편집 모드, 넛지 값, 그리드, 퀀타이즈 값']) +
      h('what it does not', '기억하지 않는 것') +
      list(
        ['low latency mode: it starts off each time', '로우 레이턴시 모드. 매번 꺼진 채 시작합니다'],
        ['the tool and the second tool', '도구와 두 번째 도구'],
        ['undo history: it starts empty each time a project opens', '실행 취소 기록. 프로젝트를 열 때마다 비어서 시작합니다'],
        ['open plug-in windows', '열려 있던 플러그인 창']) + `</div>` }),

  page(t('going back, and the rest of the file menu', '되돌아가기, 그리고 파일 메뉴의 나머지'), { kind: 'split', tw: 150, txt:
    table([['what', '무엇'], ['how', '방법'], ['what happens', '일어나는 일']],
      [['revert to', '이전 사본으로'], '((File > Revert To…))', ['The song as it was earlier, newest first: “today 14:05”, “yesterday 9:12”. The song as it is now is put aside first, so going back can itself be taken back from the same list.', '이전 시점의 곡 목록, 최신부터. “today 14:05”, “yesterday 9:12”. 지금 상태를 먼저 따로 보관하므로, 되돌아간 것도 같은 목록에서 다시 되돌릴 수 있습니다.']],
      [['quit', '종료'], '[[⌘Q]]', ['If the song changed since you last saved it yourself, the app asks: {{save}} [[↩]], {{don’t save}} [[D]], {{cancel}} [[esc]]. Don’t save puts the file back as it was then; the rest stays under ((File > Revert To…)).', '직접 저장한 뒤 곡이 바뀌었으면 묻습니다. {{save}} [[↩]], {{don’t save}} [[D]], {{cancel}} [[esc]]. don’t save는 파일을 그때로 되돌리고, 나머지는 ((File > Revert To…))에 남습니다.']],
      [['find missing sounds', '없는 소리 찾기'], '((File > Find Missing Sounds…))', ['A sound the project cannot find stays on its lane as an outline marked {{not found}} and plays nothing; on opening, the app says how many. Point the Mac’s panel at the folder it is in: it is copied into the project and plays again.', '프로젝트가 찾지 못한 소리는 레인에 윤곽만 남아 {{not found}}로 표시되고 소리가 나지 않습니다. 열 때 몇 개인지 알려 줍니다. Mac의 창에서 그 소리가 든 폴더를 고르면 프로젝트 안으로 복사되고 다시 소리가 납니다.']],
      [['import audio', '오디오 가져오기'], '[[⌘I]] ((File > Import Audio…))', ['See the next page.', '다음 쪽 참고.']],
      [['hand off', '내보내기'], '[[⌘B]] ((File > Hand Off…))', ['See “hand off and bounce”.', '“내보내기와 바운스” 장 참고.']]) +
    note('Earlier copies hold the song only, not its sounds. One is made at most every ten minutes of work, and the newest 24 are kept.', '이전 사본에는 곡만 들어 있고 소리는 들어 있지 않습니다. 작업 10분에 하나까지 만들어지며 최근 24개를 보관합니다.'),
    art: `<div style="width:100mm">` + h('messages you may see', '볼 수 있는 메시지') +
      table(null,
        ['{{that name is taken}}', ['a project of that name is already there', '같은 이름의 프로젝트가 이미 있음']],
        ['{{that project would not open}}', ['the file could not be read', '파일을 읽지 못함']],
        ['{{the disk has no room for a copy}}', ['save as needs the project’s size and a little more', '다른 이름으로 저장하려면 프로젝트 크기보다 조금 더 필요']],
        ['{{no earlier copy of this song yet}}', ['nothing to revert to yet', '아직 되돌아갈 사본이 없음']]) + `</div>` }),

  page(t('bringing sound in', '소리 가져오기'), { kind: 'split', tw: 106, mid: true, txt:
    lead('Drag files from the Finder onto the window, or press [[⌘I]]. Either way each file is copied into the project; while dragged files come in, a card shows how far along it is.', 'Finder에서 파일을 창으로 끌어다 놓거나 [[⌘I]]를 누릅니다. 어느 쪽이든 파일은 프로젝트 안으로 복사됩니다. 끌어다 놓은 파일이 들어오는 동안에는 카드가 진행 상황을 보여줍니다.') +
    table(null,
      [['kinds', '종류'], ['wav, aif, aiff, mp3, m4a, flac, ogg, caf. A dropped .mid file becomes tracks of notes', 'wav, aif, aiff, mp3, m4a, flac, ogg, caf. .mid 파일을 떨어뜨리면 노트 트랙이 됩니다']],
      [['dragged', '드래그'], ['Lands at the bar under the pointer. Over an audio lane the first file goes on that lane and the others on new tracks below; anywhere else each file gets a new track. A dashed frame shows where it will land', '포인터 아래 마디에 놓입니다. 오디오 레인 위라면 첫 파일은 그 레인에, 나머지는 아래 새 트랙에. 다른 곳이면 파일마다 새 트랙. 점선 테두리가 놓일 자리를 보여 줍니다']],
      ['[[⌘I]]', ['Lands at the playhead. The first file goes on the chosen track if it is an audio track of your own; each further file gets a new track', '플레이헤드 위치에 놓입니다. 선택한 트랙이 내 오디오 트랙이면 첫 파일이 거기에, 나머지는 새 트랙에']],
      [['on a sampler', '샘플러 위에'], ['One file dropped on a sampler’s lane becomes the sound the sampler plays', '샘플러 트랙의 레인에 파일 하나를 떨어뜨리면 그 샘플러가 연주할 소리가 됩니다']]) +
    h('the tempo of what comes in', '들어오는 소리의 템포') +
    list(
      ['A number from 60 to 200 in the file’s name (“loop 92 bpm”) is taken as its tempo. Within 8 % of the song’s tempo, the file is fitted to the song as it lands.', '파일 이름 속 60~200 사이 숫자(“loop 92 bpm”)를 그 파일의 템포로 읽습니다. 곡 템포와 8 % 이내면 놓이면서 곡에 맞춰집니다.'],
      ['When the name says nothing and the file is longer than 2 seconds, the app listens, and says what it heard: “guitar goes at 92.0”.', '이름에 단서가 없고 파일이 2초보다 길면 앱이 들어 보고 알려 줍니다. “guitar goes at 92.0”.'],
      ['A new track is named after its file. Its colour comes from its name, or from its first sound: struck things read as drums, a low held sound as bass.', '새 트랙은 파일 이름을 따릅니다. 색은 이름에서, 또는 첫 소리에서 정해집니다. 때리는 소리는 드럼, 낮게 끄는 소리는 베이스로 읽습니다.']) +
    note('A file longer than 20 minutes is held only in part when the disk has no room to keep it ready; the app says so.', '20분이 넘는 파일은 디스크에 준비해 둘 공간이 없으면 일부만 올려 두며, 앱이 그렇게 알려 줍니다.'),
    art: draw(140, 92,
      D.txt(0, 4, 'where a dragged file lands', '끌어온 파일이 놓이는 곳', 's') +
      // three lanes
      [0, 1, 2].map(i => D.box(22, 10 + i * 14, 118, 12, 'tint') + D.txt(0, 17.5 + i * 14, ['kick', 'bass', 'vox'][i], ['kick', 'bass', 'vox'][i], 's')).join('') +
      D.box(30, 11, 40, 10, 'soft') + D.box(74, 25, 50, 10, 'soft') + D.box(28, 39, 30, 10, 'soft') +
      // drop on a lane
      D.box(84, 11, 34, 10, 'blf') + D.txt(101, 17.5, 'loop.wav', 'loop.wav', 's m blue') + D.arrow([[101, 2], [101, 10]]) + D.txt(104, 5, 'over a lane: on that lane, at that bar', '레인 위: 그 레인, 그 마디에', 'xs') +
      // drop below
      D.box(22, 56, 118, 4, 'dash') + D.arrow([[60, 72], [60, 61]]) + D.txt(64, 70, 'anywhere else: a new track for each file', '다른 곳: 파일마다 새 트랙', 'xs') +
      D.txt(0, 86, 'what was under a file gives way: one sound at a time on a track', '파일 밑에 있던 것은 자리를 내줍니다. 트랙에서는 한 번에 한 소리', 'xs')) }),
])
