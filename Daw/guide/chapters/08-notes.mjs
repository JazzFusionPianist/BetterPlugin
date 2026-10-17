import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('notes', t('notes and instruments', '노트와 악기'),
  t('A track of notes holds what was played and an instrument that plays it. Three instruments are built in, plug-in instruments open beside them, and the computer’s keys can be the keyboard.', '노트 트랙은 연주한 내용과 그것을 연주하는 악기를 담습니다. 악기 세 가지가 들어 있고, 플러그인 악기도 나란히 열리며, 컴퓨터 자판이 건반이 될 수 있습니다.'), [

  page(t('tracks of notes', '노트 트랙'), { kind: 'split', tw: 150, txt:
    p('Make one from the new-track list ({{kind}} {{midi}}) or at once with [[⌥⌘S]]. It is named for what it plays. Its regions have cut corners and show each note as a short line, higher for a higher key.', '새 트랙 목록에서({{kind}} {{midi}}), 또는 [[⌥⌘S]]로 바로 만듭니다. 이름은 연주하는 악기를 따릅니다. 리전은 모서리가 깎인 모양이고, 노트 하나하나가 짧은 선으로, 높은 음일수록 위에 그려집니다.') +
    fig('notes', { w: 150 }) +
    h('the instrument', '악기') +
    p('The instrument stands at the head of the track’s patch, where an audio track has {{in}}. Press [[B]] to see it.', '악기는 트랙 패치의 맨 앞, 오디오 트랙의 {{in}} 자리에 섭니다. [[B]]를 눌러 봅니다.') +
    table(null,
      [['click its plate', '플레이트 클릭'], ['one of the app’s own: its page opens where the patch stood, and {{chain}} in the panel’s bar goes back. A plug-in: its window opens', '앱의 자체 악기: 패치 자리에 악기 페이지가 열리고, 패널 줄의 {{chain}}으로 돌아갑니다. 플러그인: 창이 열립니다']],
      [['{{change}} under it', '아래의 {{change}}'], ['the list of instruments. Choosing a row changes the instrument at once', '악기 목록. 줄을 고르면 바로 악기가 바뀝니다']]) +
    h('the list of instruments', '악기 목록') +
    p('Plug-in instruments come first, by name, with the maker beside the name and {{au}} or {{vst3}} at the right. Those left out in ((Slur Studio > Settings > Plug-ins)) are not listed; a song that already uses one still opens it. The app’s own follow, marked {{slur}}: the synth’s fourteen sounds, then {{kit}} and {{sampler}}. Type to narrow the list, by name or maker. A new track starts on {{e piano}}.', '플러그인 악기가 이름순으로 먼저 나오고, 이름 옆에 제조사, 오른쪽에 {{au}}나 {{vst3}}가 붙습니다. ((Slur Studio > Settings > Plug-ins))에서 뺀 것은 나오지 않으며, 이미 그것을 쓰는 곡은 그대로 열립니다. 그 뒤에 {{slur}}로 표시된 앱의 자체 악기가 옵니다. 신스의 열네 가지 소리, 그리고 {{kit}}과 {{sampler}}. 이름이나 제조사를 입력하면 목록이 좁혀집니다. 새 트랙은 {{e piano}}로 시작합니다.') +
    note('Everything turned on an instrument’s page is heard at once and saved with the project, but it is not part of undo and cannot be automated. Choosing another sound starts from that sound’s own values.', '악기 페이지에서 돌린 것은 바로 들리고 프로젝트에 저장되지만, 실행 취소 대상이 아니고 오토메이션도 걸 수 없습니다. 다른 소리를 고르면 그 소리의 기본값에서 시작합니다.'),
    art: fig('instlist', { w: 96 }) }),

  page(t('the synth', '신스'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '__the sound__ fourteen sounds, each drawn as its instrument. Click a small plate to choose: e piano, soft keys, organ, bell, marimba, pluck, sub bass, round bass, saw bass, warm pad, strings, glass pad, square lead, saw lead', '__소리__ 열네 가지 소리가 각각 악기 그림으로 그려져 있습니다. 작은 플레이트를 클릭해 고릅니다. e piano, soft keys, organ, bell, marimba, pluck, sub bass, round bass, saw bass, warm pad, strings, glass pad, square lead, saw lead'],
      [2, '{{wave}} the shape of each of the two oscillators (saw, square, triangle, sine) and, on the line under them, how much of each', '{{wave}} 두 오실레이터 각각의 파형(톱니, 사각, 삼각, 사인)과, 그 아래 선에서 둘의 비율'],
      [3, '{{filter}} drag the mark left and right for {{cutoff}} (20 Hz to 20 kHz), up and down for {{resonance}}. {{slope}}: gentle or steep', '{{filter}} 표시를 좌우로 드래그하면 {{cutoff}}(20 Hz~20 kHz), 위아래로 드래그하면 {{resonance}}. {{slope}}: 완만하게 또는 가파르게'],
      [4, '{{loudness}} how a note rises and dies. Four marks: attack, decay and the held level, the held level alone, release', '{{loudness}} 노트가 커지고 사라지는 모양. 표시 네 개: 어택, 디케이와 유지 레벨, 유지 레벨만, 릴리스'],
      [5, '{{movement}} {{wavers}}: vibrato depth. {{slides}}: how long a note takes to slide to the next', '{{movement}} {{wavers}}: 비브라토 깊이. {{slides}}: 다음 노트로 미끄러지는 시간'],
      [6, '{{voices}} {{many}} or {{one}}. One plays a single note at a time', '{{voices}} {{many}} 또는 {{one}}. one은 한 번에 한 음만 냅니다'],
      [7, '{{chain}} back to the patch', '{{chain}} 패치로 돌아가기']) +
    p('Take hold of the drawing itself; small ink squares show what can be moved. [[⇧]] drag is finer. [[⌥]] click puts a thing back to the value the sound has by itself.', '그림 자체를 잡습니다. 작은 검은 네모가 움직일 수 있는 곳입니다. [[⇧]] 드래그는 더 미세하게. [[⌥]] 클릭은 그 소리의 기본값으로 되돌립니다.') +
    p('Played, it answers to velocity (louder and brighter), pitch bend (two semitones each way), the mod wheel (vibrato) and the sustain pedal. It plays up to 16 notes at once.', '연주할 때 벨로시티(더 크고 밝게), 피치 벤드(위아래 두 반음), 모듈레이션 휠(비브라토), 서스테인 페달에 반응합니다. 동시에 16음까지 냅니다.'),
    art: fig('synth', { w: 240, calls: [[1, [160, 78], 't'], [2, 'iv:wave1', 'b', -4], [3, 'iv:filter', 't'], [4, 'iv:env', 't'], [5, 'iv:vib', 't'], [6, 'iv:mono', 'b'], [7, 'iv:chain', 't']] }) }),

  page(t('the kit', '킷'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '{{pads}} sixteen pads in a four by four grid. Click one: it is chosen and heard. Bottom row from the left: kick, rim, snare, clap', '{{pads}} 4 x 4로 놓인 패드 열여섯 개. 클릭하면 선택되고 소리가 납니다. 맨 아랫줄 왼쪽부터 kick, rim, snare, clap'],
      [2, '__the chosen pad__ its picture (click to hear it again) and its stroke: how loud it is from the moment it is struck', '__선택한 패드__ 그림(클릭하면 다시 들림)과 스트로크: 때린 순간부터의 소리 크기'],
      [3, 'the mark at the end of the stroke: drag left and right for how long it rings. The mark at the left edge: up and down for its level, −36 to +6 dB', '스트로크 끝의 표시: 좌우로 드래그하면 울리는 길이. 왼쪽 가장자리의 표시: 위아래로 드래그하면 레벨, −36~+6 dB'],
      [4, '{{sound}} {{made here}} means the app makes the drum. The menu also lists the project’s own sounds: choose one and the pad plays that file', '{{sound}} {{made here}}는 앱이 드럼 소리를 만든다는 뜻. 메뉴에는 프로젝트의 소리도 나옵니다. 고르면 패드가 그 파일을 연주합니다'],
      [5, '{{tune}} −24 to +24 semitones, and {{pan}}', '{{tune}} −24~+24 반음, 그리고 {{pan}}']) +
    table([['pad', '패드'], ['key', '건반'], ['pad', '패드'], ['key', '건반']],
      ['kick', 'c1', 'high tom', 'c2'], ['rim', 'c#1', 'crash', 'c#2'], ['snare', 'd1', 'ride', 'd#2'], ['clap', 'd#1', 'tambourine', 'f#2'],
      ['low tom', 'f1', 'cowbell', 'g#2'], ['hat', 'f#1', 'conga', 'd#3'], ['mid tom', 'a1', 'shaker', 'a#3'], ['open hat', 'a#1', 'clave', 'd#4']) +
    p('Hat and open hat cut each other off. Velocity makes a pad louder; the kit does not answer to bend, wheel or pedal. A file must already be in the project (imported, recorded or bounced) to be given to a pad.', 'hat과 open hat은 서로를 끊습니다. 벨로시티가 클수록 패드 소리가 커지고, 킷은 벤드, 휠, 페달에는 반응하지 않습니다. 패드에 줄 파일은 이미 프로젝트 안에 있어야 합니다(가져오기, 녹음, 바운스).'),
    art: fig('kit', { w: 226, calls: [[1, 'iv:pad#6', 't'], [2, [511, 100], 't'], [3, [915, 126], 't'], [4, 'iv:padsound', 'b'], [5, [564, 246], 'b']] }) }),

  page(t('the sampler', '샘플러'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '{{sound}} the menu lists the project’s own sounds. Or drag one audio file from the Finder onto the sampler track’s lane', '{{sound}} 메뉴에 프로젝트의 소리가 나옵니다. 또는 Finder에서 오디오 파일 하나를 샘플러 트랙의 레인으로 드래그합니다'],
      [2, 'the sound’s outline. Two upright lines mark where it starts and ends; drag them. With {{goes round}} on, the stretch that goes round is marked along the top in ochre', '소리의 윤곽. 세로선 두 개가 시작과 끝을 표시합니다. 드래그해서 옮깁니다. {{goes round}}가 켜져 있으면 반복되는 구간이 위쪽에 황토색으로 표시됩니다'],
      [3, '{{loudness}} the same four marks as the synth’s', '{{loudness}} 신스와 같은 표시 네 개'],
      [4, '{{plays}} {{while held}}, or {{to its end}} whatever the key does', '{{plays}} {{while held}}(누르는 동안), 또는 건반과 상관없이 {{to its end}}(끝까지)'],
      [5, '{{goes round}} with {{yes}}, a held key goes round the marked stretch; let go, it runs on to its end', '{{goes round}} {{yes}}면 누르는 동안 표시된 구간을 반복하고, 놓으면 끝까지 이어집니다'],
      [6, '{{its key}} the key the sound was made on. Click a key to set it', '{{its key}} 소리의 원래 음. 건반을 클릭해 정합니다']) +
    p('One sound, played up and down the keys from its own key. With no sound it is silent. It answers to velocity, pitch bend (two semitones) and the sustain pedal.', '소리 하나를 원래 음을 기준으로 건반 위아래로 연주합니다. 소리가 없으면 조용합니다. 벨로시티, 피치 벤드(두 반음), 서스테인 페달에 반응합니다.') +
    h('plug-in instruments', '플러그인 악기') +
    p('An Audio Unit or VST3 instrument is chosen from the same list. Its window opens when it is chosen; click its frame in the patch to open it again, and [[V]] closes all plug-in windows. If it will not open with a project, it is drawn faint with {{left out}}; click it to choose an instrument again.', 'Audio Unit이나 VST3 악기도 같은 목록에서 고릅니다. 고르면 창이 열립니다. 패치에서 테두리를 클릭하면 다시 열리고, [[V]]는 모든 플러그인 창을 닫습니다. 프로젝트와 함께 열리지 않으면 {{left out}}과 함께 흐리게 그려집니다. 클릭해서 악기를 다시 고릅니다.'),
    art: fig('sampler', { w: 240, calls: [[1, 'iv:smsound', 't'], [2, 'iv:sm', 't'], [3, 'iv:senv', 't'], [4, 'iv:oneShot', 'b'], [5, 'iv:loop', 'b'], [6, 'iv:root', 'b']] }) }),

  page(t('playing', '연주하기'), { kind: 'split', tw: 104, txt:
    h('who hears the keyboard', '건반 소리를 듣는 트랙') +
    p('The chosen track, if it is a track of notes, and every armed track of notes, all at once. There is nothing to set: no device, no channel.', '선택한 트랙(노트 트랙일 때)과 녹음 대기 중인 모든 노트 트랙이 동시에 듣습니다. 설정할 것은 없습니다. 장치도 채널도 고르지 않습니다.') +
    h('a MIDI keyboard', 'MIDI 건반') +
    p('Every MIDI input the Mac has is listened to from the moment the app starts; one plugged in later is listened to as well.', 'Mac의 모든 MIDI 입력을 앱이 시작할 때부터 듣습니다. 나중에 꽂은 것도 듣습니다.') +
    h('the computer’s keys', '컴퓨터 자판') +
    p('[[⌘K]] turns the computer’s keys into a keyboard, and back. A sheet with a piano on it lies over the lanes; everything on it can be pressed with the pointer too.', '[[⌘K]]는 컴퓨터 자판을 건반으로 바꾸고, 다시 누르면 되돌립니다. 피아노가 그려진 판이 레인 위에 놓이며, 그 위의 모든 것은 포인터로도 누를 수 있습니다.') +
    table(null,
      ['[[A]] [[S]] [[D]] [[F]] [[G]] [[H]] [[J]] [[K]] [[L]] [[;]] [[\']]', ['the white keys from c', 'c부터의 흰 건반']],
      ['[[W]] [[E]] [[T]] [[Y]] [[U]] [[O]] [[P]]', ['the black keys', '검은 건반']],
      ['[[Z]] [[X]]', ['an octave down, up. It starts at c3, middle c', '옥타브 아래, 위. c3(가운데 도)에서 시작']],
      ['[[C]] [[V]]', ['softer, harder by 10. It starts at 100', '10씩 여리게, 세게. 100에서 시작']],
      ['[[tab]]', ['the sustain pedal, while held', '누르는 동안 서스테인 페달']],
      ['[[1]] [[2]]', ['bend down, up, while held', '누르는 동안 벤드 아래, 위']],
      ['[[3]] … [[8]]', ['the mod wheel at six places', '모듈레이션 휠 여섯 단계']]) +
    note('While the keyboard is on, those bare keys play and do not reach their commands (solo S, click K, cycle C, mixer X, fades F D G and so on). Space, R, Q, M, N, B, the arrows and every command with a modifier still work.', '건반이 켜져 있는 동안 위의 키들은 연주에 쓰이고 원래 명령(솔로 S, 클릭 K, 사이클 C, 믹서 X, 페이드 F D G 등)은 동작하지 않습니다. space, R, Q, M, N, B, 화살표, 그리고 수정 키가 붙은 명령은 그대로 됩니다.') +
    table(null,
      ['[[⌃⌘.]]', ['every note off', '모든 노트 끄기']]),
    art: fig('keyboard-sheet', { w: 150, calls: [[1, [110, 30], 't'], [2, 'kb:key#1', 'b'], [3, 'kb:oct', 'r'], [4, 'kb:vel', 'r', 3], [5, 'kb:ped', 'b'], [6, 'kb:mod#3', 'b']] }) +
      `<div style="width:150mm">` + legend(
        [1, 'the track that hears it, by its colour and name', '소리를 듣는 트랙. 색과 이름으로 표시'],
        [2, 'each key carries the letter that plays it; a held key lights in the track’s colour', '건반마다 해당 글자가 적혀 있고, 누른 건반은 트랙 색으로 켜집니다'],
        [3, '{{from}} where the letters start', '{{from}} 글자가 시작하는 음'],
        [4, '{{velocity}} how hard the keys play', '{{velocity}} 건반의 세기'],
        [5, '{{pedal}} and {{bend}}', '{{pedal}}과 {{bend}}'],
        [6, '{{wheel}}', '{{wheel}}']) + `</div>` }),

  page(t('the notes page', '노트 페이지'), { kind: 'split', tw: 104, txt:
    p('[[P]] opens the notes of the chosen region under the lanes; so does a double-click on a region of notes. {{patch}}, {{mixer}}, {{notes}}, {{prompt}} and {{rubato}} are the panel’s pages. A note is drawn as the stroke its sound makes: as tall as its instrument is loud at each moment, fainter where it rings on after the key. Its colour says how hard it is played: blue when soft, the ink’s own colour in the middle, orange to red when hard.', '[[P]]를 누르면 선택한 리전의 노트가 레인 아래에 열립니다. 노트 리전을 더블 클릭해도 열립니다. {{patch}}, {{mixer}}, {{notes}}, {{prompt}}, {{rubato}}가 패널의 페이지입니다. 노트는 그 소리가 만드는 획으로 그려집니다. 순간마다 악기 소리가 큰 만큼 두껍고, 건반을 뗀 뒤 울리는 부분은 옅습니다. 색은 얼마나 세게 쳤는지를 말합니다. 약하면 파랑, 중간은 잉크 색, 세면 주황에서 빨강.') +
    table(null,
      [['choose', '선택'], ['click a note; [[⇧]] click, one more or less; drag over the paper for all it crosses; [[⌘A]] all; [[esc]] none', '노트 클릭. [[⇧]] 클릭으로 하나 더하거나 빼기. 빈 곳을 드래그하면 걸치는 것 모두. [[⌘A]] 전부, [[esc]] 해제']],
      [['move', '옮기기'], ['drag along the grid and up or down the keys; with [[⌥]] copies are carried. [[⌥]] and an arrow: one nudge or a key; [[⇧⌥↑]] an octave', '그리드를 따라, 건반 위아래로 드래그. [[⌥]]를 누르면 사본이 옮겨집니다. [[⌥]]와 화살표: 넛지 한 번 또는 한 음. [[⇧⌥↑]] 한 옥타브']],
      [['longer, shorter', '길이'], ['drag a note’s end', '노트의 끝을 드래그']],
      [['make', '만들기'], ['double-click the paper; with the pencil tool or [[⌘]], one click', '빈 곳을 더블 클릭. 연필 도구나 [[⌘]]를 누른 채라면 한 번 클릭']],
      [['remove, copy', '지우기, 복사'], ['[[⌫]]; [[⌘C]] [[⌘X]], then [[⌘V]] at the playhead', '[[⌫]]. [[⌘C]] [[⌘X]] 뒤 [[⌘V]]로 플레이헤드 자리에']],
      [['how hard', '세기'], ['the {{velocity}} line at the left, for the chosen notes; or [[A]] for the lane under the notes and drag a bar there', '왼쪽의 {{velocity}} 줄로 선택한 노트의 세기를. 또는 [[A]]로 노트 아래 레인을 올려 막대를 드래그']],
      [['look around', '둘러보기'], ['the wheel goes up and down the keys, sideways along the song; a pinch or [[⌘]] with the wheel zooms. [[⌘←]] [[⌘→]] further, nearer; [[⌘↑]] [[⌘↓]] shorter, taller rows', '휠은 건반 위아래로, 옆으로는 곡을 따라. 핀치 또는 [[⌘]]와 휠로 확대. [[⌘←]] [[⌘→]] 축소, 확대. [[⌘↑]] [[⌘↓]] 줄을 낮게, 높게']],
      [['quantize', '퀀타이즈'], ['[[Q]] pulls the chosen notes to the grid of the panel at the left; [[⌥⌘Q]] lets them go back', '[[Q]]는 선택한 노트를 왼쪽 패널의 그리드로 당깁니다. [[⌥⌘Q]]는 원래 자리로']]) +
    note('A note made or moved past the region’s end makes the region longer, as far as the next region on its lane. Notes are shown where they sound: a region’s quantize, transposing and repeats are in the picture.', '리전 끝을 넘어 만들거나 옮긴 노트는 리전을 늘립니다. 같은 레인의 다음 리전까지. 노트는 소리 나는 자리에 그려집니다. 리전의 퀀타이즈, 트랜스포즈, 반복이 그림에 들어 있습니다.'),
    art: fig('roll', { w: 152, calls: [[1, 'np:key', 't'], [2, 'np:note', 't'], [3, 'np:clane', 'b'], [4, 'np:grid', 't'], [5, 'np:ruler', 't'], [6, 'np:qgrid', 'l'], [7, 'np:lane', 'l']] }) +
      legend(
        [1, '__the keys__ in the track’s colour. Press one to hear it', '__건반__ 트랙의 색으로. 누르면 소리가 납니다'],
        [2, '__a note__ its body, then its ring', '__노트__ 몸통, 그리고 울림'],
        [3, '__the lane__ [[A]] brings it up: here something turned along the region, a point at each place', '__레인__ [[A]]로 올립니다. 여기서는 리전을 따라 움직이는 값, 자리마다 점 하나'],
        [4, '{{grid}} the page’s own grid, 1/16 to begin with', '{{grid}} 이 페이지의 그리드. 처음에는 1/16'],
        [5, '__the bars__ click to move the playhead', '__마디 눈금__ 클릭하면 플레이헤드가 옮겨집니다'],
        [6, '__time quantize__ the chosen notes to a grid: how far, how late', '__time quantize__ 선택한 노트를 그리드로. 정도와 스윙'],
        [7, '{{automation}} the lane’s own key, and under it what the lane shows', '{{automation}} 레인을 올리는 키, 그 아래는 레인이 보여 주는 것']) }),

  page(t('the panel at the left, and the lane', '왼쪽 패널과 레인'), { kind: 'text', cc: 2, txt:
    h('time quantize', 'time quantize') +
    p('{{q}} pulls the chosen notes to the grid named beside it (every note of the region when none is chosen); picking a grid from the list (1/4 to 1/32, and the triplet ones) does the same at once. Each note remembers where it was played: {{q}} again, or {{off}} in the list, lets the chosen ones go back. {{strength}} is how far each goes towards the grid, {{swing}} how late the off-beats lie; pulled, the quantized notes among the chosen follow. A note you move by hand is where you put it from then on. The grid, strength and swing stay as you set them, also the next time the app is opened.', '{{q}}를 누르면 선택한 노트가 옆에 적힌 그리드로 당겨집니다(선택이 없으면 리전의 모든 노트). 목록에서 그리드(1/4부터 1/32, 그리고 셋잇단)를 골라도 바로 같은 일이 일어납니다. 노트마다 친 자리를 기억합니다. {{q}}를 다시 누르거나 목록의 {{off}}를 고르면 선택한 노트가 원래 자리로 돌아갑니다. {{strength}}는 그리드 쪽으로 가는 정도, {{swing}}은 엇박이 늦어지는 정도이며, 끌면 선택된 것 가운데 퀀타이즈된 노트가 따라 움직입니다. 손으로 옮긴 노트는 그때부터 옮긴 자리가 제자리입니다. 그리드, strength, swing은 정해 둔 대로 남고, 앱을 다시 열어도 그대로입니다.') +
    h('scale quantize', 'scale quantize') +
    p('Pick a root and a scale; {{q}} moves the chosen notes (all of them when none is chosen) to the nearest key of that scale. This one rewrites the notes; [[⌘Z]] takes it back.', '으뜸음과 스케일을 고르고 {{q}}를 누르면 선택한 노트(선택이 없으면 전부)가 그 스케일의 가장 가까운 음으로 옮겨집니다. 이것은 노트를 고쳐 씁니다. [[⌘Z]]로 되돌립니다.') +
    h('velocity', 'velocity') +
    p('The line sets how hard the chosen notes are played; with nothing chosen it is how hard the next note you make will be.', '이 줄은 선택한 노트의 세기를 정합니다. 선택이 없으면 다음에 만드는 노트의 세기입니다.') +
    h('tools', '도구') +
    table(null,
      [['cut, erase', '자르기, 지우개'], ['[[T]] then [[I]], the scissors: a note clicked is cut there, on the grid. [[T]] then [[E]], the eraser: a note clicked goes', '[[T]] 다음 [[I]], 가위: 클릭한 노트가 그리드의 그 자리에서 잘립니다. [[T]] 다음 [[E]], 지우개: 클릭한 노트가 지워집니다']],
      [['the velocity tool', '벨로시티 도구'], ['[[T]] then [[V]]: drag a note up or down and it is played harder or softer, the other chosen notes with it; [[⇧]] for finer steps', '[[T]] 다음 [[V]]: 노트를 위아래로 드래그하면 더 세게, 더 약하게 연주됩니다. 선택된 다른 노트도 함께. [[⇧]]를 누르면 더 미세하게']],
      [['force legato', '포스 레가토'], ['[[L]]: each chosen note lasts until the next one begins (all of them when none is chosen)', '[[L]]: 선택한 노트 각각이 다음 노트가 시작할 때까지 이어집니다(선택이 없으면 전부)']]) +
    h('the lane', '레인') +
    p('With the page holding the keys (click in it), [[A]] brings a lane up under the notes, and [[A]] again puts it away; so does the {{automation}} key at the foot of the panel. The list under that key says what the lane shows: {{velocity}}, {{pitch bend}}, {{modulation}}, {{sustain pedal}}, {{expression}}, {{volume}}, {{pan}}, {{breath}}, {{brightness}}, {{pressure}}, and under {{another controller}} every one of the 128 by its number.', '페이지가 키를 가진 상태에서(안을 한 번 클릭) [[A]]를 누르면 노트 아래로 레인이 올라오고, 다시 누르면 내려갑니다. 패널 아래쪽의 {{automation}} 키도 같습니다. 그 아래 목록이 레인에 보일 것을 정합니다. {{velocity}}, {{pitch bend}}, {{modulation}}, {{sustain pedal}}, {{expression}}, {{volume}}, {{pan}}, {{breath}}, {{brightness}}, {{pressure}}, 그리고 {{another controller}} 아래에 128개 컨트롤러 전부가 번호로 있습니다.') +
    table(null,
      [['a point', '점 찍기'], ['click in the lane: a point at that place on the grid, as high as you clicked', '레인을 클릭. 그리드의 그 자리에, 클릭한 높이로']],
      [['move it', '옮기기'], ['drag; [[⇧]] click chooses more, and they move together', '드래그. [[⇧]] 클릭으로 여럿을 고르면 함께 움직입니다']],
      [['nudge it', '넛지'], ['[[⌥←]] [[⌥→]] a step of the grid, [[⌥↑]] [[⌥↓]] its value, with [[⇧]] ten: the chosen points alone', '[[⌥←]] [[⌥→]] 그리드 한 칸, [[⌥↑]] [[⌥↓]] 값 한 단계, [[⇧]]와 함께면 열 단계. 선택한 점만 움직입니다']],
      [['remove it', '지우기'], ['double-click it, or choose it and [[⌫]]', '더블 클릭, 또는 선택하고 [[⌫]]']]) +
    note('Between two points the value goes evenly from one to the other; a pedal or switch (64 to 69) is either down or up. What is turned belongs to the region and moves, copies and stretches with it. The synth answers to the bend, to modulation (vibrato) and to the pedal, the sampler to the bend and the pedal, the kit to none of them; an instrument from outside answers to whatever it was made to.', '두 점 사이에서 값은 고르게 이어집니다. 페달과 스위치(64~69)는 밟았거나 뗐거나 둘 중 하나입니다. 이렇게 그린 값은 리전의 것이라 리전과 함께 옮겨지고 복사되고 늘어납니다. 신스는 벤드, 모듈레이션(비브라토), 페달에 반응하고, 샘플러는 벤드와 페달에, 킷은 어느 것에도 반응하지 않습니다. 외부 악기는 그 악기가 받도록 만들어진 것에 반응합니다.') }),

  page(t('the notes of a kit', '킷의 노트'), { kind: 'split', tw: 96, txt:
    p('On a track that plays the kit, the rows of the notes page are its sixteen pads, each with its drum. A stroke is drawn for as long as that drum rings, so a crash runs on over the bar and a closed hat is a tick.', '킷을 연주하는 트랙에서는 노트 페이지의 줄이 패드 16개이고, 줄마다 그 드럼이 그려져 있습니다. 타점은 그 드럼이 울리는 길이만큼 그려집니다. 크래시는 마디를 넘어 이어지고 닫힌 하이햇은 짧은 점입니다.') +
    table(null,
      [['make a stroke', '타점 만들기'], ['one click on the paper, on the page’s grid', '빈 곳을 한 번 클릭. 페이지의 그리드에 맞춰']],
      [['remove it', '지우기'], ['double-click it, or choose it and [[⌫]]', '더블 클릭, 또는 선택하고 [[⌫]]']],
      [['another pad, another place', '다른 패드, 다른 자리'], ['drag it up, down or along', '위아래나 옆으로 드래그']],
      [['hear a pad', '패드 듣기'], ['press its row at the left', '왼쪽의 줄을 누르기']]),
    art: fig('roll-kit', { w: 160 }) }),

  page(t('recording notes, regions of notes, files', '노트 녹음, 노트 리전, 파일'), { kind: 'text', cc: 3, txt:
    h('a take of notes', '노트 테이크') +
    p('[[R]] records on every armed track; a track of notes needs no input. What was played becomes a region of notes, from where the take began to the bar line after it ended. The notes appear when the take ends.', '[[R]]은 대기 중인 모든 트랙에 녹음합니다. 노트 트랙은 입력이 필요 없습니다. 연주한 것은 테이크 시작부터 끝난 뒤의 마디 선까지 노트 리전이 됩니다. 노트는 테이크가 끝나면 나타납니다.') +
    p('Playing over a part adds to it: when a region of notes lies under the take, the new notes are added to that region. There is no replace recording.', '이미 있는 파트 위에 연주하면 더해집니다. 테이크 밑에 노트 리전이 있으면 새 노트가 그 리전에 더해집니다. 덮어쓰는 녹음은 없습니다.') +
    h('capture', '캡처') +
    p('[[⇧R]] lays what was just played on the chosen track of notes, though nothing was recording. Played while the song ran, the notes lie where they were played; played with the song standing still, the last phrase begins at the bar the playhead is in. The foot says how many: “12 notes kept”.', '[[⇧R]]은 녹음하지 않았더라도 방금 연주한 것을 선택한 노트 트랙에 놓습니다. 재생 중에 연주했다면 연주한 자리에, 멈춘 상태에서 연주했다면 마지막 프레이즈가 플레이헤드가 있는 마디에서 시작합니다. 아래에 개수가 나옵니다. “12 notes kept”.') +
    h('what a region does to its notes', '리전이 노트에 하는 일') +
    p('The notes stay as they were played; these are kept by the region and can be taken off again.', '노트 자체는 연주한 그대로 남습니다. 아래 값은 리전이 지니며 다시 뗄 수 있습니다.') +
    table(null,
      [['quantize', '퀀타이즈'], ['[[Q]] pulls where notes begin to the quantize value; their lengths stay. A strength and a swing are set on the notes page or said on the command line (`quantize this 1/16 at 60% strength with 20% swing`). [[⌥⌘Q]] lets go', '강도와 스윙은 노트 페이지에서 정하거나 커맨드 라인으로 말합니다(`quantize this 1/16 at 60% strength with 20% swing`). [[Q]]는 노트의 시작을 퀀타이즈 값에 맞춥니다. 길이는 그대로. [[⌥⌘Q]]로 풉니다']],
      [['transpose', '트랜스포즈'], ['[[⌥↑]] [[⌥↓]], −24 to +24. On a kit this moves notes to other pads', '[[⌥↑]] [[⌥↓]], −24~+24. 킷에서는 노트가 다른 패드로 옮겨집니다']],
      [['gain', '게인'], ['[[⌃⇧↑]] [[⌃⇧↓]]: how hard the notes are played, four steps of velocity a dB', '[[⌃⇧↑]] [[⌃⇧↓]]: 노트의 세기. dB당 벨로시티 4단계']],
      [['mute', '뮤트'], ['[[N]]', '[[N]]']]) +
    p('Regions of notes are moved, trimmed, split, copied, repeated and deleted like any region. A note sounds when it begins inside the region and is cut off where the region ends. Fades, crossfades, fine tune, rubato, reverse and strip silence do not apply to them.', '노트 리전은 다른 리전처럼 옮기고, 트림하고, 자르고, 복사하고, 반복하고, 지웁니다. 노트는 리전 안에서 시작할 때 소리가 나고 리전이 끝나는 곳에서 끊깁니다. 페이드, 크로스페이드, 미세 조정, 루바토, 리버스, 무음 제거는 적용되지 않습니다.') +
    note('Notes come into a song by being played, from a file, made on the notes page ([[P]]), or typed as chords on the command line (`Dm7(9) G7(b9,13)`: see “chords from the line”). A wrong note is put right on the notes page.', '노트는 연주하거나, 파일에서 가져오거나, 노트 페이지([[P]])에서 만들거나, 커맨드 라인에 코드로 입력해서(`Dm7(9) G7(b9,13)`, “줄로 코드 넣기” 참고) 곡에 들어옵니다. 틀린 노트는 노트 페이지에서 고칩니다.') +
    h('pedal, bend, wheel', '페달, 벤드, 휠') +
    p('Controllers, pitch bend and channel pressure are recorded with the notes, kept in the region and played back. The lane under the notes page shows them and edits them: see “the panel at the left, and the lane”.', '컨트롤러, 피치 벤드, 채널 프레셔는 노트와 함께 녹음되어 리전에 담기고 재생됩니다. 노트 페이지 아래의 레인에서 보고 고칠 수 있습니다. “왼쪽 패널과 레인” 참고.') +
    h('files of notes', '노트 파일') +
    table(null,
      [['in', '들여오기'], ['drag a .mid file from the Finder onto the window. Each of its tracks becomes a new track of notes: the kit for a drum track, e piano otherwise. A song that holds nothing yet takes the file’s tempo and measure', 'Finder에서 .mid 파일을 창으로 드래그합니다. 파일의 트랙마다 새 노트 트랙이 됩니다. 드럼 트랙은 킷, 나머지는 e piano. 아직 비어 있는 곡은 파일의 템포와 박자를 따릅니다']],
      [['out', '내보내기'], ['a .mid is written as part of hand off, with the notes as they sound', '.mid는 내보내기의 일부로, 들리는 그대로의 노트로 기록됩니다']]) +
    p('Middle c, key 60, is written {{c3}}. Names are lowercase with sharps only.', '가운데 도(60번 건반)는 {{c3}}로 적습니다. 음 이름은 소문자이고 샵만 씁니다.') +
    h('bounce in place', '제자리 바운스') +
    p('[[⌃B]] prints the chosen regions of notes through the instrument, the patch and the plug-ins as sound on a new track.', '[[⌃B]]는 선택한 노트 리전을 악기, 패치, 플러그인을 거친 소리로 새 트랙에 찍습니다.') }),
])
