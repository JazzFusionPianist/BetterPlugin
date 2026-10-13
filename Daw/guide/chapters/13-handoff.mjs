import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('handoff', t('hand off and bounce', '내보내기와 바운스'),
  t('Hand off sends the stems or the mix, over a range, into a folder that also holds the notes, a page about the song, each track’s patch and the project itself. Bounce in place prints regions onto a new track.', '내보내기는 정한 범위의 스템이나 믹스를 폴더로 보냅니다. 폴더에는 노트, 곡 정보, 트랙마다의 패치, 프로젝트 자체도 함께 들어갑니다. 제자리 바운스는 리전을 새 트랙에 찍습니다.'), [

  page(t('the hand-off panel', '내보내기 패널'), { kind: 'split', tw: 138, txt:
    p('Open it with {{hand off}} on the control bar, [[⌘B]], or ((File > Hand Off…)). [[⌘E]] opens it set to stems.', '컨트롤 바의 {{hand off}}, [[⌘B]], 또는 ((File > Hand Off…))로 엽니다. [[⌘E]]는 스템으로 맞춰서 엽니다.') +
    legend(
      [1, 'what will be sent, its length, rate and depth', '보낼 것과 그 길이, 레이트, 뎁스'],
      [2, 'for stems, one line for each track that sounds in the range, with the size of its file. A square fills when that track is done', '스템이면 범위 안에서 소리가 나는 트랙마다 한 줄, 파일 크기와 함께. 그 트랙이 끝나면 네모가 채워집니다'],
      [3, 'the choices', '선택 항목'],
      [4, '{{send}} starts it. The line beside it reads “rendering 3 of 12”, then “saved in music, slur studio”, and the Finder shows the folder', '{{send}}로 시작합니다. 옆에 “rendering 3 of 12”가 나오고, 끝나면 “saved in music, slur studio”와 함께 Finder가 폴더를 보여 줍니다']) +
    table([['row', '줄'], ['choices', '선택'], ['notes', '참고']],
      ['{{what}}', '{{stems}}  {{mix}}', ['the mix is everything, as it goes to the speakers', 'mix는 스피커로 나가는 그대로의 전체']],
      ['{{print}}', '{{with patch}}  {{dry}}  {{both}}', ['stems only. Dry steps past the track’s own prints and plug-ins; both writes two files a track', '스템 전용. dry는 그 트랙의 프린트와 플러그인을 건너뜁니다. both는 트랙마다 파일 둘']],
      ['{{range}}', ['the part the playhead is in, {{cycle}}, {{song}}', '플레이헤드가 있는 파트, {{cycle}}, {{song}}'], ['song runs from bar 1 to where the sound ends', 'song은 1마디에서 소리가 끝나는 곳까지']],
      ['{{file}}', '{{wav}}  {{aiff}}  {{flac}}  {{m4a}}  {{mp3}}', ['m4a is AAC at 256 kbps. mp3 is dimmed unless the program lame is on the Mac', 'm4a는 256 kbps AAC. mp3는 Mac에 lame 프로그램이 없으면 흐리게 표시됩니다']],
      ['{{rate}}', '{{44.1}}  {{48}}  {{88.2}}  {{96}}', ['starts on the device’s rate; m4a and mp3 stop at 48', '장치 레이트에서 시작. m4a와 mp3는 48까지']],
      ['{{depth}}', '{{16}}  {{24}}  {{32 float}}', ['32 float for wav only; 16-bit files are dithered', '32 float는 wav만. 16비트 파일은 디더링됩니다']]) +
    note('The song stops when you press send. Hand off is not possible while recording. Mute and solo are printed as they stand: a muted track gives a silent stem.', 'send를 누르면 재생이 멈춥니다. 녹음 중에는 내보낼 수 없습니다. 뮤트와 솔로는 지금 상태 그대로 찍힙니다. 뮤트된 트랙은 무음 스템이 됩니다.'),
    art: fig('handoff', { w: 106, calls: [[1, [120, 30], 't'], [2, [34, 150], 'l'], [3, [402, 280], 'r'], [4, [402, 329], 'r']], cap: ['in the app the panel also has the rows what, file, rate and depth', '앱에서는 패널에 what, file, rate, depth 줄도 있습니다'] }) }),

  page(t('what is in the folder, and bounce in place', '폴더에 든 것, 그리고 제자리 바운스'), { kind: 'split', tw: 108, mid: true, txt:
    h('what is printed', '찍히는 것') +
    list(
      ['A stem is its track after the fader and the pan, with only what flows into it sounding. Buses and stacks that those tracks reach get stems too.', '스템은 페이더와 팬을 지난 그 트랙이며, 그리로 흘러드는 것만 소리 납니다. 그 트랙들이 닿는 버스와 스택도 스템이 됩니다.'],
      ['Stems do not pass the stereo out’s fader or its guard. The mix does.', '스템은 스테레오 아웃의 페이더와 가드를 지나지 않습니다. 믹스는 지납니다.'],
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
      D.cell(10, 9.5, 70, 9, 'low tide ep chorus stems 142233', 'low tide ep chorus stems 142233', 'on') + D.txt(83, 15, 'project, range, what, time of day', '프로젝트, 범위, 종류, 시각', 'xs') +
      D.line(14, 18.5, 14, 90, 'soft') +
      [['01 kick.wav', 'one file for each track; with both: “01 kick patch.wav” and “01 kick dry.wav”', '트랙마다 파일 하나. both면 “01 kick patch.wav”와 “01 kick dry.wav”'],
        ['02 snare.wav …', 'numbered as the tracks stand in the song', '곡의 트랙 순서대로 번호'],
        ['low tide ep chorus.mid', 'the notes as they sound, when the song has tracks of notes', '노트 트랙이 있으면 들리는 그대로의 노트'],
        ['low tide ep chorus info.txt', 'tempo, measure, key, the range in bars, the markers, the tracks', '템포, 박자, 키, 마디 범위, 마커, 트랙'],
        ['05 keys patch.orbpatch', 'for each track with a print on: its patch, as a file Patch on Slur opens', '프린트가 켜진 트랙마다: 그 패치. Patch on Slur가 여는 파일'],
        ['low tide ep.sls', 'the whole project as just saved, with its sounds', '방금 저장된 프로젝트 전체, 소리 포함']].map(([f, en, ko], i) => D.line(14, 28 + i * 11.6, 20, 28 + i * 11.6, 'soft') + D.txt(22, 29 + i * 11.6, f, f) + D.txt(22, 33.4 + i * 11.6, en, ko, 'xs')).join('') +
      D.txt(0, 97, 'for the mix, the sound is one file: “low tide ep chorus.wav”', '믹스일 때는 소리 파일이 하나입니다. “low tide ep chorus.wav”', 'xs')) }),
])
