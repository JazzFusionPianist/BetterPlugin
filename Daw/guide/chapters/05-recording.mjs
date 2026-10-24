import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('recording', t('recording', '녹음'),
  t('Choosing an input, arming a track, hearing yourself through the track, and what a take does from the count-in to the file on the disk.', '입력을 고르고, 트랙을 녹음 대기로 두고, 트랙을 통해 자기 소리를 듣는 법. 그리고 카운트인에서 디스크의 파일까지 테이크가 하는 일.'), [

  page(t('input, arm, hear', '입력, 녹음 대기, 듣기'), { kind: 'split', tw: 112, mid: true, txt:
    table([['', ''], ['how', '방법'], ['what it does', '하는 일']],
      [['input', '입력'], ['{{in}} in the strip of the transport panel; or the {{input}} row of the new-track list', '트랜스포트 패널 스트립의 {{in}}. 또는 새 트랙 목록의 {{input}} 줄'], ['One input gives a mono take heard on both sides; a pair (“input 1 and 2”) gives a stereo take. A new track listens to input 1', '입력 하나는 양쪽에서 들리는 모노 테이크, 한 쌍(“input 1 and 2”)은 스테레오 테이크. 새 트랙은 input 1을 듣습니다']],
      [['arm', '녹음 대기'], ['{{r}} on the head or the strip', '헤드나 스트립의 {{r}}'], ['Red when armed. Audio tracks and tracks of notes only. An armed track’s meter shows what comes in, in red, while {{i}} is off. One arm goes with the chosen track: choose another and it moves there (to an audio track only from another audio track). Two or more pressed by hand stay where they are, and record together', '대기 상태면 빨간색. 오디오 트랙과 노트 트랙만 가능. 대기 중인 트랙의 미터는 {{i}}가 꺼져 있을 때 들어오는 소리를 빨간색으로 보여 줍니다. 대기가 하나면 선택한 트랙을 따라갑니다. 다른 트랙을 고르면 그리로 옮겨 갑니다(오디오 트랙으로는 다른 오디오 트랙에서만). 직접 둘 이상 눌러 두면 그대로 남고 함께 녹음됩니다']],
      [['hear the input', '입력 듣기'], ['{{i}}, or [[⌃I]] for the chosen tracks', '{{i}}, 또는 선택한 트랙에 [[⌃I]]'], ['Orange when on. The input is heard through the track: its patch, plug-ins, fader, pan and sends. It does not switch by itself with arm or record', '켜지면 주황색. 입력이 트랙을 거쳐 들립니다. 패치, 플러그인, 페이더, 팬, 센드까지. 녹음 대기나 녹음과 함께 저절로 켜지지 않습니다']],
      [['the device', '장치'], ['((Slur Studio > Settings…)) [[⌘,]], or the last line of the input list', '((Slur Studio > Settings…)) [[⌘,]], 또는 입력 목록의 마지막 줄'], ['Output, input, rate and buffer. See “settings”', '출력, 입력, 레이트, 버퍼. “설정” 참고']]) +
    p('The input is opened the first time a track asks to hear or record it; macOS then asks whether the app may use the microphone. If it may not, the foot says “the microphone is not allowed for this app”.', '입력은 트랙이 처음 듣거나 녹음하려 할 때 열리고, 그때 macOS가 마이크 사용을 허락할지 묻습니다. 허락되지 않았다면 아래에 “the microphone is not allowed for this app”이라고 나옵니다.') +
    note('What is recorded is taken straight from the input, before the patch, the plug-ins and the fader. You hear the patch; the file stays dry.', '녹음되는 것은 패치, 플러그인, 페이더를 거치기 전의 입력 그대로입니다. 귀로는 패치가 걸린 소리를 듣지만 파일은 드라이로 남습니다.'),
    art: draw(140, 78,
      D.txt(0, 4, 'an audio track while you record', '녹음 중인 오디오 트랙', 's') +
      D.cell(0, 26, 24, 10, 'input 1', 'input 1') +
      D.arrow([[24, 31], [38, 31]]) +
      D.cell(38, 26, 14, 10, 'i', 'i', 'on') + D.txt(45, 41, 'hear the input', '입력 듣기', 'xs m') +
      D.arrow([[52, 31], [62, 31]]) +
      D.cell(62, 26, 22, 10, 'patch', 'patch') + D.arrow([[84, 31], [90, 31]]) +
      D.cell(90, 26, 22, 10, 'fader, pan', '페이더, 팬') + D.arrow([[112, 31], [120, 31]]) +
      D.cell(120, 26, 20, 10, 'out', 'out') +
      D.txt(87, 22, 'what you hear', '귀로 듣는 것', 'xs m') + D.line(62, 23.5, 140, 23.5, 'soft') +
      // the branch to the file
      D.arrow([[30, 31], [30, 56], [62, 56]]) + D.cell(38, 51, 14, 10, 'r', 'r', 'on') +
      D.cell(62, 51, 50, 10, 'kick take.wav, 24 bit', 'kick take.wav, 24 bit', 'dash') +
      D.txt(87, 66, 'what is written: the input itself', '기록되는 것: 입력 그대로', 'xs m')) }),

  page(t('a take', '테이크'), { kind: 'split', tw: 118, txt:
    table(null,
      [['start', '시작'], ['[[R]], the red dot, or typing record. If nothing is armed, the chosen track is armed for you. Every armed track records at once, each from its own input', '[[R]], 빨간 점, 또는 record 입력. 대기 중인 트랙이 없으면 선택한 트랙이 대기 상태가 됩니다. 대기 중인 모든 트랙이 각자의 입력에서 동시에 녹음합니다']],
      [['where', '위치'], ['at the playhead, exactly. With the count-in on, the song starts one bar earlier; that bar plays and the click counts it', '정확히 플레이헤드에서. 카운트인이 켜져 있으면 한 마디 앞에서 재생이 시작되고 클릭이 그 마디를 셉니다']],
      [['count-in', '카운트인'], ['[[⇧K]] turns it off and on; it is on at first, one bar long. Through the count-in the click sounds whether or not the click is on', '[[⇧K]]로 끄고 켭니다. 처음엔 켜져 있고 길이는 한 마디. 카운트인 동안에는 클릭이 꺼져 있어도 클릭이 납니다']],
      [['click', '클릭'], ['[[K]]: a blip on every beat, the first of a bar higher. It is never printed', '[[K]]: 박마다 짧은 소리, 마디 첫 박은 높게. 내보내는 파일에는 들어가지 않습니다']],
      [['low latency', '저지연'], ['the bolt in the transport. Lit, what is heard live skips what is later than the limit (settings > audio, 5 ms): those say {{skipped}} on the wall. Prints keep everything. It is off when the app starts and is not saved with a project', '트랜스포트의 번개. 켜져 있는 동안 지금 들리는 소리는 기준(설정 > audio, 처음엔 5 ms)보다 늦은 것을 건너뜁니다. 그 길의 플러그인과 프린트는 벽에 {{skipped}}로 표시됩니다. 내보내는 파일에는 모두 들어갑니다. 앱을 열면 꺼져 있고, 프로젝트에 저장되지 않습니다']],
      [['stop and keep', '멈추고 보관'], ['[[space]], [[R]] again, stop, or the red dot', '[[space]], 다시 [[R]], 정지, 또는 빨간 점']],
      [['stop and throw away', '멈추고 버리기'], ['[[⌘.]]: the files are deleted', '[[⌘.]]: 파일이 지워집니다']]) +
    h('when it stops', '멈추면') +
    p('Each take becomes a region on its track, already moved back by how late the device runs, and chosen. What lay under it gives way. The file is a 24-bit WAV at the device’s rate, in the project’s Audio Files, named after the track.', '테이크는 각 트랙의 리전이 됩니다. 장치의 지연만큼 이미 당겨져 있고, 선택된 상태입니다. 밑에 있던 것은 자리를 내줍니다. 파일은 장치 레이트의 24비트 WAV로, 프로젝트의 Audio Files 폴더에 트랙 이름으로 저장됩니다.') +
    note('The cycle is not followed while recording: there is no loop recording and no punch in or out. To keep several takes of one part, use a track’s alternatives. If the app goes down in the middle of a take, the take is brought back at the next start.', '녹음 중에는 사이클을 따르지 않습니다. 루프 녹음이나 펀치 인/아웃은 없습니다. 한 파트의 테이크를 여러 개 보관하려면 트랙의 대체 버전을 쓰세요. 녹음 중에 앱이 꺼지면 다음에 시작할 때 테이크가 복구됩니다.'),
    art: draw(128, 76,
      D.txt(0, 4, 'a take with the count-in on', '카운트인이 켜진 테이크', 's') +
      // bars
      [0, 1, 2, 3, 4].map(i => D.line(8 + i * 28, 12, 8 + i * 28, 58, 'soft') + D.txt(9.5 + i * 28, 16, String(15 + i), String(15 + i), 'xs')).join('') +
      D.box(8, 20, 112, 12, 'tint') + D.box(8, 36, 112, 12, 'tint') +
      // what is already there
      D.box(8, 21, 50, 10, 'soft') + D.box(8, 37, 28, 10, 'soft') +
      // count-in
      D.path('M36 52.5H64', 'dash') + D.txt(50, 57, 'count-in: one bar, the click', '카운트인: 한 마디, 클릭', 'xs m') +
      // playhead where the take starts
      D.line(64, 10, 64, 60, 'thick') + D.txt(64, 8.5, 'the playhead', '플레이헤드', 'xs m') +
      // the take
      `<rect x="64" y="37" width="42" height="10" rx=".7" fill="#DE4F3C" fill-opacity=".85"/>` + D.arrow([[106, 42], [116, 42]]) +
      D.txt(85, 43, 'the take', '테이크', 's m on') +
      D.txt(0, 68, 'play starts a bar early (blue line), recording begins at the playhead', '재생은 한 마디 앞에서 시작하고, 녹음은 플레이헤드에서 시작합니다', 'xs') +
      D.arrow([[36, 34], [63, 34]])) +
      `<div style="width:128mm">` + table(null,
        [['a track of notes', '노트 트랙'], ['records what you play as notes, not sound. See “notes and instruments”', '연주를 소리가 아닌 노트로 녹음합니다. “노트와 악기” 참고']],
        [['low disk', '디스크 부족'], ['a take of sound is not begun with less than 300 MB free: “could not record: the disk is full”', '여유가 300 MB 아래면 녹음을 시작하지 않습니다. “could not record: the disk is full”']],
        [['nothing came in', '아무것도 안 들어옴'], ['a take shorter than a twentieth of a second is not kept', '0.05초보다 짧은 테이크는 보관하지 않습니다']]) +
      h('what ends a take by itself', '테이크가 저절로 끝나는 경우') +
    list(
      ['The device moves to another sample rate, or stops giving sound for half a second (unplugged, the Mac slept). The take is kept as far as it got, and the foot says “the device went to another rate: the take ends here” or “the audio device stopped: the take ends here”.', '장치의 샘플 레이트가 바뀌거나 0.5초 이상 소리를 주지 않을 때(뽑힘, Mac 잠자기). 테이크는 거기까지 보관되고, 아래에 “the device went to another rate: the take ends here” 또는 “the audio device stopped: the take ends here”라고 나옵니다.'],
      ['The end of the song does not end a take: the song grows under it.', '곡의 끝은 테이크를 끝내지 않습니다. 곡이 따라 길어집니다.']) + `</div>` }),
])
