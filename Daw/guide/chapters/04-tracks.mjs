import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

// the seven outlines a region can have, drawn as the app draws them
const SHAPES = [
  ['drums', '드럼', 'M0 0H14V8H0Z'],
  ['bass', '베이스', 'M0 0H14V5.6Q14 8 11.6 8H2.4Q0 8 0 5.6Z'],
  ['voice', '보컬', 'M2.4 0H11.6Q14 0 14 2.4V8H0V2.4Q0 0 2.4 0Z'],
  ['keys', '건반', 'M2.6 0H14V8H0V2H2.6Z'],
  ['guitar', '기타', 'M0 0H11.4L14 2.6V8H0Z'],
  ['effects', '효과', 'M1.8 0H12.2Q12.2 1.8 14 1.8V6.2Q12.2 6.2 12.2 8H1.8Q1.8 6.2 0 6.2V1.8Q1.8 1.8 1.8 0Z'],
  ['notes', '노트', 'M1.8 0H12.2L14 1.8V6.2L12.2 8H1.8L0 6.2V1.8Z'],
]

export default () => chapter('tracks', t('tracks', '트랙'),
  t('Four kinds of track, how to make them, what stands on a track’s head, and how tracks are chosen, coloured, stacked and grouped.', '트랙의 네 종류, 만드는 법, 트랙 헤드에 있는 것, 그리고 트랙을 선택하고 색을 정하고 스택과 그룹으로 묶는 법.'), [

  page(t('making tracks', '트랙 만들기'), { kind: 'split', tw: 112, txt:
    table([['kind', '종류'], ['what it is', '무엇인가']],
      [['audio', '오디오'], ['holds regions of sound. It can record from an input', '소리 리전을 담습니다. 입력에서 녹음할 수 있습니다']],
      [['midi, a track of notes', 'midi, 노트 트랙'], ['holds regions of notes and an instrument that plays them. In every other way it is a track that sounds: patch, sends, fader', '노트 리전과 그것을 연주하는 악기를 담습니다. 그 밖에는 소리 나는 트랙과 같습니다. 패치, 센드, 페이더']],
      [['bus', '버스'], ['holds no regions. Tracks play or send into it. Made at the bottom. Its row wears its colour', '리전이 없습니다. 다른 트랙이 이리로 나가거나 센드를 보냅니다. 목록 맨 아래에 생깁니다. 행 전체가 자기 색으로 옅게 칠해집니다']],
      [['stack', '스택'], ['a bus that sits above its own tracks; they play into it', '자기 트랙들 위에 놓이는 버스. 그 트랙들이 이리로 나갑니다']]) +
    h('the new-track list', '새 트랙 목록') +
    p('Open it with the + at the left of the tracks’ bar, [[⌥⌘N]], or ((Track > New Tracks…)).', '트랙 바 왼쪽의 +, [[⌥⌘N]], 또는 ((Track > New Tracks…))로 엽니다.') +
    legend(
      [1, '{{kind}} audio, midi or bus. [[←]] [[→]] change it', '{{kind}} audio, midi, bus. [[←]] [[→]]로 바꿉니다'],
      [2, '{{input}} for audio: an input, or a pair for a stereo take. For midi this row reads {{instrument}} and opens the list of instruments', '오디오일 때 {{input}}: 입력 하나, 또는 스테레오 테이크를 위한 한 쌍. midi일 때는 이 줄이 {{instrument}}가 되어 악기 목록을 엽니다'],
      [3, '{{plays to}} the stereo out, or any bus or stack', '{{plays to}} 스테레오 아웃, 또는 아무 버스나 스택'],
      [4, '{{how many}} 1 to 16. [[↑]] [[↓]] change it', '{{how many}} 1~16. [[↑]] [[↓]]로 바꿉니다'],
      [5, '{{create}} or [[↩]]', '{{create}} 또는 [[↩]]']) +
    table(null,
      ['[[⌥⌘A]]', ['one audio track, at once', '오디오 트랙 하나 바로 만들기']],
      ['[[⌥⌘S]]', ['one track of notes, at once, playing e piano', 'e piano를 연주하는 노트 트랙 하나 바로 만들기']],
      ['[[⌃N]]', ['one bus, at once', '버스 하나 바로 만들기']],
      ['[[⌘D]]', ['duplicate the chosen track with its patch, level, sends and plug-ins; [[⌥⇧⌘D]] with its regions too', '선택한 트랙을 패치, 레벨, 센드, 플러그인과 함께 복제. [[⌥⇧⌘D]]는 리전까지']]) +
    note('New tracks land under the chosen track. A song holds at most 256 tracks and always at least one.', '새 트랙은 선택한 트랙 아래에 생깁니다. 곡 하나에 트랙은 최대 256개, 최소 하나입니다.'),
    art: fig('newtrack', { w: 96, calls: [[1, 'new-kind#2', 'r'], [2, 'new-in', 'r'], [3, 'new-out', 'r'], [4, 'new-n', 'r'], [5, 'new-make', 'r']] }) }),

  page(t('the track head', '트랙 헤드'), { kind: 'split', tw: 120, flip: true, txt:
    legend(
      [1, 'the triangle of a stack: open, closed', '스택의 삼각형: 열림, 닫힘'],
      [2, 'the letter of an edit group', '편집 그룹의 글자'],
      [3, '{{r}} record, {{i}} hear the input, {{m}} mute, {{s}} solo. A track of notes has no {{i}}; a bus, a stack and someone else’s track have only {{m}} and {{s}}', '{{r}} 녹음, {{i}} 입력 듣기, {{m}} 뮤트, {{s}} 솔로. 노트 트랙에는 {{i}}가 없고, 버스, 스택, 남의 트랙에는 {{m}}과 {{s}}만 있습니다'],
      [4, 'the level, with a thin meter under it. Click or drag; [[⇧]] drag is fine; double-click is 0 dB', '레벨과 그 아래의 가는 미터. 클릭하거나 드래그. [[⇧]] 드래그는 미세하게. 더블 클릭하면 0 dB'],
      [5, 'the level in dB. Double-click to type it', '레벨 dB 값. 더블 클릭하면 입력'],
      [6, 'solo, lit yellow', '솔로, 노란 불'],
      [7, 'armed (red) and heard through (orange)', '녹음 대기(빨강)와 입력 듣기(주황)'],
      [8, 'muted: the row dims', '뮤트: 줄이 흐려집니다'],
      [9, 'a name in italics: the track is someone else’s, shared through Slur', '기울어진 이름: Slur로 공유된 남의 트랙'],
      [10, 'the track has alternatives; this is the one on the lane', '대체 버전이 있는 트랙. 지금 레인에 있는 것의 번호']) +
    table(null,
      [['click a head', '헤드 클릭'], ['choose the track, and its regions with it', '트랙을 선택하고 그 리전도 함께 선택']],
      [['[[⇧]] click, [[⌘]] click', '[[⇧]] 클릭, [[⌘]] 클릭'], ['a range of tracks; one more or one less', '트랙 범위. 하나 더 또는 하나 빼기']],
      ['[[↑]] [[↓]]', ['the track above, below; with [[⇧]] the rows passed are chosen too', '위, 아래 트랙. [[⇧]]와 함께면 지나간 줄도 선택']],
      [['drag up or down', '위아래 드래그'], ['reorder. Several chosen move together; let go in front of a track of a stack and it joins that stack', '순서 바꾸기. 여럿을 선택했으면 함께 움직입니다. 스택 안 트랙 앞에 놓으면 그 스택에 들어갑니다']],
      [['double-click the name', '이름 더블 클릭'], ['rename, also [[⇧↩]]', '이름 바꾸기. [[⇧↩]]도 같습니다']],
      ['[[M]] [[S]]', ['mute, solo every chosen track', '선택한 모든 트랙 뮤트, 솔로']],
      [['[[⌥]] click {{s}}', '{{s}} [[⌥]] 클릭'], ['solo only this one', '이 트랙만 솔로']],
      [['drag across {{m}} or {{s}}', '{{m}}이나 {{s}} 위로 드래그'], ['each row passed is set the same way', '지나가는 줄마다 같은 상태로']]) +
    note('When several tracks are chosen, the fader, the pan, [[⌥]] click, {{m}}, {{s}}, {{r}} and {{i}} of one act on all of them.', '여러 트랙을 선택했을 때 한 트랙의 페이더, 팬, [[⌥]] 클릭, {{m}}, {{s}}, {{r}}, {{i}}는 모두에게 적용됩니다.'),
    art: fig('heads', { w: 104, calls: [[1, [34, 30], 't'], [2, [94, 54], 't'], [3, [185, 53], 't'], [4, [243, 30], 't', -2], [5, [281, 28], 't', 3], [6, [206, 119], 'r'], [7, [162, 169], 'r'], [8, [191, 219], 'r'], [9, [86, 144], 'l'], [10, [72, 244], 'l']] }) }),

  page(t('the track menu and delete', '트랙 메뉴와 삭제'), { kind: 'split', tw: 124, txt:
    p('Right-click a track’s name, on its head or on its strip in the mixer, for the track menu. Every line shows its key.', '헤드나 믹서 스트립에서 트랙 이름을 오른쪽 클릭하면 트랙 메뉴가 열립니다. 줄마다 단축키가 적혀 있습니다.') +
    h('what the delete key takes', 'delete 키가 지우는 것') +
    p('[[⌫]] goes by what you took hold of last.', '[[⌫]]는 마지막으로 잡았던 것을 기준으로 동작합니다.') +
    table(null,
      [['a marker was clicked last', '마지막에 마커를 클릭했다면'], ['that marker goes', '그 마커가 지워집니다']],
      [['regions or a marquee on the lanes', '레인의 리전이나 마키'], ['they go', '그것들이 지워집니다']],
      [['a track’s head', '트랙 헤드'], ['first press: the regions on the chosen tracks. Second press: the tracks themselves', '첫 번째: 선택한 트랙의 리전. 두 번째: 트랙 자체']]) +
    table(null,
      ['[[⌘⌫]]', ['delete the chosen tracks at once', '선택한 트랙 바로 삭제']],
      ['[[⇧⌘⌫]]', ['delete every empty audio track that is not armed', '녹음 대기가 아닌 빈 오디오 트랙 모두 삭제']]) +
    p('Deleting a track can be undone: its plug-ins come back as they were set. Deleting a bus removes every send into it and puts tracks that played into it back on the stereo out.', '트랙 삭제는 실행 취소할 수 있고, 플러그인도 설정 그대로 돌아옵니다. 버스를 지우면 그리로 가던 센드가 모두 없어지고, 그리로 나가던 트랙은 스테레오 아웃으로 돌아갑니다.') +
    h('names', '이름') +
    p('Names are lowercase and at most 40 characters. A track is read by its name: a track called kick or snare is painted as drums, 808 as bass, vox as voice. The words work in Korean too.', '이름은 소문자, 최대 40자입니다. 트랙은 이름으로 읽힙니다. kick이나 snare는 드럼 색으로, 808은 베이스로, vox는 보컬로 칠해집니다. 한글 이름도 읽습니다.'),
    art: fig('trackmenu', { w: 112 }) }),

  page(t('colour and outline', '색과 모양'), { kind: 'split', tw: 106, txt:
    lead('Every track takes a colour and its regions an outline, so a song can be read from far away.', '트랙마다 색이 있고 리전마다 모양이 있어서, 멀리서도 곡을 읽을 수 있습니다.') +
    p('The app reads what a track is from its name first, then from its sound, and paints each family in one pigment from deep to light: drums blue, bass violet, keys green, guitar ochre, voice red, effects pale.', '앱은 먼저 이름으로, 그다음 소리로 트랙이 무엇인지 읽고, 계열마다 한 가지 색을 짙은 쪽에서 밝은 쪽으로 칠합니다. 드럼은 파랑, 베이스는 보라, 건반은 초록, 기타는 황토, 보컬은 빨강, 효과음은 옅은 색.') +
    h('setting it by hand', '직접 정하기') +
    p('The two small keys after the name on the tracks’ bar open the look list. A choice is set on the chosen regions; with tracks taken hold of, on the chosen tracks.', '트랙 바에서 이름 뒤의 작은 키 두 개가 모양 목록을 엽니다. 선택은 선택한 리전에 적용되고, 트랙을 잡고 있었다면 선택한 트랙에 적용됩니다.') +
    legend(
      [1, '{{colour}} the six pigments, deep to light, and a row of greys', '{{colour}} 여섯 가지 색을 짙은 쪽에서 밝은 쪽으로, 그리고 회색 한 줄'],
      [2, '{{as the track}} (or {{as read}} for a track) gives the choice back to the app', '{{as the track}}(트랙이면 {{as read}})는 선택을 앱에 되돌려 줍니다'],
      [3, '{{outline}} seven outlines; the word under them names the one in use', '{{outline}} 일곱 가지 모양. 아래 글자가 지금 쓰는 모양의 이름입니다']) +
    draw(106, 30, SHAPES.map(([en, ko, d], i) => `<g transform="translate(${i * 15.2} 6)"><path d="${d}" class="db on"/></g>` + D.txt(i * 15.2 + 7, 21, en, ko, 's m')).join('') + D.txt(0, 3, 'the seven outlines', '일곱 가지 모양', 'xs')),
    art: fig('look', { w: 142, calls: [[1, [398, 105], 't'], [2, [380, 26], 'l', 0], [3, [386, 200], 'b']] }) }),

  page(t('stacks, edit groups, alternatives', '스택, 편집 그룹, 대체 버전'), { kind: 'text', cc: 3, txt:
    h('stacks', '스택') +
    p('A stack sums its tracks. Choose tracks and press [[⇧⌘D]]: a track called stack appears above them and they now play into it.', '스택은 자기 트랙들을 합칩니다. 트랙을 선택하고 [[⇧⌘D]]를 누르면 그 위에 stack이라는 트랙이 생기고 트랙들이 그리로 나갑니다.') +
    table(null,
      [['open, close', '열기, 닫기'], ['its triangle, or [[⌃⌘→]] [[⌃⌘←]]. Closed, its tracks leave the list and the mixer, and its lane shows an overview', '삼각형, 또는 [[⌃⌘→]] [[⌃⌘←]]. 닫으면 안의 트랙이 목록과 믹서에서 사라지고, 스택의 레인이 요약을 보여 줍니다']],
      [['in, out', '넣기, 빼기'], ['drag a track in front of one that is in the stack, or pick the stack in the track’s {{out}} list', '스택 안 트랙 앞으로 드래그하거나, 트랙의 {{out}} 목록에서 스택을 고릅니다']],
      [['take apart', '풀기'], ['[[⇧⌘U]]. The stack goes; its tracks stay and play to where the stack played', '[[⇧⌘U]]. 스택은 없어지고 트랙은 남아, 스택이 나가던 곳으로 나갑니다']]) +
    p('The stack’s fader, pan, patch and sends work on the sum. Its {{m}} silences everything in it; its {{s}} solos everything in it. A stack can stand inside a stack, four deep: choose tracks or stacks and press [[⇧⌘D]], or drag a stack into another.', '스택의 페이더, 팬, 패치, 센드는 합쳐진 소리에 작용합니다. {{m}}은 안의 모든 것을 끄고, {{s}}는 안의 모든 것을 솔로로 만듭니다. 스택 안에 스택을 넣을 수 있습니다(네 단계까지). 트랙이나 스택을 선택하고 [[⇧⌘D]]를 누르거나, 스택을 다른 스택 안으로 드래그합니다.') +
    draw(80, 30, D.cell(0, 2, 20, 6, 'kick', 'kick') + D.cell(0, 10.5, 20, 6, 'snare', 'snare') + D.cell(0, 19, 20, 6, 'hats', 'hats') + D.arrow([[20, 5], [27, 5], [27, 13.5], [32, 13.5]]) + D.arrow([[20, 13.5], [32, 13.5]]) + D.arrow([[20, 22], [27, 22], [27, 13.5], [32, 13.5]]) + D.cell(32, 9, 20, 9, 'drums', 'drums', 'on') + D.arrow([[52, 13.5], [59, 13.5]]) + D.cell(59, 9, 21, 9, 'stereo out', 'stereo out') + D.txt(32, 23, 'the stack: patch, fader, sends', '스택: 패치, 페이더, 센드', 'xs')) +
    h('edit groups', '편집 그룹') +
    p('Tracks edited as one, such as several microphones on one kit. Choose two or more audio tracks and press [[⌃⌘G]]. The group’s letter stands after each name.', '여러 마이크로 녹음한 드럼처럼 하나로 편집하는 트랙들입니다. 오디오 트랙을 둘 이상 선택하고 [[⌃⌘G]]를 누릅니다. 이름 뒤에 그룹 글자가 붙습니다.') +
    p('On a grouped track, choosing a region chooses the regions over the same stretch on the others, so moves, cuts, trims, fades, crossfades, a marquee, flex pins and quantize go together.', '그룹 트랙에서 리전을 선택하면 다른 트랙의 같은 구간 리전도 선택됩니다. 이동, 자르기, 트림, 페이드, 크로스페이드, 마키, 플렉스 핀, 퀀타이즈가 함께 적용됩니다.') +
    table(null,
      ['[[⌃⌘G]]', ['group; with one whole group chosen, ungroup; with one track of a group, it leaves', '그룹 만들기. 그룹 전체를 선택했으면 해제, 그룹의 한 트랙이면 그 트랙만 빠집니다']],
      ['[[⇧G]]', ['all groups off for a while, and on again. The letters dim', '모든 그룹을 잠시 끄기, 다시 켜기. 글자가 흐려집니다']]) +
    h('alternatives', '대체 버전') +
    p('A track can hold its regions several times over: one set on the lane, the others put aside. Use it to keep several takes of one part.', '트랙은 리전 묶음을 여러 벌 가질 수 있습니다. 한 벌은 레인에, 나머지는 따로. 한 파트의 테이크를 여러 개 보관할 때 씁니다.') +
    p('Right-click the track’s head and choose {{alternatives}}.', '트랙 헤드를 오른쪽 클릭하고 {{alternatives}}를 고릅니다.') +
    table(null,
      ['{{new, empty}}', ['puts what is on the lane aside and leaves the lane empty', '레인에 있던 것을 따로 두고 레인을 비웁니다']],
      ['{{new, a copy of this one}}', ['leaves a copy on the lane', '레인에 사본을 남깁니다']],
      ['{{alternative 2}}', ['the lane’s regions and that set change places', '레인의 리전과 그 묶음이 자리를 바꿉니다']],
      ['{{delete the others}}', ['keeps only what is on the lane', '레인에 있는 것만 남깁니다']]) +
    p('The strip, the patch, the plug-ins and the automation lines are shared; only the regions differ. Edits of the song’s time, the tempo and the measure are done to the sets put aside as well.', '스트립, 패치, 플러그인, 오토메이션 라인은 공유되고 리전만 다릅니다. 곡의 시간 편집, 템포, 박자 변경은 따로 둔 묶음에도 적용됩니다.') +
    note('There is no take folder and no comping lane: an alternative switches the whole lane.', '테이크 폴더나 컴핑 레인은 없습니다. 대체 버전은 레인 전체를 바꿉니다.') }),
])
