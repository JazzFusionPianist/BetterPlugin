import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('patch', t('the patch', '패치'),
  t('Every track has a patch: a wall on which effects stand and are wired together, the way they are in Patch on Slur. Patch on Slur’s prints and plug-ins from outside stand on the same wall.', '트랙마다 패치가 있습니다. 이펙트를 올려놓고 선으로 잇는 벽이고, Patch on Slur와 같은 방식입니다. Patch on Slur의 프린트와 외부 플러그인이 같은 벽에 섭니다.'), [

  page(t('the wall', '벽'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '{{in}} where the sound enters. On a track of notes the instrument stands here', '{{in}} 소리가 들어오는 곳. 노트 트랙에서는 악기가 여기 섭니다'],
      [2, 'a print, one of Patch on Slur’s own effects. Drag it up or down for its amount', '프린트. Patch on Slur의 자체 이펙트입니다. 위아래로 드래그하면 양이 바뀝니다'],
      [3, 'two ways side by side: one output wired to two things', '나란한 두 갈래: 출력 하나를 두 곳에 이었습니다'],
      [4, '{{mix}} takes any number of wires. The number on a wire is its level. {{blends}}: a hundred in all. {{adds}}: each set freely', '{{mix}}는 선을 몇 개든 받습니다. 선 위의 숫자가 그 선의 레벨. {{blends}}: 합쳐서 100. {{adds}}: 각각 자유롭게'],
      [5, 'a plug-in from outside. Click it for its window', '외부 플러그인. 클릭하면 창이 열립니다'],
      [6, '{{out}}', '{{out}}'],
      [7, '{{add}} opens the list of prints and plug-ins', '{{add}} 프린트와 플러그인 목록을 엽니다'],
      [8, 'the chosen track’s strip, and the stereo out', '선택한 트랙의 스트립, 그리고 스테레오 아웃']) +
    p('A patch begins empty: {{in}} and {{out}} with nothing between, and the sound goes by untouched. What is picked from the list stands on the wall with no wire; nothing changes until a way runs through it from in to out. Sixteen things fit on a wall.', '패치는 비어서 시작합니다. {{in}}과 {{out}} 사이에 아무것도 없고 소리는 그대로 지나갑니다. 목록에서 고른 것은 선 없이 벽에 놓이고, in에서 out까지 길이 이어져야 소리가 바뀝니다. 벽 하나에 열여섯 개까지 놓입니다.'),
    art: fig('patch', { w: 226, calls: [[1, 'wall:port#1', 'b'], [2, 'wall:node#1', 't'], [3, 'wall:node#2', 't'], [4, 'wall:node#4', 't'], [5, 'wall:node#5', 't'], [6, 'wall:end', 'b'], [7, 'plugs', 'b'], [8, 'mvol', 't']] }) }),

  page(t('working on the wall', '벽에서 하는 일'), { kind: 'text', cc: 2, txt:
    table(null,
      [['drag from the dot at a thing’s right to another thing', '오른쪽 점에서 다른 것으로 드래그'], ['a wire. One output can feed several things; a wire that would make a ring is not drawn', '선이 생깁니다. 출력 하나를 여러 곳에 이을 수 있고, 고리가 되는 선은 그려지지 않습니다']],
      [['click a wire, then [[⌫]]', '선을 클릭하고 [[⌫]]'], ['the wire is taken away', '선이 사라집니다']],
      [['drag a print up or down', '프린트 위아래 드래그'], ['its amount; [[⇧]] is finer. Double-click or [[⌥]] click: back to where it rests', '양. [[⇧]]는 미세하게. 더블 클릭이나 [[⌥]] 클릭: 기본값으로']],
      [['drag the words under a thing', '아래 글자를 드래그'], ['moves it. Set down on a wire, a thing with no wires joins that wire', '옮깁니다. 선이 없는 것을 선 위에 놓으면 그 선에 끼어듭니다']],
      [['drag the number on a wire', '선 위의 숫자 드래그'], ['its level into the mix', 'mix로 들어가는 레벨']],
      [['scroll', '스크롤'], ['nearer and further, about the pointer. Drag the empty wall to move it; double-click it to see all', '포인터 중심으로 확대, 축소. 빈 벽을 드래그하면 이동, 더블 클릭하면 전체 보기']],
      [['click a thing', '클릭'], ['it is chosen: its other hands stand along the foot of the wall, with {{bypass}}, {{wet only}} and {{remove}}', '선택됩니다. 벽 아래에 나머지 조절값과 {{bypass}}, {{wet only}}, {{remove}}가 나옵니다']]) +
    p('The stereo out has a wall of its own: click the name under its strip. What stands there is heard on the whole song, before the stereo out’s fader, and goes into a print of the mix; a print of single tracks does not pass it.', '스테레오 아웃에도 벽이 있습니다. 스트립 아래의 이름을 클릭합니다. 거기 놓인 것은 곡 전체에, 스테레오 아웃 페이더 앞에서 걸리고 믹스 프린트에 들어갑니다. 트랙별 프린트는 지나지 않습니다.') +
    note('Ways side by side are lined up: when a plug-in on one way is late, the others are held back by as much. Changes to the wiring are not steps of undo.', '나란한 갈래는 시간이 맞춰집니다. 한 갈래의 플러그인이 늦으면 다른 갈래를 그만큼 늦춥니다. 배선을 바꾸는 것은 실행 취소 단계가 아닙니다.') }),

  page(t('presets', '프리셋'), { kind: 'text', cc: 2, txt:
    p('A wall can be kept under a name and put on any track. The bar in the middle of the patch panel’s head names the patch that is up: {{untitled}} for a wall never kept, and a star after the name once a kept wall has been changed.', '패치는 이름을 붙여 저장해 두고 어느 트랙에든 올릴 수 있습니다. 패치 패널 머리줄 가운데의 막대가 지금 올라와 있는 패치의 이름입니다. 한 번도 저장하지 않은 패치는 {{untitled}}, 저장한 뒤 고치면 이름 뒤에 별표가 붙습니다.') +
    table(null,
      [['click the name', '이름 클릭'], ['the list: {{initial}}, the empty wall, then every kept patch', '목록이 열립니다. {{initial}}은 빈 패치, 그 아래는 저장한 패치들']],
      [['click a name in the list', '목록의 이름 클릭'], ['that patch takes the place of everything on this track’s wall. One undo brings the wall back, its plug-ins with their settings', '그 패치가 이 트랙의 패치를 통째로 대신합니다. 실행 취소 한 번이면 전 패치가 플러그인 설정까지 그대로 돌아옵니다']],
      [['the arrows beside the name', '이름 옆 화살표'], ['the one before and the one after in the list', '목록의 앞 패치, 뒤 패치']],
      [['{{save}}', '{{save}}'], ['writes over the patch that is up', '지금 올라온 패치 파일에 덮어씁니다']],
      [['{{save as…}}', '{{save as…}}'], ['the Mac’s save panel, in the presets’ folder', 'Mac 저장 창이 프리셋 폴더에서 열립니다']],
      [['{{open…}}', '{{open…}}'], ['a preset file kept anywhere', '다른 곳에 둔 프리셋 파일을 엽니다']],
      [['{{remove}}, then {{sure?}}', '{{remove}}, 이어서 {{sure?}}'], ['the file goes to the Trash', '파일이 휴지통으로 갑니다']]) +
    note('Presets are the files Patch on Slur keeps (.orbpatch, in ~/Library/Application Support/Orb/Sounds/Presets): a patch kept in one is in the other’s list. A preset kept here holds the plug-ins from outside with their settings. Patch on Slur shows only the prints and wires of such a file, and a file saved again there no longer holds the plug-ins. A plug-in this Mac does not have keeps its place on the wall and is named.', '프리셋은 Patch on Slur가 쓰는 파일과 같습니다(.orbpatch, ~/Library/Application Support/Orb/Sounds/Presets). 한쪽에서 저장한 패치가 다른 쪽 목록에도 뜹니다. 여기서 저장한 프리셋에는 외부 플러그인과 그 설정이 함께 들어갑니다. Patch on Slur는 그런 파일에서 프린트와 배선만 보여 주고, 거기서 다시 저장하면 플러그인 정보는 빠집니다. 이 Mac에 없는 플러그인은 패치 위에 자리를 지키고 이름으로 알려 줍니다.') }),

  page(t('the prints', '프린트'), { kind: 'text', cc: 2, txt:
    p('The prints are Patch on Slur’s effects, with the same sound and the same pictures. In the list they stand among the plug-ins of their kind, and all together under {{slur}}.', '프린트는 Patch on Slur의 이펙트입니다. 소리도 그림도 같습니다. 목록에서는 같은 종류의 플러그인 사이에 있고, {{slur}} 아래에 전부 모여 있습니다.') +
    table(null,
      [['tone', 'tone'], ['{{cut}} {{amp}} {{tone}} {{tape}} {{glue}} {{comp}} {{air}}', '{{cut}} {{amp}} {{tone}} {{tape}} {{glue}} {{comp}} {{air}}']],
      [['grit', 'grit'], ['{{crush}} {{radio}} {{ring}} {{fold}}', '{{crush}} {{radio}} {{ring}} {{fold}}']],
      [['space', 'space'], ['{{delay}} {{space}} {{shimmer}} {{doubler}} {{stereo}}', '{{delay}} {{space}} {{shimmer}} {{doubler}} {{stereo}}']],
      [['motion', 'motion'], ['{{mod}} {{tremolo}} {{swell}} {{stutter}} {{gate}} {{wow}} {{repeat}}', '{{mod}} {{tremolo}} {{swell}} {{stutter}} {{gate}} {{wow}} {{repeat}}']],
      [['pitch', 'pitch'], ['{{pitch}} {{formant}} {{harmony}} {{arp}} {{grain}}', '{{pitch}} {{formant}} {{harmony}} {{arp}} {{grain}}']],
      [['utility', 'utility'], ['{{gain}} {{mix}} {{l/r}} {{m/s}} {{pan}}', '{{gain}} {{mix}} {{l/r}} {{m/s}} {{pan}}']],
      [['spectral', 'spectral'], ['{{carve}} {{match}} {{vocode}} {{freeze}} {{shift}} {{smear}} {{sieve}}', '{{carve}} {{match}} {{vocode}} {{freeze}} {{shift}} {{smear}} {{sieve}}']]) +
    p('A print has one big hand, its amount, pulled on its picture. Its other hands (a delay’s time and feedback, a compressor’s ratio, attack and release, a reverb’s decay) stand along the foot of the wall when it is chosen: drag a number, or click a word for its list. {{l/r}} and {{m/s}} have two outputs, one for each half.', '프린트에는 큰 조절값 하나, 양이 있고 그림 위에서 드래그합니다. 나머지 조절값(딜레이의 시간과 피드백, 컴프레서의 비율·어택·릴리즈, 리버브의 길이)은 프린트를 선택하면 벽 아래에 나옵니다. 숫자는 드래그하고, 단어는 클릭해서 목록에서 고릅니다. {{l/r}}과 {{m/s}}는 출력이 둘입니다.') +
    note('One each of tape, space and delay stands on a wall: these three have automation lines and words on the command line. Not in this version: Patch on Slur’s control prints (LFO, rate, macro, follow, env, drift, pulse, scene), side, bands, and the drawn editors of the study.', 'tape, space, delay는 벽마다 하나씩입니다. 이 셋에는 오토메이션 라인과 명령줄 단어가 있습니다. 이 버전에 없는 것: Patch on Slur의 컨트롤 프린트(LFO, rate, macro, follow, env, drift, pulse, scene), side, bands, 그리고 스터디의 그리는 편집기.') }),

  page(t('plug-ins', '플러그인'), { kind: 'split', tw: 116, mid: true, txt:
    p('Audio Units and VST3 plug-ins stand on the wall beside the prints. The list is read once each time the app runs: a plug-in installed while the app is open appears after the app is started again.', 'Audio Unit과 VST3 플러그인은 프린트 옆, 같은 벽에 섭니다. 목록은 앱을 실행할 때마다 한 번 읽습니다. 앱이 열려 있는 동안 설치한 플러그인은 앱을 다시 시작하면 나타납니다.') +
    p('The list opens inside the patch’s panel, at the right of the wall, with the kinds down its left ({{eq}}, {{dynamics}}, {{reverb}} and so on). Click a kind to list only that kind; typing searches all of them. The kind is read from the plug-in’s name: an unusual name may stand under {{other}}.', '목록은 패치 패널 안, 벽 오른쪽에 열리고 왼쪽에 종류({{eq}}, {{dynamics}}, {{reverb}} 등)가 있습니다. 종류를 클릭하면 그 종류만 나오고, 입력하면 전체에서 찾습니다. 종류는 플러그인 이름으로 판단하므로 이름이 특이하면 {{other}}에 들어갈 수 있습니다.') +
    table(null,
      [['add', '추가'], ['pick it from the list. Its window comes up at once and it stands on the wall, to be wired', '목록에서 고릅니다. 창이 바로 뜨고 벽에 놓입니다. 선으로 이어야 합니다']],
      [['its window', '창'], ['click its frame. [[V]] closes all plug-in windows', '테두리를 클릭. [[V]]는 모든 플러그인 창을 닫습니다']],
      [['off, on', '끄기, 켜기'], ['[[⌥]] click the frame, or {{off}} at the foot of the wall. It is drawn dim; the sound goes by untouched', '테두리를 [[⌥]] 클릭, 또는 벽 아래의 {{off}}. 흐리게 그려지고 소리는 그대로 지나갑니다']],
      [['remove', '제거'], ['choose it and click {{remove}}; it turns to {{sure?}}; click again. The wire closes over its place', '선택하고 {{remove}}를 클릭하면 {{sure?}}로 바뀝니다. 다시 클릭. 그 자리는 선이 이어집니다']],
      [['what it listens to', '무엇을 듣는가'], ['right-click the frame: {{its own track}}, or another track, heard on the plug-in’s second input. A compressor on the bass that ducks to the kick listens to the kick', '테두리를 오른쪽 클릭: {{its own track}}, 또는 다른 트랙. 플러그인의 두 번째 입력으로 들어갑니다. 킥에 맞춰 눌리는 베이스 컴프레서는 킥을 듣습니다']]) +
    p('Their settings are saved with the project. Adding, removing and switching off are not steps of undo.', '설정은 프로젝트에 저장됩니다. 추가, 제거, 끄기는 실행 취소 단계가 아닙니다.') +
    h('left out', 'left out') +
    p('A plug-in is drawn dim with {{left out}} when the project was opened and it would not open, or when the app has learnt not to open it by itself after a bad end. It keeps its place and its settings.', '프로젝트를 열 때 플러그인이 열리지 않았거나, 비정상 종료 뒤 앱이 그 플러그인을 스스로 열지 않기로 했을 때 {{left out}}과 함께 흐리게 그려집니다. 자리와 설정은 그대로입니다.') +
    table(null,
      [['click it', '클릭'], ['it is opened again in its place', '제자리에서 다시 엽니다']],
      [['[[⌥]] click it', '[[⌥]] 클릭'], ['every left-out plug-in of the song comes back, except those the app does not trust', '곡의 모든 left out 플러그인이 돌아옵니다. 앱이 믿지 않는 것은 제외']]),
    art: draw(138, 78,
      D.txt(0, 4, 'a patch with a print and two plug-ins in a row', '프린트 하나와 플러그인 둘을 한 줄로 이은 패치', 's') +
      D.dot(4, 28, 1.1) + D.txt(4, 35, 'in', 'in', 'xs m') + D.arrow([[5.5, 28], [14, 28]]) +
      D.cell(14, 20, 18, 16, 'tape', 'tape', 'on') + D.arrow([[32, 28], [40, 28]]) +
      D.cell(40, 20, 24, 16, 'compressor', 'compressor') + D.txt(52, 41, 'au', 'au', 'xs m') + D.arrow([[64, 28], [72, 28]]) +
      D.cell(72, 20, 24, 16, 'equaliser', 'equaliser', 'soft') + D.txt(84, 41, 'vst3, off', 'vst3, off', 'xs m') + D.arrow([[96, 28], [130, 28]]) + D.dot(132, 28, 1.1) + D.txt(132, 35, 'out', 'out', 'xs m') +
      // the key input
      D.cell(40, 58, 24, 10, 'kick', 'kick') + D.arrow([[52, 58], [52, 47.5]]) + D.txt(66, 64, 'the track it listens to (its key input)', '듣는 트랙(키 입력)', 'xs') +
      D.txt(0, 76, 'the sound takes the chain from left to right', '소리는 체인을 왼쪽에서 오른쪽으로 지나갑니다', 'xs')) }),
])
