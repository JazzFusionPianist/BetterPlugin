import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('handoff', t('hand off and bounce', '내보내기와 바운스'),
  t('Hand off sends the stems or the mix, over a range, as sound files and nothing else: the stems into a folder, the mix as one file. Bounce in place prints regions onto a new track.', '내보내기는 정한 범위의 스템이나 믹스를 소리 파일로만 내보냅니다. 스템은 폴더 하나에, 믹스는 파일 하나로. 제자리 바운스는 리전을 새 트랙에 찍습니다.'), [

  page(t('the hand-off panel', '내보내기 패널'), { kind: 'split', tw: 138, txt:
    p('Open it with [[⌘B]] or ((File > Hand Off…)); it comes up in the middle of the window. [[⌘E]] opens it set to stems. At the right, two large keys: {{stems}} (a file for each track) and {{bounce}} (the mix as it sounds). For a bounce, {{wav}} or {{mp3}} stands right under them. A line says how it will be printed; {{change}} opens every choice.', '[[⌘B]]나 ((File > Hand Off…))로 열면 창 가운데에 뜹니다. [[⌘E]]는 스템으로 맞춰서 엽니다. 오른쪽에 큰 키 둘: {{stems}}(트랙마다 파일 하나)와 {{bounce}}(지금 들리는 그대로의 믹스). bounce면 그 아래에 {{wav}}와 {{mp3}}가 바로 있습니다. 어떻게 찍힐지 한 줄로 나오고, {{change}}를 누르면 모든 선택이 열립니다.') +
    legend(
      [1, 'what will be sent, its length, rate and depth', '보낼 것과 그 길이, 레이트, 뎁스'],
      [2, 'for stems, one line for each track that sounds in the range, with the size of its file. A square fills when that track is done', '스템이면 범위 안에서 소리가 나는 트랙마다 한 줄, 파일 크기와 함께. 그 트랙이 끝나면 네모가 채워집니다'],
      [3, '{{stems}} or {{bounce}}, how it will be printed, and {{change}}', '{{stems}}나 {{bounce}}, 어떻게 찍힐지, 그리고 {{change}}'],
      [4, '{{send}} first asks where it goes and what it is called, in the Mac’s save panel. Then the line beside it reads “rendering 3 of 12”, then “saved as” and the name, and the Finder shows the folder', '{{send}}를 누르면 먼저 Mac 저장 창에서 위치와 이름을 묻습니다. 이어서 옆에 “rendering 3 of 12”가 나오고, 끝나면 “saved as”와 이름이 나오며 Finder가 폴더를 보여 줍니다']) +
    table([['row', '줄'], ['choices', '선택'], ['notes', '참고']],
      [['the two keys', '두 키'], '{{stems}}  {{bounce}}', ['a bounce is everything, as it goes to the speakers', 'bounce는 스피커로 나가는 그대로의 전체']],
      [['the list', '목록'], ['click a row', '줄 클릭'], ['stems only. That track’s stem is left out, a dash by its name; click again to take it in. [[⌥]] click: that one alone, and again for all', '스템 전용. 그 트랙의 스템이 빠지고 이름 앞에 줄표가 생깁니다. 다시 클릭하면 들어갑니다. [[⌥]] 클릭: 그 하나만, 다시 하면 전부']],
      ['{{print}}', '{{with patch}}  {{dry}}  {{both}}', ['stems only. Dry steps past the track’s own prints and plug-ins; both writes two files a track', '스템 전용. dry는 그 트랙의 프린트와 플러그인을 건너뜁니다. both는 트랙마다 파일 둘']],
      ['{{range}}', ['the part the playhead is in, {{cycle}}, {{song}}', '플레이헤드가 있는 파트, {{cycle}}, {{song}}'], ['song runs from bar 1 to where the sound ends', 'song은 1마디에서 소리가 끝나는 곳까지']],
      ['{{file}}', '{{wav}}  {{aiff}}  {{flac}}  {{m4a}}  {{mp3}}', ['m4a is AAC at 256 kbps. With mp3 the row below is {{kbps}}: 128, 192, 256 or 320', 'm4a는 256 kbps AAC. mp3를 고르면 아래 줄이 {{kbps}}로 바뀝니다: 128, 192, 256, 320']],
      ['{{rate}}', '{{44.1}}  {{48}}  {{88.2}}  {{96}}', ['starts on the device’s rate; m4a and mp3 stop at 48', '장치 레이트에서 시작. m4a와 mp3는 48까지']],
      ['{{depth}}', '{{16}}  {{24}}  {{32 float}}', ['32 float for wav only; 16-bit files are dithered', '32 float는 wav만. 16비트 파일은 디더링됩니다']]) +
    note('The song stops when you press send. Hand off is not possible while recording. Mute and solo are printed as they stand: a muted track gives a silent stem.', 'send를 누르면 재생이 멈춥니다. 녹음 중에는 내보낼 수 없습니다. 뮤트와 솔로는 지금 상태 그대로 찍힙니다. 뮤트된 트랙은 무음 스템이 됩니다.'),
    art: fig('handoff', { w: 100, calls: [[1, [140, 36], 't'], [2, [40, 150], 'l'], [3, [560, 120], 'r'], [4, [690, 345], 'b']], cap: ['in the app bounce can be chosen too, and the line shows the file’s rate and depth', '앱에서는 bounce도 고를 수 있고, 한 줄에 파일의 레이트와 뎁스도 나옵니다'] }) }),

  page(t('what is in the folder, and bounce in place', '폴더에 든 것, 그리고 제자리 바운스'), { kind: 'split', tw: 108, mid: true, txt:
    h('what is printed', '찍히는 것') +
    list(
      ['A stem is its track after the fader and the pan, with only what flows into it sounding. Buses and stacks that those tracks reach get stems too.', '스템은 페이더와 팬을 지난 그 트랙이며, 그리로 흘러드는 것만 소리 납니다. 그 트랙들이 닿는 버스와 스택도 스템이 됩니다.'],
      ['Stems do not pass the stereo out’s fader or its guard. The mix does.', '스템은 스테레오 아웃의 페이더와 가드를 지나지 않습니다. 믹스는 지납니다.'],
      ['While it prints, a card in the middle of the window shows how far along it is.', '프린트하는 동안 창 가운데의 카드가 진행 상황을 보여줍니다.'],
      ['A tail runs on after the range so reverb and echo ring out: 2.5 seconds with patch and for the mix, 0.05 seconds dry.', '리버브와 에코가 울려 사라지도록 범위 뒤에 꼬리가 붙습니다. 패치 포함과 믹스는 2.5초, 드라이는 0.05초.'],
      ['The click is never printed.', '클릭은 찍히지 않습니다.']) +
    h('bounce in place', '제자리 바운스') +
    p('Choose one or more regions and press [[⌃B]]. For each track, its chosen regions are printed through its prints and plug-ins, taken before the fader, with a two-second tail.', '리전을 하나 이상 선택하고 [[⌃B]]를 누릅니다. 트랙마다 선택한 리전이 프린트와 플러그인을 거쳐, 페이더 앞에서, 2초 꼬리와 함께 찍힙니다.') +
    list(
      ['The result is a new track right under the source, named after it with “bounce”, with the source’s level, pan, out and sends, and an empty patch.', '결과는 원본 바로 아래의 새 트랙입니다. 원본 이름에 “bounce”가 붙고, 원본의 레벨, 팬, 아웃, 센드를 가지며 패치는 비어 있습니다.'],
      ['The regions that were printed are muted, not removed.', '찍힌 리전은 지워지지 않고 뮤트됩니다.'],
      ['The file is a 24-bit WAV in the project’s audio folder. One step to undo.', '파일은 프로젝트 audio 폴더의 24비트 WAV입니다. 실행 취소 한 번.']) +
    note('Only the chosen regions sound during a bounce, so a plug-in that listens to another track hears it only if that track’s regions are chosen too.', '바운스 중에는 선택한 리전만 소리가 나므로, 다른 트랙을 듣는 플러그인은 그 트랙의 리전도 선택했을 때만 그것을 듣습니다.'),
    art: draw(150, 98,
      D.txt(0, 4, '~/Music/Slur Studio', '~/Music/Slur Studio', 'b') +
      D.line(2, 6, 2, 14, 'soft') + D.line(2, 14, 8, 14, 'soft') +
      D.cell(10, 9.5, 70, 9, 'low tide ep chorus stems', 'low tide ep chorus stems', 'on') + D.txt(83, 15, 'the name and the place you gave', '직접 정한 이름과 위치', 'xs') +
      D.line(14, 18.5, 14, 90, 'soft') +
      [['01 kick.wav', 'one file for each track; with both: “01 kick patch.wav” and “01 kick dry.wav”', '트랙마다 파일 하나. both면 “01 kick patch.wav”와 “01 kick dry.wav”'],
        ['02 snare.wav …', 'numbered as the tracks stand in the song', '곡의 트랙 순서대로 번호']].map(([f, en, ko], i) => D.line(14, 28 + i * 11.6, 20, 28 + i * 11.6, 'soft') + D.txt(22, 29 + i * 11.6, f, f) + D.txt(22, 33.4 + i * 11.6, en, ko, 'xs')).join('') +
      D.txt(0, 60, 'the mix is one file where you put it, with no folder: “low tide ep chorus mix.wav”', '믹스는 폴더 없이 정한 위치에 파일 하나로 나옵니다. “low tide ep chorus mix.wav”', 'xs')) }),
  page(t('realtime bounce', '실시간 바운스'), { kind: 'text', cc: 3, txt:
    lead('A print is offline (made ahead of the song, as fast as the machine goes) or realtime: the song plays from the start of the range to its end, you hear it, and it is printed as it goes. Both give the very same sound.', '프린트는 오프라인(곡보다 앞서, 컴퓨터가 할 수 있는 만큼 빠르게)이나 실시간 중 하나입니다. 실시간이면 곡이 범위의 처음부터 끝까지 재생되고, 들으면서 그대로 프린트됩니다. 둘의 소리는 똑같습니다.') +
    h('choosing it', '고르기') +
    list(
      ['Hand off: press {{change}} and set {{mode}} to {{realtime}}. It is said in the line under the two keys.', '내보내기: {{change}}를 누르고 {{mode}}를 {{realtime}}으로 둡니다. 두 큰 키 아래의 한 줄에도 표시됩니다.'],
      ['Bounce in place: ((File > Bounce in Place in Realtime)). [[⌃B]] stays the offline one.', '제자리 바운스: ((File > Bounce in Place in Realtime)). [[⌃B]]는 그대로 오프라인입니다.'],
      ['Stems print with the patch in realtime: a track is heard one way at a time.', '실시간 스템은 패치를 거친 소리로만 프린트됩니다. 트랙은 한 번에 한 가지로만 들리기 때문입니다.']) +
    h('the room while it plays', '재생되는 동안의 방') +
    p('The room becomes a picture of the print, made to be filmed. The buttons of the tracks’ heads go away row by row, then the heads themselves, the tool row, the bars and the foot fold away, and the panels close: the control bar, the markers and the sound are left. The grid, the regions and the playhead go too. Each track’s sound going in is a hairline outline in its colour; the sound coming out is drawn in behind the place the song has reached, glowing where it is being drawn. About eight bars fill the window, and the window goes along with the song, the place being drawn a little right of its middle.', '방은 녹화하기 좋은 프린트의 그림이 됩니다. 트랙 헤드의 버튼이 한 줄씩 사라진 뒤 트랙 헤드 칸, 툴 줄, 마디 줄, 맨 아래 줄이 접히고 패널도 닫혀서 컨트롤 바, 마커, 소리만 남습니다. 그리드, 리전, 플레이헤드도 사라집니다. 각 트랙에 들어가는 소리는 트랙 색의 가는 윤곽선으로, 나오는 소리는 곡이 지나간 자리에 채워져 그려지며, 지금 그려지는 곳이 빛납니다. 창에는 여덟 마디쯤이 보이고, 지금 그려지는 곳이 가운데보다 조금 오른쪽에 머물도록 창이 곡을 따라 흘러갑니다.') +
    note('[[esc]] or [[space]] stops it, and nothing of it is kept; [[esc]] stops an offline print too, while its card is up. Nothing else can be done to the song while it plays. When it ends the room comes back as it was.', '[[esc]]나 [[space]]로 멈추면 아무것도 남지 않습니다. 오프라인 프린트도 카드가 떠 있는 동안 [[esc]]로 멈춥니다. 재생되는 동안에는 곡에 다른 일을 할 수 없습니다. 끝나면 방은 원래대로 돌아옵니다.') }),
])
