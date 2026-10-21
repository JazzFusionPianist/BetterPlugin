import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('patch', t('the patch', '패치'),
  t('Every track has a patch: a wall on which effects stand and are wired together, the way they are in Patch on Slur. Patch on Slur’s prints and plug-ins from outside stand on the same wall.', '트랙마다 패치가 있습니다. 이펙트를 올려놓고 선으로 잇는 벽이고, Patch on Slur와 같은 방식입니다. Patch on Slur의 프린트와 외부 플러그인이 같은 벽에 섭니다.'), [

  page(t('the wall', '벽'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, '{{in}} where the sound enters. On a track of notes the instrument stands here', '{{in}} 소리가 들어오는 곳. 노트 트랙에서는 악기가 여기 섭니다'],
      [2, 'a print, one of Patch on Slur’s own effects. Click it for its study; drag it to move it', '프린트. Patch on Slur의 자체 이펙트입니다. 클릭하면 판화가 열리고, 드래그하면 옮겨집니다'],
      [3, 'two ways side by side: one output wired to two things', '나란한 두 갈래: 출력 하나를 두 곳에 이었습니다'],
      [4, '{{mix}} takes any number of wires. The number on a wire is its level. {{blends}}: a hundred in all. {{adds}}: each set freely', '{{mix}}는 선을 몇 개든 받습니다. 선 위의 숫자가 그 선의 레벨. {{blends}}: 합쳐서 100. {{adds}}: 각각 자유롭게'],
      [5, 'a plug-in from outside. Click it for its window', '외부 플러그인. 클릭하면 창이 열립니다'],
      [6, '{{out}}', '{{out}}'],
      [7, '{{add}} opens the list of prints and plug-ins', '{{add}} 프린트와 플러그인 목록을 엽니다'],
      [8, 'the macros’ column: {{+}} makes one (see “macros”)', '매크로 열: {{+}}로 하나 만듭니다(“매크로” 참고)'],
      [9, 'the patch that is up, kept under a name (see “presets”)', '지금 올라온 패치. 이름을 붙여 저장합니다(“프리셋” 참고)']) +
    p('The chosen track’s strip is in the transport panel at the left; with the panel hidden, or in a theme with a transport of its own, it stands at the patch’s right with the stereo out’s.', '선택한 트랙의 스트립은 왼쪽 트랜스포트 패널에 있습니다. 패널을 숨기거나 자체 트랜스포트가 있는 테마에서는 패치 오른쪽에 스테레오 아웃 스트립과 함께 나옵니다.') +
    p('A patch begins with {{in}} at the left of the wall, {{out}} at its right and one wire between them: the sound goes by untouched. Double-click something in the list and it is set on that wire, at its end, and wired in; the next one goes to its right. A print that plays other prints’ hands stands by itself, to be wired by hand. Sixteen things fit on a wall.', '패치는 벽 왼쪽의 {{in}}, 오른쪽의 {{out}}, 그리고 그 둘을 잇는 선 하나로 시작합니다. 소리는 그대로 지나갑니다. 목록에서 더블 클릭한 것은 그 선의 끝에 올라가 연결되고, 다음 것은 그 오른쪽에 붙습니다. 다른 프린트의 손잡이를 움직이는 프린트는 따로 놓이고 직접 연결합니다. 벽 하나에 열여섯 개까지 놓입니다.'),
    art: fig('patch', { w: 178, calls: [[1, 'wall:port#1', 'b'], [2, 'wall:node#1', 't'], [3, 'wall:node#2', 't'], [4, 'wall:node#4', 't'], [5, 'wall:node#5', 't'], [6, 'wall:end', 'b'], [7, 'plugs', 'b'], [8, 'macro:add', 't'], [9, 'pre:box', 't']] }) }),

  page(t('working on the wall', '벽에서 하는 일'), { kind: 'text', cc: 2, txt:
    table(null,
      [['drag from the dot at a thing’s right to another thing', '오른쪽 점에서 다른 것으로 드래그'], ['a wire. One output can feed several things; a wire that would make a ring is not drawn', '선이 생깁니다. 출력 하나를 여러 곳에 이을 수 있고, 고리가 되는 선은 그려지지 않습니다']],
      [['click a wire, then [[⌫]]', '선을 클릭하고 [[⌫]]'], ['the wire is taken away', '선이 사라집니다']],
      [['click a thing, then [[⌫]]', '하나를 클릭하고 [[⌫]]'], ['it is taken off the wall; the wire closes over its place', '벽에서 빠집니다. 그 자리는 선이 이어집니다']],
      [['click a print', '프린트 클릭'], ['its study opens at the right of the wall: the print drawn big and every hand of it', '벽 오른쪽에 판화가 열립니다. 크게 그린 프린트와 모든 조절값']],
      [['drag the words under a thing', '아래 글자를 드래그'], ['moves it. Set down on a wire, a thing with no wires joins that wire', '옮깁니다. 선이 없는 것을 선 위에 놓으면 그 선에 끼어듭니다']],
      [['drag the number on a wire', '선 위의 숫자 드래그'], ['its level into the mix', 'mix로 들어가는 레벨']],
      [['scroll', '스크롤'], ['nearer and further, about the pointer. [[⌥]] drag the empty wall to move it; double-click it to see all', '포인터 중심으로 확대, 축소. 빈 벽을 [[⌥]] 드래그하면 이동, 더블 클릭하면 전체 보기']],
      [['drag over the empty wall', '빈 벽을 드래그'], ['chooses what it passes over; [[⇧]] click adds a thing or takes it away. What is chosen moves together, and [[⌫]] takes it all off', '지나간 것들을 선택합니다. [[⇧]] 클릭으로 하나씩 더하거나 뺍니다. 선택한 것은 함께 움직이고 [[⌫]]로 한꺼번에 지웁니다']],
      [['right-click the empty wall, or what is chosen', '빈 벽이나 선택한 것을 오른쪽 클릭'], ['{{organize}}: everything is seen moving into order from in to out: what follows one thing stands on its line, what runs side by side stands one over the other. {{bypass all}}: what is chosen, or the whole wall, is bypassed; again, back on', '{{organize}}: 모든 것이 움직이며 in에서 out까지 정렬됩니다. 이어지는 것은 한 줄에, 나란한 갈래는 위아래로 섭니다. {{bypass all}}: 선택한 것(없으면 벽 전체)을 바이패스, 다시 누르면 다시 켭니다']],
      [['[[⌘]] click a thing', '[[⌘]] 클릭'], ['bypassed, or back on', '바이패스, 다시 누르면 켜짐']],
      [['[[⌃]] click a thing', '[[⌃]] 클릭'], ['taken off its wires; the way closes over its place and it stays where it stood', '선에서 빠집니다. 그 자리는 선이 이어지고 그것은 그 자리에 남습니다']],
      [['drag a thing', '드래그'], ['moves it, a print as a plug-in; it is chosen, its hands along the foot of the wall', '옮깁니다. 프린트도 플러그인도. 선택되고, 조절값이 벽 아래에 나옵니다']]) +
    p('The stereo out has a wall of its own: click its row under the last track (or {{out}} in the mixer). What stands there is heard on the whole song, before the stereo out’s fader, and goes into a print of the mix; a print of single tracks does not pass it.', '스테레오 아웃에도 벽이 있습니다. 마지막 트랙 아래의 스테레오 아웃 줄(또는 믹서의 {{out}})을 클릭합니다. 거기 놓인 것은 곡 전체에, 스테레오 아웃 페이더 앞에서 걸리고 믹스 프린트에 들어갑니다. 트랙별 프린트는 지나지 않습니다.') +
    note('Ways side by side are lined up: when a plug-in on one way is late, the others are held back by as much. Changes to the wiring are not steps of undo.', '나란한 갈래는 시간이 맞춰집니다. 한 갈래의 플러그인이 늦으면 다른 갈래를 그만큼 늦춥니다. 배선을 바꾸는 것은 실행 취소 단계가 아닙니다.') +
    note('With low latency on (in the transport panel), a print or plug-in later than the limit, on a track heard live, is drawn dim on the wall and reads {{skipped}} with how late it is. A print of the song keeps everything.', '저지연(트랜스포트 패널)이 켜져 있으면, 지금 들리는 트랙에서 기준보다 늦은 프린트와 플러그인은 벽에 흐리게 그려지고 {{skipped}}와 늦는 시간이 붙습니다. 곡을 프린트할 때는 모두 들어갑니다.') }),

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

  page(t('the side', '사이드'), { kind: 'text', cc: 2, txt:
    p('{{side}} is Patch on Slur’s sidechain on the wall: a print with no way in and one way out, playing another track’s sound. Click it to pick the track. Wire it into a print’s {{key}}, the point below its way in, and the print listens to that track in place of its own sound: a comp on the bass that ducks to the kick.', '{{side}}는 Patch on Slur의 사이드체인입니다. 입력 없이 출력만 있는 프린트로, 다른 트랙의 소리를 내보냅니다. 클릭해서 트랙을 고릅니다. 프린트의 {{key}}(입력 점 아래의 점)에 연결하면 그 프린트는 자기 소리 대신 그 트랙을 듣습니다. 킥에 덕킹되는 베이스 컴프가 그 예입니다.') +
    table(null,
      [['the prints with a key', '키가 있는 프린트'], ['glue, gate, comp, repeat, carve, match, vocode', 'glue, gate, comp, repeat, carve, match, vocode']],
      [['drag from the side’s dot to a key point', '사이드의 점에서 키 점으로 드래그'], ['a key wire; the point lights while the wire is over it', '키 연결선. 선이 위에 오면 점에 불이 들어옵니다']],
      [['wire the side into the way of the sound', '사이드를 소리 경로에 연결'], ['the other track is heard there, like anything else on the wall', '그 자리에서 다른 트랙 소리가 납니다']]) +
    note('Every side on one wall plays the same track; it is kept with the project and lined up in time with this track’s own sound. A track that is fed by this one cannot be picked. A preset keeps the side and its key wires, and Patch on Slur opens them as its own side.', '한 패치의 사이드는 모두 같은 트랙을 냅니다. 프로젝트에 저장되고, 이 트랙의 소리와 시간이 맞춰집니다. 이 트랙을 거쳐 가는 트랙은 고를 수 없습니다. 프리셋에도 사이드와 키 연결이 저장되고, Patch on Slur에서 열면 그쪽의 사이드가 됩니다.') }),

  page(t('macros', '매크로'), { kind: 'text', cc: 2, txt:
    p('A plug-in from outside keeps its knobs to itself. A macro is a knob of the track’s own that turns one of them: made in the column at the left of the wall, wired to the plug-in, and from then on named after the knob it turns. In the automation view the track’s lines list the macros by those names.', '외부 플러그인의 노브는 그 플러그인 안에만 있습니다. 매크로는 그 노브 하나를 대신 돌리는 트랙의 노브입니다. 패치 왼쪽 열에서 만들고 플러그인에 연결하면, 그때부터 돌리는 노브의 이름을 따릅니다. 오토메이션 보기에서는 트랙의 라인 목록에 매크로가 그 이름으로 나옵니다.') +
    table(null,
      [['{{+}} in the column’s head', '열 머리의 {{+}}'], ['a new macro, not wired yet', '새 매크로. 아직 연결 안 됨']],
      [['drag from the dot at its right to a plug-in on the wall', '오른쪽 점에서 패치 위 플러그인으로 드래그'], ['the plug-in’s controls, each with what it reads now. Type to find one by name; click it, or [[↑]] [[↓]] and [[⏎]]', '그 플러그인의 노브가 현재 값과 함께 나옵니다. 이름을 쳐서 찾고, 클릭하거나 [[↑]] [[↓]] 뒤 [[⏎]]']],
      [['…or to a print', '…또는 프린트로'], ['the print’s own hands: its big one and those of its study, in its units. The macro carries the one picked across its range', '프린트의 손잡이: 큰 손잡이와 스터디의 손잡이가 단위와 함께 나옵니다. 매크로는 고른 손잡이를 그 범위 끝에서 끝까지 움직입니다']],
      [['drag the macro up or down', '매크로를 위아래로 드래그'], ['the plug-in’s knob moves with it; [[⇧]] is finer. With a line drawn, the whole line moves', '플러그인 노브가 같이 움직입니다. [[⇧]]는 미세하게. 라인이 있으면 라인 전체가 움직입니다']],
      [['double-click its name', '이름 더블 클릭'], ['name it by hand', '직접 이름 붙이기']],
      [['click it, then [[⌫]]', '클릭하고 [[⌫]]'], ['the macro goes, with its line', '매크로와 그 라인이 사라집니다']]) +
    note('A macro turns one knob of one plug-in or one hand of one print; wired again, it forgets the first. A plug-in taken off the wall leaves its macro not wired, its line kept. Macros are kept with the project and with a preset. The stereo out has none.', '매크로 하나는 플러그인 하나의 노브 하나, 또는 프린트 하나의 손잡이 하나를 돌립니다. 다시 연결하면 이전 연결은 풀립니다. 플러그인을 패치에서 지우면 매크로는 연결 안 됨으로 남고 라인은 그대로입니다. 매크로는 프로젝트와 프리셋에 함께 저장됩니다. 스테레오 아웃에는 매크로가 없습니다.') }),

  page(t('the meter', '미터'), { kind: 'text', cc: 2, txt:
    p('{{meter}} is in the wall’s list like a print. It changes nothing: the sound passes through it as it came, with no lateness, and it shows the sound at the place it is wired. After a print it shows what that print made; on the stereo out’s wall it is the meter of the whole song. Click it for its face, a window of its own that stays over the room.', '{{meter}}는 프린트처럼 목록에서 골라 패치에 올립니다. 소리는 그대로, 지연 없이 통과하고, 배선한 그 지점의 소리를 보여 줍니다. 프린트 뒤에 두면 그 프린트를 거친 소리가, 스테레오 아웃 패치에 두면 곡 전체가 보입니다. 클릭하면 자기 창이 열리고, 창은 화면 위에 떠 있습니다.') +
    table(null,
      [['the wave as it came', '파형'], ['the last 5, 10 or 30 seconds ({{window}}); the line over it is the short-term loudness; a red tick where it ran over', '최근 5, 10, 30초({{window}}). 위의 선은 short term 라우드니스, 빨간 눈금은 오버가 난 자리']],
      [['how loud', '라우드니스'], ['integrated, short term (3 s), momentary (0.4 s), range and true peak, measured as EBU R128 does. {{aim}} sets the loudness wanted: the dashed line, and how far the song is from it', 'integrated, short term(3초), momentary(0.4초), range, true peak. EBU R128 방식으로 잽니다. {{aim}}은 목표 라우드니스로, 점선과 목표 대비 값이 여기서 나옵니다']],
      [['each side', '좌우'], ['rms, the peak now and the highest held, the crest, and how often it ran over', 'rms, 지금 피크와 홀드된 최고 피크, 크레스트, 오버 횟수']],
      [['the stereo picture', '스테레오'], ['{{lissajous}}, {{polar sample}} or {{polar level}}; beside it correlation, balance and width, and whether it ever went under 0', '{{lissajous}}, {{polar sample}}, {{polar level}} 중 선택. 옆에 상관도, 밸런스, 폭, 그리고 0 아래로 내려간 적이 있는지']],
      [['{{hold}}, {{reset}}', '{{hold}}, {{reset}}'], ['hold keeps the highest peaks marked (off: the highest of the last two seconds). Reset begins the count again: integrated, range, the held peaks', 'hold는 최고 피크를 계속 표시합니다(끄면 최근 2초의 최고값). reset은 integrated, range, 홀드 피크를 처음부터 다시 잽니다']]) +
    note('The count also begins again when the song is played from another place than it was left at. A print is not counted. Drag the window’s corner: made narrow, the face keeps the loudness, the two sides and the picture. A meter is not a thing Patch on Slur has, so a preset opened there goes on without it.', '곡을 멈춘 자리가 아닌 다른 곳에서 재생하면 측정도 처음부터 다시 시작합니다. 바운스는 측정에 들어가지 않습니다. 창 모서리를 끌어 좁히면 라우드니스, 좌우 레벨, 스테레오 그림만 남습니다. 미터는 Patch on Slur에는 없는 것이라, 거기서 연 프리셋과 내보내기의 패치 파일에서는 빠집니다.') }),

  page(t('the prints', '프린트'), { kind: 'text', cc: 2, txt:
    p('The prints are Patch on Slur’s effects, with the same sound and the same pictures. In the list they stand among the plug-ins of their kind, and all together under {{slur}}.', '프린트는 Patch on Slur의 이펙트입니다. 소리도 그림도 같습니다. 목록에서는 같은 종류의 플러그인 사이에 있고, {{slur}} 아래에 전부 모여 있습니다.') +
    table(null,
      [['tone', 'tone'], ['{{cut}} {{amp}} {{tone}} {{tape}} {{glue}} {{comp}} {{air}}', '{{cut}} {{amp}} {{tone}} {{tape}} {{glue}} {{comp}} {{air}}']],
      [['grit', 'grit'], ['{{crush}} {{radio}} {{ring}} {{fold}}', '{{crush}} {{radio}} {{ring}} {{fold}}']],
      [['space', 'space'], ['{{delay}} {{space}} {{shimmer}} {{doubler}} {{stereo}}', '{{delay}} {{space}} {{shimmer}} {{doubler}} {{stereo}}']],
      [['motion', 'motion'], ['{{mod}} {{tremolo}} {{swell}} {{stutter}} {{gate}} {{wow}} {{repeat}}', '{{mod}} {{tremolo}} {{swell}} {{stutter}} {{gate}} {{wow}} {{repeat}}']],
      [['pitch', 'pitch'], ['{{pitch}} {{formant}} {{harmony}} {{arp}} {{grain}} {{tune}}', '{{pitch}} {{formant}} {{harmony}} {{arp}} {{grain}} {{tune}}']],
      [['utility', 'utility'], ['{{gain}} {{mix}} {{l/r}} {{m/s}} {{pan}} {{bands}} {{side}}', '{{gain}} {{mix}} {{l/r}} {{m/s}} {{pan}} {{bands}} {{side}}']],
      [['control', 'control'], ['{{lfo}} {{macro}} {{follow}} {{env}} {{drift}} {{pulse}} {{scene}}', '{{lfo}} {{macro}} {{follow}} {{env}} {{drift}} {{pulse}} {{scene}}']],
      [['spectral', 'spectral'], ['{{carve}} {{match}} {{vocode}} {{freeze}} {{shift}} {{smear}} {{sieve}}', '{{carve}} {{match}} {{vocode}} {{freeze}} {{shift}} {{smear}} {{sieve}}']]) +
    p('A print’s study is drawn in its own colour, as in Patch on Slur, and lit as the track plays. Drag the big print, or the number under it, up or down for its amount ([[⇧]] finer, [[⌥]] click back to where it rests); click the number to type it. Each other hand is a row: drag a number or click it to type, click a cell to choose. {{wet only}} and {{bypass}} are switches on the last row, where the print has them; {{remove}} is at the foot and asks {{sure?}} first. Scrolling over the big print turns it too. The close mark, [[esc]] or a click on the empty wall puts it away. {{l/r}} and {{m/s}} have two outputs, one for each half.', '판화는 Patch on Slur처럼 프린트의 색으로 그려지고, 트랙이 재생되면 빛납니다. 큰 프린트나 그 아래 숫자를 위아래로 드래그하면 양이 바뀝니다([[⇧]]는 미세하게, [[⌥]] 클릭은 기본값으로). 숫자를 클릭하면 직접 입력합니다. 나머지 조절값은 한 줄씩: 숫자는 드래그하거나 클릭해서 입력하고, 칸은 클릭해서 고릅니다. {{wet only}}와 {{bypass}}는 마지막 줄의 스위치입니다(그 프린트에 있을 때만). {{remove}}는 맨 아래에 있고 먼저 {{sure?}}를 묻습니다. 큰 프린트 위에서 스크롤해도 양이 바뀝니다. 닫기 표시, [[esc]], 빈 벽 클릭으로 닫힙니다. {{l/r}}과 {{m/s}}는 출력이 둘입니다.') +
    note('One each of tape, space and delay stands on a wall: these three have lines of their own, and their amount can be said on the command line. Another print’s hand gets a line through a macro, and any print can be put on, taken off or switched off by words. {{tune}} draws a voice to the nearest note of its key: its big hand is {{retune}}, from {{off}} to {{hard}}; its study has the key, the scale, humanize, flex, vibrato, the engine and the formant. The prints, their hands and their units come from Patch on Slur itself: when the plug-in changes, the next Slur Studio changes with it.', 'tape, space, delay는 벽마다 하나씩입니다. 이 셋은 자체 라인이 있고, 커맨드 라인으로 양을 말할 수 있습니다. 다른 프린트의 손잡이는 매크로를 거쳐 라인을 가지며, 어떤 프린트든 커맨드 라인으로 올리고, 빼고, 끌 수 있습니다. {{tune}}은 목소리를 키의 가장 가까운 음으로 당깁니다. 큰 손잡이는 {{retune}}로 {{off}}부터 {{hard}}까지, 스터디에는 key, scale, humanize, flex, vibrato, engine, formant가 있습니다. 프린트와 그 손잡이, 단위는 Patch on Slur에서 그대로 옵니다. 플러그인이 바뀌면 다음 Slur Studio도 같이 바뀝니다.') }),

  page(t('prints that play hands', '손잡이를 움직이는 프린트'), { kind: 'text', cc: 2, txt:
    p('{{lfo}}, {{drift}}, {{pulse}}, {{macro}}, {{follow}}, {{env}} and {{scene}} make no sound: they move other prints’ hands. In the list they stand under {{modulation}}. A wire drawn from one is a control wire, drawn dashed.', '{{lfo}}, {{drift}}, {{pulse}}, {{macro}}, {{follow}}, {{env}}, {{scene}}는 소리를 내지 않고 다른 프린트의 손잡이를 움직입니다. 목록에서는 {{modulation}} 아래에 있습니다. 여기서 뽑은 선은 컨트롤 선이며 점선으로 그려집니다.') +
    table(null,
      [['to wire one', '잇기'], ['drag from its port and hold the wire over a print: the print shows the hands it can be played on. Let go on one', '포트에서 끌어 프린트 위에 대면 움직일 수 있는 손잡이 이름이 보입니다. 그 위에서 놓습니다']],
      [['depth, way', '깊이, 방향'], ['click the wire: drag {{depth}} at the foot; {{way}} is {{as it goes}}, {{one way}} or {{both ways}}', '선을 클릭: 아래 줄의 {{depth}}를 끌고, {{way}}는 {{as it goes}}, {{one way}}, {{both ways}} 중에서 고릅니다']],
      [['a macro on a play', '재생 위의 매크로'], ['let go on a hand an lfo already plays: the macro sets how deep the lfo plays it', 'lfo가 이미 움직이는 손잡이에 놓으면 매크로가 그 lfo의 깊이를 잡습니다']],
      [['what plays it', '누가 움직이나'], ['a print’s study has a row for each wire on its hands: who, which hand, how deep, which way', '프린트의 스터디에는 손잡이에 꽂힌 선마다 한 줄: 누가, 어느 손잡이, 얼마나, 어느 방향']]) +
    h('their studies', '스터디') +
    table(null,
      [['lfo', 'lfo'], ['the shape is drawn: click the grid for a point, drag a point or the hollow middle of a stretch, click a point twice to take it away. The ends move together while they meet; [[⌥]] moves one alone', '모양을 그립니다. 격자를 클릭하면 점, 점이나 구간 가운데의 빈 점을 끌어 고치고, 점을 두 번 클릭하면 지웁니다. 양 끝은 맞닿아 있는 동안 함께 움직이고, [[⌥]]는 한쪽만']],
      [['scene', 'scene'], ['{{take}} {{a}} or {{b}}: the wall as it is now. The knob slides every hand the two disagree on; an edit made at {{b}} goes into {{b}}', '{{take}} {{a}} 또는 {{b}}: 지금의 벽을 담습니다. 노브가 둘이 다른 손잡이를 모두 미끄러뜨리고, {{b}} 쪽에서 고친 값은 {{b}}에 들어갑니다']],
      [['bands', 'bands'], ['drag a cut; click a band twice to cut it there, a cut twice to take it away. One way out for each band', '경계를 끕니다. 대역을 두 번 클릭하면 나누고, 경계를 두 번 클릭하면 없앱니다. 대역마다 출구가 하나씩']]) }),

  page(t('plug-ins', '플러그인'), { kind: 'split', tw: 116, mid: true, txt:
    p('Audio Units and VST3 plug-ins stand on the wall beside the prints. The list is read once each time the app runs: a plug-in installed while the app is open appears after {{look again}} in settings > plug-ins, or when the app is started again.', 'Audio Unit과 VST3 플러그인은 프린트 옆, 같은 벽에 섭니다. 목록은 앱을 실행할 때마다 한 번 읽습니다. 앱이 열려 있는 동안 설치한 플러그인은 설정 > 플러그인의 {{look again}}을 누르거나 앱을 다시 시작하면 나타납니다.') +
    p('The list opens inside the patch’s panel, at the right of the wall, with the kinds down its left ({{eq}}, {{dynamics}}, {{reverb}} and so on). Click a kind to list only that kind; typing searches all of them. The kind is read from the plug-in’s name, so an unusual name may stand under {{other}}: its kind can be set by hand in settings > plug-ins. A plug-in left out there is not in this list.', '목록은 패치 패널 안, 벽 오른쪽에 열리고 왼쪽에 종류({{eq}}, {{dynamics}}, {{reverb}} 등)가 있습니다. 종류를 클릭하면 그 종류만 나오고, 입력하면 전체에서 찾습니다. 종류는 플러그인 이름으로 판단하므로 이름이 특이하면 {{other}}에 들어갈 수 있습니다. 설정 > 플러그인에서 종류를 직접 정할 수 있고, 거기서 뺀 플러그인은 이 목록에 나오지 않습니다.') +
    table(null,
      [['add', '추가'], ['double-click it in the list (or click it, then [[↩]]). Its window comes up at once and it is wired in at the end of the way', '목록에서 더블 클릭(또는 클릭 후 [[↩]]). 창이 바로 뜨고 길의 끝에 연결됩니다']],
      [['its window', '창'], ['click its frame. [[space]] still plays; [[V]] closes all', '테두리를 클릭. [[space]]는 그대로 재생, [[V]]는 창을 전부 닫습니다']],
      [['off, on', '끄기, 켜기'], ['[[⌘]] or [[⌥]] click the frame, or {{off}} at the foot of the wall. It is drawn dim; the sound goes by untouched', '테두리를 [[⌘]] 또는 [[⌥]] 클릭, 또는 벽 아래의 {{off}}. 흐리게 그려지고 소리는 그대로 지나갑니다']],
      [['remove', '제거'], ['choose it and click {{remove}}; it turns to {{sure?}}; click again. The wire closes over its place', '선택하고 {{remove}}를 클릭하면 {{sure?}}로 바뀝니다. 다시 클릭. 그 자리는 선이 이어집니다']],
      [['what it listens to', '무엇을 듣는가'], ['right-click the frame: {{its own track}}, or another track, heard on the plug-in’s second input. A compressor on the bass that ducks to the kick listens to the kick', '테두리를 오른쪽 클릭: {{its own track}}, 또는 다른 트랙. 플러그인의 두 번째 입력으로 들어갑니다. 킥에 맞춰 눌리는 베이스 컴프레서는 킥을 듣습니다']]) +
    p('Their settings are saved with the project. Adding, removing and switching off are not steps of undo.', '설정은 프로젝트에 저장됩니다. 추가, 제거, 끄기는 실행 취소 단계가 아닙니다.'),
    art: draw(138, 78,
      D.txt(0, 4, 'a patch with a print and two plug-ins in a row', '프린트 하나와 플러그인 둘을 한 줄로 이은 패치', 's') +
      D.dot(4, 28, 1.1) + D.txt(4, 35, 'in', 'in', 'xs m') + D.arrow([[5.5, 28], [14, 28]]) +
      D.cell(14, 20, 18, 16, 'tape', 'tape', 'on') + D.arrow([[32, 28], [40, 28]]) +
      D.cell(40, 20, 24, 16, 'compressor', 'compressor') + D.txt(52, 41, 'au', 'au', 'xs m') + D.arrow([[64, 28], [72, 28]]) +
      D.cell(72, 20, 24, 16, 'equaliser', 'equaliser', 'soft') + D.txt(84, 41, 'vst3, off', 'vst3, off', 'xs m') + D.arrow([[96, 28], [130, 28]]) + D.dot(132, 28, 1.1) + D.txt(132, 35, 'out', 'out', 'xs m') +
      // the key input
      D.cell(40, 58, 24, 10, 'kick', 'kick') + D.arrow([[52, 58], [52, 47.5]]) + D.txt(66, 64, 'the track it listens to (its key input)', '듣는 트랙(키 입력)', 'xs') +
      D.txt(0, 76, 'the sound takes the chain from left to right', '소리는 체인을 왼쪽에서 오른쪽으로 지나갑니다', 'xs')) +
      `<div style="width:138mm;margin-top:6mm">` + h('left out', 'left out') +
    p('A plug-in is drawn dim with {{left out}} when the project was opened and it would not open, or when the app has learnt not to open it by itself after a bad end. It keeps its place and its settings.', '프로젝트를 열 때 플러그인이 열리지 않았거나, 비정상 종료 뒤 앱이 그 플러그인을 스스로 열지 않기로 했을 때 {{left out}}과 함께 흐리게 그려집니다. 자리와 설정은 그대로입니다.') +
    table(null,
      [['click it', '클릭'], ['it is opened again in its place', '제자리에서 다시 엽니다']],
      [['[[⌥]] click it', '[[⌥]] 클릭'], ['every left-out plug-in of the song comes back, except those the app does not trust', '곡의 모든 left out 플러그인이 돌아옵니다. 앱이 믿지 않는 것은 제외']]) + `</div>` }),
])
