import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

// one clause of a line, drawn as cells: [word, kind]
const clause = (x, y, cells) => { let s = '', cx = x; for (const [w, kind, wd] of cells) { const ww = wd || Math.max(12, w.length * 1.75 + 5); s += D.cell(cx, y, ww, 8, w, w, kind === 'do' ? 'on' : kind === 'then' ? 'dash' : '') + D.txt(cx + ww / 2, y + 12.5, ...({ who: ['who', '누구'], where: ['where', '어디'], much: ['how much', '얼마나'], do: ['do', '무엇을'], then: ['then', '그리고'] })[kind], 'xs m'); cx += ww + 1.6 } return s }

/* the three ways side by side: the bass along the song and up from its lows, the kick's hits as dots over it, and where the
   bass gives way drawn pale: A always at the kick's low, B on each hit and all of it, C on each hit and only where they meet */
const waysDrawn = () => {
  let s = ''
  const pale = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--paper)" fill-opacity=".78"/>`
  ;[['A', 'carve the lows', 'always, at the kick’s low', '늘, 킥의 저음 자리에서'], ['B', 'duck the bass', 'on each hit, all of the bass', '칠 때마다, 베이스 전체'], ['C', 'only where they meet', 'on each hit, only where they meet', '칠 때마다, 겹치는 곳만']].forEach(([l, name, en, ko], i) => {
    const x = i * 42, hits = [3, 12, 21, 30]
    s += `<rect x="${x}" y="11" width="36" height="16" fill="var(--ink)" fill-opacity=".16"/>` + D.box(x, 5, 36, 22, 'soft')
    for (const hx of hits) s += D.dot(x + hx + 1.4, 2.6, .75, 'bl')
    if (i === 0) s += pale(x, 17.5, 36, 3.4)
    for (const hx of hits) { if (i === 1) s += pale(x + hx, 11, 3.2, 16); if (i === 2) s += pale(x + hx, 16, 3.2, 6) }
    s += D.line(x, 16, x + 36, 16, 'dash soft') + D.line(x, 22, x + 36, 22, 'dash soft')
    s += D.txt(x, 32.5, l + '  ' + name, l + '  ' + name, 'b') + D.txt(x, 36.6, en, ko, 'xs')
  })
  return s
}

export default () => chapter('say', t('the command line', '커맨드 라인'),
  t('Type what you want done, in English, on the panel’s prompt page (or at the foot of the window). Everything one line does is one step of undo.', '패널의 prompt 페이지(또는 창 맨 아래)에 하고 싶은 일을 영어로 입력합니다. 한 줄이 한 모든 일은 실행 취소 한 번으로 되돌아갑니다.'), [

  page(t('saying it', '말로 하기'), { kind: 'split', tw: 112, txt:
    table(null,
      ['[[/]]', ['opens the prompt page with the keys in its field: what can follow is listed under it at the left, what was said and what came of it at the right, newest first (the last 40, with the time). Click one to put it back in the field', 'prompt 페이지를 열고 입력칸에 키를 줍니다. 아래 왼쪽에 이어질 말, 오른쪽에 했던 말과 그 결과가 최근 것부터 나옵니다(최근 40줄, 시각과 함께). 하나를 클릭하면 입력칸에 다시 들어갑니다']],
      ['[[↩]]', ['run the line; a word not yet whole (`rev`) is completed first', '줄 실행. 덜 친 낱말(`rev`)은 먼저 완성합니다']],
      [['a letter', '글자 하나'], ['a list opens of what begins with it: first the tracks and the acts for a value ({{lower}}, {{raise}}, {{set to}}…), then every word the line knows, in the order of the alphabet. [[↑]] [[↓]] go down it, past the rows shown; [[tab]] takes a word, [[esc]] closes it', '그 글자로 시작하는 것의 목록이 열립니다: 먼저 트랙과 값에 쓰는 동작({{lower}}, {{raise}}, {{set to}}…), 그다음 커맨드 라인이 아는 모든 낱말이 알파벳 순서로. [[↑]] [[↓]]로 보이는 줄 너머까지 내려가고, [[tab]]으로 넣고 [[esc]]로 닫습니다']],
      [['a space', '띄어쓰기'], ['what the line still lacks is offered: an act and whom first, then where and how much', '줄에 아직 빠진 것이 목록에 나옵니다: 먼저 동작과 대상, 그다음 어디와 얼마나']],
      ['[[↑]] [[↓]]', ['at the foot, with no list open: lines said before; the last 60 are kept while the app is open. On the prompt page, click a line under {{said}} instead', '맨 아래 줄에서 목록이 닫혀 있을 때: 전에 입력한 줄. 앱이 열려 있는 동안 최근 60줄을 기억합니다. prompt 페이지에서는 {{said}} 아래의 줄을 클릭합니다']],
      ['[[esc]]', ['leave', '나가기']]) +
    p('On the prompt page the answer stands beside the line, under {{said}}; at the foot, right beside what you typed. One change is shown as before and after: “kick −6.0 to −9.0 db”. Anything else in a few words: “cut at 19.1.1”, “3 tracks −2 db”. At the foot, while nothing else has been done since, an {{undo}} key stands beside the answer and takes the whole line back. Once you have left the field, [[⌘Z]] does the same; inside it, [[⌘Z]] belongs to the typing.', 'prompt 페이지에서는 답이 {{said}} 아래 그 줄 옆에 나오고, 맨 아래 줄에서는 입력한 글자 바로 옆에 나옵니다. 값 하나가 바뀌면 전과 후로 보여 줍니다. “kick −6.0 to −9.0 db”. 그 밖에는 몇 마디로. “cut at 19.1.1”, “3 tracks −2 db”. 맨 아래 줄에서는 그 뒤로 다른 일을 하지 않았다면 답 옆에 {{undo}} 키가 있고, 줄 전체를 되돌립니다. 입력칸을 벗어난 뒤에는 [[⌘Z]]도 같고, 입력칸 안에서 [[⌘Z]]는 친 글자를 되돌립니다.') +
    note('The command line reads English only, whichever language the app is set to; a track’s name is found as you wrote it. No line leaves the Mac: the command line is read by the app itself.', '앱의 언어 설정과 상관없이 커맨드 라인은 영어만 읽습니다. 트랙 이름은 붙인 그대로 찾습니다. 입력한 줄은 Mac 밖으로 나가지 않습니다. 커맨드 라인은 앱이 직접 읽습니다.'),
    art: fig('prompt', { w: 140, calls: [[1, [300, 61], 't'], [2, [24, 150], 'l'], [3, [818, 128], 'r']] }) +
      `<div style="width:140mm">` + legend(
        [1, 'the field: the line being typed; words taken from the list stand in it as cells', '입력칸: 치고 있는 줄. 목록에서 고른 낱말은 셀로 들어갑니다'],
        [2, '{{what can follow}}: the words the line can take next, with their kind', '{{what can follow}}: 다음에 올 수 있는 낱말과 그 종류'],
        [3, '{{said}}: each line with what came of it, newest first; click one to put it back in the field', '{{said}}: 말한 줄과 그 결과, 최신부터. 클릭하면 입력칸에 다시 들어갑니다']) + `</div>` +
      fig('prompt-ask', { w: 140, cap: ['a word two tracks answer to: nothing is done, and the line asks which', '두 트랙이 해당하는 낱말: 아무것도 하지 않고 어느 쪽인지 묻습니다'] }) }),

  page(t('reading a line, building one', '줄 읽기, 줄 만들기'), { kind: 'text', cc: 2, txt:
    h('how a line is read', '줄을 읽는 방식') +
    list(
      ['A line is one clause, or several joined by `then`. Each clause says, in any order: who, where, what to do, how much.', '한 줄은 절 하나, 또는 `then`으로 이은 여러 절입니다. 절마다 순서에 상관없이 누구, 어디, 무엇을, 얼마나를 말합니다.'],
      ['`and` (or a comma) joins names; it does not start a new action. Say `drums 2db down then solo bass`, not “and solo bass”.', '`and`(또는 쉼표)는 이름을 잇는 말이고 새 동작을 시작하지 않습니다. “and solo bass”가 아니라 `drums 2db down then solo bass`라고 합니다.'],
      ['A clause that names nobody takes who the clause before named.', '누구인지 말하지 않은 절은 앞 절에서 말한 대상을 이어받습니다.'],
      ['One word it does not know and the whole line is refused: “couldn’t read that”. Nothing is changed.', '모르는 낱말이 하나라도 있으면 줄 전체를 거절합니다. “couldn’t read that”. 아무것도 바뀌지 않습니다.']) +
    draw(120, 50,
        D.txt(0, 4, 'clauses', '절', 's') +
        clause(0, 8, [['drums', 'who'], ['2db down', 'much'], ['then', 'then'], ['solo', 'do'], ['bass', 'who']]) +
        clause(0, 30, [['mute', 'do'], ['guitar', 'who'], ['from 17 to 24', 'where', 30]])) +
    h('a line from the list', '목록으로 줄 만들기') +
    p('A line can also be put together from the list, cell by cell. What is taken stands in the field as a cell, and the next list holds only what can follow. The act may come first or last; any order that makes sense is taken.', '줄은 목록에서 셀을 하나씩 골라 만들 수도 있습니다. 고른 것은 입력칸에 셀로 서고, 다음 목록에는 그 뒤에 올 수 있는 것만 나옵니다. 동작은 처음에 와도 끝에 와도 되며, 말이 되는 순서는 모두 받습니다.') +
    steps(
      ['Take a track. The list offers what is on it: {{volume}}, {{pan}}, {{tape}}, {{space}}, {{delay}}, its sends, its plug-ins (then a plug-in’s controls), its macros, and plain acts ({{mute}}, {{solo}}, {{delete}}…).', '트랙을 고릅니다. 목록에 그 트랙에 있는 것이 나옵니다: {{volume}}, {{pan}}, {{tape}}, {{space}}, {{delay}}, 센드, 플러그인(그다음 그 컨트롤), 매크로, 그리고 {{mute}}, {{solo}}, {{delete}} 같은 동작.'],
      ['A stretch: type a bar and take `9 ~ 16` or `9 ~ end`, a marker, or the cycle. A stretch is drawn in the cycle’s colour.', '구간: 마디 번호를 치고 `9 ~ 16`이나 `9 ~ end`, 마커, 사이클 중에서 고릅니다. 구간 셀은 사이클 색으로 그려집니다.'],
      ['How much, in the value’s own unit.', '얼마나: 그 값의 단위로.'],
      ['The act: {{lower}}, {{raise}}, {{set to}}, {{lower gradually}}, {{raise gradually}}. After a gradual one, a curve, or [[↩]] for a straight line.', '동작: {{lower}}, {{raise}}, {{set to}}, {{lower gradually}}, {{raise gradually}}. 점점 바뀌는 동작이면 그다음 커브를 고르거나 [[↩]]로 직선.']) +
    p('While the act is being chosen, the line it would draw is shown dashed on the track’s lane. [[↩]] draws it, in one step of undo. [[⌫]] in the empty field takes the last cell back; [[esc]] closes the list, and again clears the cells. The cells’ words are English whichever language the app is set to.', '동작을 고르는 동안 그려질 라인이 트랙 레인에 점선으로 보입니다. [[↩]]로 그리며, 실행 취소 한 번으로 되돌아갑니다. 입력칸이 비었을 때 [[⌫]]는 마지막 셀을 지우고, [[esc]]는 목록을 닫고 한 번 더 누르면 셀을 비웁니다. 셀의 낱말은 앱의 언어와 상관없이 영어입니다.') +
    draw(120, 34,
      D.txt(0, 4, 'one line, five cells', '한 줄, 셀 다섯 개', 's') +
      [['keys', 'track', '트랙', 14, ''], ['send reverb', 'what', '무엇', 24, ''], ['9 ~ 16', 'where', '어디', 16, 'on'], ['6 db', 'how much', '얼마나', 13, ''], ['lower gradually', 'the act', '동작', 30, 'dash']].reduce((acc, [w, en, ko, ww, k]) => {
        acc.s += D.cell(acc.x, 8, ww, 8, w, w, k) + D.txt(acc.x + ww / 2, 20.5, en, ko, 'xs m'); acc.x += ww + 2.5; return acc }, { s: '', x: 0 }).s +
      D.txt(0, 30, 'the act stays dashed until it is taken; return then draws the line', '동작은 고르기 전까지 점선입니다. 고른 뒤 return으로 라인을 그립니다', 'xs')) }),

  page(t('plain lines', '간단한 줄'), { kind: 'split', tw: 128, txt:
    table([['type', '입력'], ['does', '하는 일']],
      ['`play`  `start`', ['plays', '재생']],
      ['`stop`  `pause`', ['stops', '정지']],
      ['`record`  `rec`', ['starts a take', '녹음 시작']],
      ['`tempo 96`  `96 bpm`', ['the tempo, whole numbers from 60 to 180 here', '템포. 여기서는 60~180의 정수']],
      ['`17`  `bar 17`  `17.3`', ['the playhead to bar 17 (beat 3)', '플레이헤드를 17마디로(3박)']],
      ['`undo`  `redo`', ['one step back, forward', '한 단계 뒤로, 앞으로']],
      ['`save`', ['saves now', '지금 저장']],
      ['`click on`  `click off`', ['the click', '클릭']],
      ['`cycle on`  `cycle off`', ['the cycle', '사이클']],
      ['`new track`', ['a new audio track', '새 오디오 트랙']],
      ['`new bus`', ['a new bus', '새 버스']],
      ['`export`  `hand off`  `bounce`', ['opens the hand-off panel', '내보내기 패널 열기']],
      ['`mixer`  `patch`', ['opens that page', '그 페이지 열기']]) +
    note('A bare number is a bar. A bare signed number (`-3`, `+2`) changes the gain of the chosen regions by that many dB.', '숫자만 쓰면 마디입니다. 부호가 붙은 숫자(`-3`, `+2`)는 선택한 리전의 게인을 그만큼 dB 바꿉니다.'),
    art: `<div style="width:128mm">` + h('a track named outright, then one thing', '트랙 이름을 그대로 쓰고 한 가지') +
      table([['type', '입력'], ['does', '하는 일']],
        ['`kick -3`', ['the fader by that much', '페이더를 그만큼']],
        ['`kick 2 db down`', ['the fader down, up', '페이더 내리기, 올리기']],
        ['`kick to -6`', ['the fader to that level', '페이더를 그 레벨로']],
        ['`kick mute`  `kick solo`', ['mute, solo; `unmute`, `unsolo` undo them', '뮤트, 솔로. `unmute`, `unsolo`로 풉니다']],
        ['`kick pan l 30`  `kick pan c`', ['pan, 0 to 100 each way', '팬, 양쪽으로 0~100']],
        ['`guitar transpose +2`', ['every region on the track, in semitones', '트랙의 모든 리전, 반음 단위']],
        ['`guitar space 40`', ['the track’s own patch: tape, space (reverb), delay (echo), mix', '트랙의 패치: tape, space(리버브), delay(에코), mix']]) +
      p('The track’s exact name may stand anywhere in the line. A bare unsigned number after a name (`kick 3`) is not read: it needs a sign, a direction word, or `to`.', '트랙의 정확한 이름은 줄 어디에 있어도 됩니다. 이름 뒤에 부호 없는 숫자만 쓰면(`kick 3`) 읽지 않습니다. 부호, 방향을 나타내는 말, 또는 `to`가 필요합니다.') + `</div>` }),

  page(t('who, where, how much', '누구, 어디, 얼마나'), { kind: 'text', cc: 3, txt:
    h('who', '누구') +
    table(null,
      [['what is chosen', '선택한 것'], '`this`  `these`  `it`'],
      [['everything', '전부'], '`all`  `every`  `both`'],
      [['a track', '트랙'], ['its name, or any word of its name', '이름, 또는 이름 속 아무 낱말']],
      [['a family', '계열'], '`drums` `bass` `vocals` `guitars` `keys` `fx` `buses`'],
      [['a destination', '목적지'], '`to reverb`  `into drums`']) +
    p('Many words answer for each other: kick and bd, hat and hihat, reverb and verb, delay and echo. A word that is many by itself (drums, vocals, guitars, keys, buses) means all of them with no question. Two track words in a row are one narrower name: `lead vox` is the track that is both.', '서로 통하는 낱말이 많습니다. kick과 bd, hat과 hihat, reverb와 verb, delay와 echo. 그 자체로 여럿을 뜻하는 낱말(drums, vocals, guitars, keys, buses)은 묻지 않고 전부를 뜻합니다. 트랙 낱말 둘을 연달아 쓰면 더 좁은 이름 하나입니다. `lead vox`는 둘 다에 해당하는 트랙입니다.') +
    h('where', '어디') +
    table(null,
      [['here', '여기'], '`here`  `now`'],
      [['the start, the end', '처음, 끝'], '`the start`  `the end`'],
      [['a bar', '마디'], '`bar 17`  `at 19`'],
      [['a part', '파트'], ['a marker’s name, or `intro` `verse` `pre` `chorus` `bridge` `outro` `break` `drop`', '마커 이름, 또는 `intro` `verse` `pre` `chorus` `bridge` `outro` `break` `drop`']],
      [['which one', '몇 번째'], '`second chorus`  `next chorus`  `chorus 2`'],
      [['a stretch', '구간'], '`from 17 to 24`  `17~24`  `from here`'],
      [['the cycle', '사이클'], '`the cycle`']) +
    p('A bar named as the end is in the stretch: 17 to 24 is eight bars. “to” a marker stops where it begins; “through” a marker takes it in. A stretch with nobody named means every audio track. A part with nothing said about which one is the one the playhead is in, else the next.', '끝으로 말한 마디는 구간에 들어갑니다. 17에서 24까지는 여덟 마디입니다. 마커 “to”는 그 시작에서 멈추고, “through”는 그 파트까지 포함합니다. 누구인지 말하지 않은 구간은 모든 오디오 트랙을 뜻합니다. 몇 번째인지 말하지 않은 파트는 플레이헤드가 있는 것, 없으면 다음 것입니다.') +
    h('how much', '얼마나') +
    table(null,
      [['level', '레벨'], '`3 db`  `-3`  `+1.5`'],
      [['direction', '방향'], '`up` `louder`  `down` `quieter`'],
      [['length', '길이'], '`2 bars`  `2 beats`'],
      [['how often', '횟수'], '`twice`  `3 times`'],
      [['half', '절반'], '`in half`'],
      [['grid', '그리드'], '`1/4` `1/8` `1/16` `1/32`']) +
    h('when a word is not enough', '낱말이 부족할 때') +
    p('When more than one track answers to a word, nothing is done and the line asks, for example “which kick: kick in, kick out, or all”. Answer with the next line: a name or a word that singles one out, a digit (1 is the first listed), or `all`.', '한 낱말에 트랙이 둘 이상 해당하면 아무것도 하지 않고 되묻습니다. 예: “which kick: kick in, kick out, or all”. 다음 줄로 답합니다. 이름이나 하나를 가려내는 낱말, 숫자(1은 첫 번째), 또는 `all`.') }),

  page(t('what it can do', '할 수 있는 일'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['type', '입력'], ['what happens', '일어나는 일']],
      [['go there', '이동'], '`second chorus`  `next chorus`  `go to bar 17`', ['The playhead moves. While the song plays, a marker is reached at the next bar line.', '플레이헤드가 이동합니다. 재생 중이면 마커에는 다음 마디 선에서 넘어갑니다.']],
      [['loop', '루프'], '`loop verse 2`', ['The cycle is set round that part and turned on.', '그 파트에 사이클을 걸고 켭니다.']],
      [['louder, quieter', '크게, 작게'], '`vocals +1`  `all the drums 2db down`  `raise this 3 db`', ['Tracks named: their faders. This, or nobody named: the gain of the chosen regions.', '트랙을 말하면 그 페이더, this라고 하거나 말하지 않으면 선택한 리전의 게인.']],
      [['cut', '자르기'], '`cut at 19`  `cut drums at 19`  `cut this in half`', ['Splits regions at a place, at both ends of a stretch, or in the middle.', '위치에서, 구간의 양 끝에서, 또는 가운데에서 리전을 자릅니다.']],
      [['mute', '뮤트'], '`kick and snare mute`  `mute from here to the end`  `17~24 mute`', ['Tracks alone: the tracks’ mute. With a stretch: it is cut free and the regions inside are muted.', '트랙만 말하면 트랙 뮤트. 구간과 함께면 그 구간을 잘라 안의 리전을 뮤트합니다.']],
      [['solo', '솔로'], '`solo drums`  `unsolo drums`', ['The named tracks’ solo.', '말한 트랙의 솔로.']],
      [['delete', '삭제'], '`delete pre`  `delete this`', ['Deletes regions. With the word track, it deletes the track (see “tracks, time, patch and project”).', '리전을 지웁니다. track이라는 말이 붙으면 트랙을 지웁니다(“트랙, 시간, 패치, 프로젝트” 참고).']],
      [['once more', '한 번 더'], '`pre once more`  `repeat this twice`', ['A part: the song itself repeats that stretch, and everything after moves later. Regions: repeated right after themselves.', '파트: 곡 자체가 그 구간을 반복하고 뒤의 모든 것이 밀립니다. 리전: 바로 뒤에 반복됩니다.']],
      [['copy, move', '복사, 이동'], '`copy this to bar 41`  `move this to bar 33`', ['Needs the place; without one it asks “copy it to where”.', '위치가 필요합니다. 없으면 “copy it to where”라고 묻습니다.']],
      [['fade', '페이드'], '`fade out guitar 2 bars`  `fade in this`', ['The length said; else from the playhead; else one bar.', '말한 길이. 없으면 플레이헤드 기준, 그것도 아니면 한 마디.']],
      [['quantize', '퀀타이즈'], '`quantize this 1/16`', ['A grid said with it becomes the quantize value.', '함께 말한 그리드가 퀀타이즈 값이 됩니다.']],
      [['choose', '선택'], '`select chorus`  `select drums`', ['A part: a marquee over it on every track. Tracks: those tracks.', '파트: 모든 트랙에 걸친 마키. 트랙: 그 트랙들.']],
      [['send', '센드'], '`send guitar to reverb`  `send keys to reverb -6`', ['A send to a bus by name, or to a reverb or delay bus, which is made if there is none. −12 dB unless a level is said.', '이름으로 말한 버스, 또는 리버브나 딜레이 버스로 센드. 없으면 만듭니다. 레벨을 말하지 않으면 −12 dB.']],
      [['put together', '묶기'], '`group all vocals and send to reverb`  `group drums to bus`', ['The tracks go into a stack named after the family; with “to bus”, a new bus they play into.', '트랙들이 계열 이름을 딴 스택으로 들어갑니다. “to bus”라고 하면 새 버스로 나갑니다.']]) +
    note('Not in the command line in this version: a macro wired by words, and a tempo or measure that changes partway along the song (the room has none yet). A line the app cannot read is refused; nothing guesses for it.', '이 버전의 커맨드 라인에 없는 것: 말로 매크로 연결하기, 곡 중간에 바뀌는 템포나 박자(앱에 아직 없음). 앱이 읽지 못한 줄은 거절되며, 대신 짐작해 주는 것은 없습니다.') }),

  page(t('values and their lines', '값과 그 라인'), { kind: 'text', cc: 1, txt:
    p('A value of a track is its volume, its pan, a print (tape, space or reverb, delay), a control of a plug-in by the plug-in’s name and the control’s (`pro-q 3 gain`), or a macro by its name (`macro gain`). Said with a stretch it is drawn as the value’s automation line, in one step of undo. A send’s level is said as `send keys to reverb -6`; its line is put together from the cells (see “reading a line, building one”).', '트랙의 값은 볼륨, 팬, 프린트(tape, space 또는 reverb, delay), 플러그인 이름과 컨트롤 이름으로 부르는 컨트롤(`pro-q 3 gain`), 이름으로 부르는 매크로(`macro gain`)입니다. 구간과 함께 말하면 그 값의 오토메이션 라인으로 그려지고, 실행 취소 한 번으로 되돌아갑니다. 센드 레벨은 `send keys to reverb -6`처럼 말하고, 센드의 라인은 셀로 만듭니다(“줄 읽기, 줄 만들기” 참고).') +
    table([['', ''], ['type', '입력'], ['what happens', '일어나는 일']],
      [['the value itself', '값 자체'], '`kick to -6`  `kick pan l 30`  `guitar space 40`', ['No stretch: the fader, the pan, the print is set. A plug-in’s control or a macro that has a line drawn: the whole line moves.', '구간이 없으면 페이더, 팬, 프린트가 그 값이 됩니다. 플러그인 컨트롤이나 매크로에 라인이 이미 있으면 라인 전체가 움직입니다.']],
      [['for a stretch', '구간 동안'], '`kick -3 from 9 to 16`  `set pro-q 3 gain to -15 db from 9 to 16`', ['Moved for the stretch, and back after it.', '구간 동안만 바뀌고 끝나면 돌아갑니다.']],
      [['from a bar on', '그 마디부터'], '`set hats volume to -20 db after bar 33`', ['From that bar to the end.', '그 마디부터 끝까지.']],
      [['a ramp', '램프'], '`raise kick gradually from 25 to 31 by 6 db`', ['Over the stretch, and it stays there; `and back` returns at its end.', '구간에 걸쳐 바뀌고 그대로 유지됩니다. `and back`이면 끝에서 돌아갑니다.']],
      [['bent', '휘어진 램프'], '`exponentially`  `logarithmically`  `s-curve`', ['Slow then fast; fast then slow; slow at both ends. The line is drawn bent.', '천천히 그리고 빠르게, 빠르게 그리고 천천히, 양 끝에서 천천히. 라인도 휘어져 그려집니다.']],
      [['a sweep', '스윕'], '`ramp macro gain from -15 db to 0 db over 26 to 32`', ['From one value to another, in the unit the control is said in. What the line held inside the stretch gives way.', '한 값에서 다른 값으로, 그 컨트롤의 단위로. 구간 안에 있던 라인은 그 자리를 내줍니다.']],
      [['which ones', '어떤 것들'], '`add a 100 ms fade in to every pad region after bar 31`', ['After a bar: regions that begin there or later; before one: that end there or sooner. Fades in `ms` or `s` too.', 'after는 그 마디나 그 뒤에 시작하는 리전, before는 그 마디나 그 앞에서 끝나는 리전. 페이드는 `ms`, `s`로도.']],
      [['all but', '빼고 전부'], '`mute all except drums`  `lower all except vocals by 2 db`', ['Every track but those.', '그 트랙들만 빼고 전부.']]) +
    note('A line that leaves out how much is asked: “by how much”, then answer with the next line (`6 db`). A unit the value is not said in is refused (`volume is said in db`).', '얼마나를 빼먹은 줄은 “by how much”라고 되묻습니다. 다음 줄로 답합니다(`6 db`). 그 값의 단위가 아니면 거절합니다(`volume is said in db`).') }),
  page(t('regions and notes', '리전과 노트'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['type', '입력'], ['what happens', '일어나는 일']],
      [['earlier, later', '앞으로, 뒤로'], '`move this later by 1 beat`  `nudge these earlier by 100 ms`', ['By bars, beats, `1/16`, ms, ticks or samples, as the nudge keys move them.', '마디, 박, `1/16`, ms, 틱, 샘플 단위로. 넛지 키가 옮기는 그대로.']],
      [['longer, shorter', '길게, 짧게'], '`make this 2 beats shorter`', ['Its end, by so much.', '끝을 그만큼.']],
      [['trim', '트림'], '`trim the end of this to bar 9`  `trim the start of this to bar 7`', ['Its start or its end to a place; without one, to the playhead.', '시작이나 끝을 그 자리로. 자리를 말하지 않으면 플레이헤드로.']],
      [['as the keys do', '키와 같이'], '`join these`  `reverse this`  `strip silence`  `bounce this in place`  `follow the tempo`  `fit to the tempo`  `dequantize`', ['What the key does. A region the key leaves alone (a loop is not reversed) is not counted, and the answer says so.', '키가 하는 그대로. 키가 손대지 않는 리전(루프는 뒤집지 않음)은 세지 않고, 답에 그렇게 나옵니다.']],
      [['names', '이름'], '`rename this to "Verse Take"`  `rename kick to "Kick In"`', ['A name in quotes keeps its capitals. A track when one is named; else the regions.', '따옴표 안의 이름은 대소문자를 그대로 둡니다. 트랙을 말하면 트랙, 아니면 리전.']],
      [['gain', '게인'], '`set the gain of these to -3 db`  `raise their gain by 2 db`', ['The regions’ own gain.', '리전 자체의 게인.']],
      [['groups', '그룹'], '`group these regions`  `ungroup these`', ['As the region keys do.', '리전 키와 같이.']],
      [['which regions', '어떤 리전'], '`the muted regions on snare`  `regions longer than 10 bars`  `the first 2 kick regions`  `regions named "verse take"`', ['With any act: select, delete, mute, fade…', '어떤 동작과도: select, delete, mute, fade…']],
      [['fade curves', '페이드 커브'], '`fade out guitar 2 bars with an s-curve`', ['`straight`, `equal power`, `s-curve`.', '`straight`, `equal power`, `s-curve`.']],
      [['quantize feel', '퀀타이즈 느낌'], '`quantize this 1/16 at 60% strength with 20% swing`', ['Strength and swing, for regions of notes.', '노트 리전의 strength와 swing.']],
      [['notes', '노트'], '`delete the notes above c3 on keys`  `transpose the keys notes below c3 by +12`', ['By their key (c3 is middle c) and how hard they are (`velocity above 100`), on a track, in a stretch, or in what is chosen.', '건반 높이(c3이 가운데 도)와 세기(`velocity above 100`)로 고릅니다. 트랙, 구간, 선택한 것 안에서.']],
      [['velocity, length', '세기, 길이'], '`set the velocity of keys notes above 80 to 100`  `scale the keys velocities to 50%`  `set the note length on keys to 1/16`  `legato the keys notes`', ['Set, moved by so much, scaled, or each note to the next.', '그 값으로, 그만큼, 비율로, 또는 다음 노트까지.']]) }),

  page(t('tracks, time, patch and project', '트랙, 시간, 패치, 프로젝트'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['type', '입력'], ['what happens', '일어나는 일']],
      [['new tracks', '새 트랙'], '`add 3 audio tracks called "Pad"`  `new instrument track`  `new bus called "Drum Bus"`', ['As the new-track keys make them, named as said.', '새 트랙 키가 만드는 그대로, 말한 이름으로.']],
      [['duplicate, delete', '복제, 삭제'], '`duplicate kick`  `duplicate kick with its regions`  `delete the guitar track`  `delete the empty tracks`', ['A track named is made twice; `duplicate this` still repeats regions. Delete takes the track, not only its regions.', '트랙을 말하면 트랙을 복제합니다. `duplicate this`는 여전히 리전 반복. 삭제는 리전만이 아니라 트랙째.']],
      [['order, colour', '순서, 색'], '`move bass above keys`  `move air to the top`  `color hum red`  `paint hum dark blue`  `color hum as read`', ['The colours are the room’s own: blue, purple, green, yellow, red, grey; dark or light.', '색은 방의 팔레트: blue, purple, green, yellow, red, grey. dark, light.']],
      [['stacks, groups', '스택, 그룹'], '`stack kick and snare`  `unstack kick`  `group kick and snare for editing`', ['As the track keys do.', '트랙 키와 같이.']],
      [['input, routing', '입력, 라우팅'], '`arm hum`  `monitor hum`  `route kick and snare to drum bus`', ['Armed when the input opens; the answer says if it did not.', '입력이 열리면 녹음 대기. 안 열리면 답에 그렇게 나옵니다.']],
      [['markers', '마커'], '`add a marker "Bridge 2" at bar 37`  `rename the second chorus marker to "Last Chorus"`  `move the bridge 2 marker to bar 39`  `delete the pre marker`', ['One step back each.', '각각 실행 취소 한 번.']],
      [['the song’s time', '곡의 시간'], '`insert 2 bars at bar 17`  `take out bars 9 to 12`  `raise the tempo by 4`  `set the meter to 3/4`', ['The tempo and the measure are one for the whole song in this version. A new measure clears the steps back, as the measure menu does.', '이 버전에서 템포와 박자는 곡 전체에 하나입니다. 박자를 바꾸면 박자 메뉴처럼 실행 취소 기록이 지워집니다.']],
      [['plug-ins, prints', '플러그인, 프린트'], '`put pro-q 3 on vocals`  `add a delay print to keys in parallel`  `bypass audelay on hum`  `open pro-q 3 on hum`  `remove the tremolo print from keys`', ['Any plug-in the app has, by its name; a print with the word print. At the end of the way, or `in parallel` beside it.', '앱에 있는 플러그인은 이름으로, 프린트는 print라는 말과 함께. 줄 끝에, 또는 `in parallel`로 옆에.']],
      [['hand off', '내보내기'], '`bounce the mix as mp3 320`  `export the chorus stems of kick and snare as wav 24 bit 48k`  `save as "Dress v2"`', ['The hand-off panel is set as said and opened; {{send}} is still pressed by hand.', '내보내기 패널을 말한 대로 맞춰 엽니다. {{send}}는 직접 누릅니다.']]) }),

  page(t('chords from the line', '줄로 코드 넣기'), { kind: 'text', cc: 2, txt:
    p('Type chord names on the command line and they are written into the song as notes: the notes of those chords and no others. Nothing is chosen for you, neither a chord nor a tension nor a rhythm. Each chord is struck once where it begins and held for as long as it stands. Its lowest note is its root, or the note written under it; the hand above has the rest of the chord, laid close to where it was for the chord before.', '커맨드 라인에 코드 이름을 입력하면 곡에 노트로 들어갑니다. 그 코드의 음만, 다른 음 없이 들어갑니다. 코드도 텐션도 리듬도 대신 골라 주지 않습니다. 코드마다 시작하는 자리에서 한 번 치고 그 코드가 이어지는 동안 유지합니다. 가장 낮은 음은 루트, 또는 코드 아래에 적은 음이고, 그 위의 손은 나머지 음을 앞 코드의 자리와 가깝게 잡습니다.') +
    table([['type', '입력'], ['what is written', '들어가는 것']],
      ['`Dm7(9) G7(b9,13) CM7(9) A7(b13)`', ['a bar to each name: four bars', '이름마다 한 마디: 네 마디']],
      ['`| Dm7 G7 | CM7 - A7 - |`', ['with the bars drawn, the names of a bar share it: two halve it, four are a beat each', '마디를 그으면 그 마디의 이름들이 마디를 나눕니다. 둘이면 반씩, 넷이면 한 박씩']],
      ['`-`', ['a dash holds the chord before it: a beat more inside a bar, a bar more without bars drawn', '줄표는 앞 코드를 유지합니다. 마디 안에서는 한 박 더, 마디를 긋지 않았으면 한 마디 더']],
      ['`| C F G |`', ['three names in a bar of four: a beat each, the last to the end of the bar', '4박 마디에 이름 셋: 한 박씩, 마지막은 마디 끝까지']],
      ['`C C`', ['the same name twice is struck twice', '같은 이름을 두 번 쓰면 두 번 칩니다']]) +
    h('how a name is read', '이름을 읽는 방식') +
    list(
      ['As it is written over a staff, capitals and all. The root is a capital letter, with `#` or `b`. A capital `M` is major and a small `m` is minor: `CM7`, `Cm7`. `maj`, `min`, `-`, `dim`, `aug`, `+`, `sus4`, `sus2` are read too.', '악보 위에 적는 그대로, 대소문자까지 읽습니다. 루트는 대문자이고 `#`이나 `b`가 붙습니다. 대문자 `M`은 메이저, 소문자 `m`은 마이너입니다. `CM7`, `Cm7`. `maj`, `min`, `-`, `dim`, `aug`, `+`, `sus4`, `sus2`도 읽습니다.'],
      ['Tensions stand after the chord or in brackets, with commas: `C7b9`, `C7(b9,13)`, `CM7(9,#11)`, `Cm7(11)`. A tension in brackets adds that note only: `C7(13)` has no ninth, `C13` has.', '텐션은 코드 뒤에, 또는 괄호 안에 쉼표로 적습니다. `C7b9`, `C7(b9,13)`, `CM7(9,#11)`, `Cm7(11)`. 괄호 안의 텐션은 그 음만 더합니다. `C7(13)`에는 9음이 없고 `C13`에는 있습니다.'],
      ['`add9`, `omit3`, `omit5`, `alt`, `6/9`, and a note under the chord: `C/E`, `G7(b9)/B`.', '`add9`, `omit3`, `omit5`, `alt`, `6/9`, 그리고 코드 아래의 음도 됩니다. `C/E`, `G7(b9)/B`.'],
      ['An eleventh over a major third (`C11`) is played without the third. Where the fifth could only lie a half step beside a tension (`C7(#9,b13)`), the hand leaves the fifth out. More than five notes for the upper hand: the fifth goes first, then the root.', '메이저 3도 위의 11(`C11`)은 3음 없이 칩니다. 5음이 텐션과 반음으로 나란히 놓일 수밖에 없는 코드(`C7(#9,b13)`)에서는 5음을 뺍니다. 윗손의 음이 다섯을 넘으면 5음, 그다음 루트 순으로 뺍니다.'],
      ['A name that cannot be read is named in the answer, and nothing is written.', '읽을 수 없는 이름이 있으면 답에 그 이름을 적고 아무것도 쓰지 않습니다.']) +
    h('where it goes', '어디에 들어가나') +
    list(
      ['From the bar where a marquee begins; else where the cycle begins, if it is on; else where the chosen region begins; else the bar the playhead is in. As many bars as were typed.', '마키가 시작하는 마디부터. 없으면 켜져 있는 사이클의 시작, 그다음은 선택한 리전의 시작, 아무것도 없으면 플레이헤드가 있는 마디부터. 입력한 만큼의 마디입니다.'],
      ['On a track of notes the marquee lies on, where what stood in those bars makes way; else the leading track, if it is a track of notes with those bars free; else a track called {{chords}}, made the first time. A kit, and a sound that plays one key at a time, are never given chords.', '마키가 놓인 노트 트랙(그 마디에 있던 것은 자리를 내줍니다). 아니면 리드 트랙이 노트 트랙이고 그 마디가 비어 있을 때 그 트랙, 그것도 아니면 처음에 만들어지는 {{chords}} 트랙. 드럼 키트와 한 번에 한 음만 내는 사운드에는 넣지 않습니다.'],
      ['The region is named for its chords, the notes page opens on it, and every note is as hard as the notes page draws one. One line is one step of undo.', '리전 이름은 그 코드들이고, 노트 페이지가 그 리전으로 열리며, 모든 노트의 세기는 노트 페이지에서 그리는 노트와 같습니다. 한 줄은 실행 취소 한 번입니다.']) +
    note('One chord name alone can be a word the list over the line knows (G begins guitar): the list then takes return. Type it with a bar line, `G |`, or put the list away with [[esc]] first.', '코드 이름 하나만 쓰면 줄 위의 목록이 아는 낱말일 수 있습니다(G는 guitar의 첫 글자). 그러면 return을 목록이 가져갑니다. 마디선과 함께 `G |`라고 쓰거나 먼저 [[esc]]로 목록을 닫습니다.') }),

  page(t('asking by the sound', '소리로 요청하기'), { kind: 'wide', cc: 3, txt:
    legend(
      [1, 'the request, as typed: two tracks and how they should sound', '입력한 요청: 트랙 둘과 원하는 소리'],
      [2, '{{heard}} the lows of both tracks from 30 to 400 hz, each in its track’s colour; where they meet is shaded. At the right, the bars listened to', '{{heard}} 두 트랙의 저음, 30~400 hz. 각자 트랙 색으로 그리고 겹치는 곳은 칠해 둡니다. 오른쪽 위는 들은 마디'],
      [3, 'the same in numbers: where they meet, each one’s low ({{longer}}: it sounds for more of the time), and on how many of the kick’s hits the bass is about as loud there', '같은 것을 숫자로: 겹치는 대역, 각자의 저음({{longer}}는 소리 나는 시간이 더 길다는 뜻), 그리고 킥이 칠 때 그 대역에서 베이스가 킥만큼 큰 비율'],
      [4, '{{hear}} {{as it is}}, {{A}}, {{B}}, {{C}}: one at a time, {{levels matched}}', '{{hear}} {{as it is}}, {{A}}, {{B}}, {{C}}: 한 번에 하나씩, {{levels matched}}'],
      [5, 'a way’s cells, written as the command line writes things: what it puts on, on which track, keyed by what, and every amount', '방법의 셀. 커맨드 라인이 적는 방식 그대로: 무엇을, 어느 트랙에, 무엇을 키로, 얼마나'],
      [6, '{{hear}} puts the way on; it reads {{hearing}} while it is on', '{{hear}}는 그 방법을 걸어 둡니다. 걸려 있는 동안은 {{hearing}}'],
      [7, 'what the way was heard to do, measured', '그 방법이 실제로 한 일, 측정값'],
      [8, 'an amount typed over: A’s −3 db made −1.5', '덮어 입력한 값: A의 −3 db를 −1.5로'],
      [9, '{{use this}} keeps it', '{{use this}}는 그 방법을 남깁니다']) +
    h('asking', '요청하기') +
    p('Name two tracks and how they should sound: `kick and bass sound apart`. `apart`, `separate` and `separated` (each with `sound` before it or not), `unmask` and `untangle` all do, and the names may come first or last (`untangle the bass and the kick`). Join the two with `and` or a comma. Any other number of tracks is asked again: “which two tracks”.', '트랙 둘과 원하는 소리를 말합니다: `kick and bass sound apart`. `apart`, `separate`, `separated`(앞에 `sound`가 있어도 없어도), `unmask`, `untangle` 모두 됩니다. 이름은 앞에 와도 뒤에 와도 됩니다(`untangle the bass and the kick`). 두 이름은 `and`나 쉼표로 잇습니다. 트랙이 둘이 아니면 “which two tracks”라고 되묻습니다.') +
    h('what is listened to', '무엇을 듣나') +
    p('The answer says “listening to kick, bass”, and the prompt page shows what comes of it. Both tracks are heard over one stretch: the cycle, if it is on; else the part the playhead is in, if both play there; else the first part where both play; else bars 1 to 16. It is done offline: a playing song stops, nothing is heard, and the tracks are left as they were. Meanwhile the page says {{listening}}, then {{hearing A}}, B and C as each way is tried and measured.', '답에 “listening to kick, bass”라고 나오고, 결과는 prompt 페이지에 나옵니다. 두 트랙을 한 구간에서 듣습니다. 사이클이 켜져 있으면 사이클, 아니면 플레이헤드가 있는 파트(둘 다 연주하는 곳일 때), 그다음은 둘 다 연주하는 첫 파트, 그것도 없으면 1~16마디. 오프라인으로 하므로 재생 중이던 곡은 멈추고, 아무 소리도 나지 않으며, 트랙은 그대로 남습니다. 그동안 페이지에는 {{listening}}, 이어서 방법마다 걸어 보고 측정하는 동안 {{hearing A}}, B, C가 나옵니다.') +
    p('The one that hits more (here the kick) keeps its place; the other gives way. The ways are made from what was heard, so their numbers differ from song to song.', '더 많이 치는 쪽(여기서는 킥)이 자리를 지키고, 다른 쪽이 비켜 줍니다. 방법은 들은 것으로 만들기 때문에 숫자는 곡마다 다릅니다.'),
    art: fig('ways', { w: 250, calls: [[1, 'prompt:field', 't', 0, { fx: .1 }], [2, [70, 150], 'l'], [3, [14, 268], 'l'], [4, 'ways-hear#2', 't'], [5, 'ways-edit#10', 'r', 0, { fx: 1 }], [6, 'ways-hear#5', 'b'], [7, [505, 342], 'b'], [8, 'ways-edit#2', 'b', 14.8, { fy: 1.05 }], [9, 'ways-use#1', 'b']] }) }),

  page(t('three ways, one used', '세 가지 방법, 하나만 사용'), { kind: 'text', cc: 2, txt:
    p('Each way does it differently; none is another at a different strength, since the strength is a cell. They are named for the tracks: the one that gives way is the bass here.', '방법마다 하는 방식이 다릅니다. 세기만 다른 같은 방법은 없습니다. 세기는 셀이기 때문입니다. 이름은 트랙을 따릅니다. 여기서 비켜 주는 쪽은 베이스입니다.') +
    table([['way', '방법'], ['what it puts on', '거는 것']],
      ['{{carve the lows}}', ['A bell of the Mac’s own eq ({{mac eq}}) on the bass, −3 db at the kick’s low, q 1.4. When the two lows lie a third of an octave or more apart, a second on the kick, −2 db at the bass’s low. Each keeps a low of its own.', 'Mac 자체 이큐({{mac eq}})의 벨을 베이스에. 킥의 저음 자리에서 −3 db, q 1.4. 두 저음이 3분의 1옥타브 이상 떨어져 있으면 킥에도 하나, 베이스의 저음 자리에서 −2 db. 각자 자기 저음을 갖습니다.']],
      ['{{duck the bass}}', ['A {{comp}} on the bass’s wall, its {{key}} fed by a {{side}} playing the kick: ratio 4:1, −4 db, attack 1 ms, release 80 ms. The bass steps aside for as long as the kick sounds.', '베이스 패치에 {{comp}}. 그 {{key}}에는 킥을 내는 {{side}}를 연결. ratio 4:1, −4 db, attack 1 ms, release 80 ms. 킥이 울리는 동안 베이스가 비켜섭니다.']],
      ['{{only where they meet}}', ['A {{carve}} on the bass’s wall, keyed by the kick the same way, between the two frequencies where they meet: up to −4 db, attack 5 ms, release 80 ms. The bass gives way only there, and only on the kick’s hits.', '베이스 패치에 {{carve}}. 같은 방식으로 킥을 키로 하고, 둘이 겹치는 두 주파수 사이에서 최대 −4 db, attack 5 ms, release 80 ms. 베이스는 그 대역에서만, 킥이 칠 때만 비켜 줍니다.']]) +
    draw(120, 39, waysDrawn(), ['the bass along the song (across) and from low to high (up); the dots are the kick’s hits. Where the bass gives way is drawn pale', '베이스를 곡의 흐름(가로)과 낮은 음에서 높은 음(세로)으로 그렸습니다. 점은 킥이 치는 곳, 베이스가 비켜 주는 곳은 옅게 그렸습니다']) +
    h('every amount is a cell', '모든 값은 셀') +
    p('Press an amount, type over it and press [[↩]] ([[esc]] leaves it as it was): the bass’s −3 db made −1.5. The way is heard again and measured again, and if it was on, it goes back on as it now reads.', '값을 누르고 덮어 입력한 뒤 [[↩]]를 누릅니다([[esc]]는 그대로 둡니다). 베이스의 −3 db를 −1.5로. 그 방법을 다시 듣고 다시 측정하며, 걸려 있던 방법이면 바뀐 값으로 다시 걸립니다.') +
    p('The eq’s name ({{mac eq}}) opens the list of the eqs on this Mac. One whose controls the app does not know yet says {{not known yet}}, and the Mac’s eq stays; in this version that is every eq but the Mac’s own.', '이큐 이름({{mac eq}})을 누르면 이 Mac에 있는 이큐 목록이 열립니다. 앱이 아직 조절값을 모르는 이큐에는 {{not known yet}}이라고 나오고, 골라도 Mac의 이큐가 그대로 남습니다. 이 버전에서는 Mac 자체 이큐 말고는 모두 그렇습니다.') +
    h('measured, not promised', '약속이 아니라 측정값') +
    p('“heard: −4.1 db on the hits, where they meet” is what the way was heard to do: how much quieter the bass is on the kick’s hits, between the two frequencies where they meet. A duck or a carve is turned until what is heard is what its cell asks, within half a db, in four hearings at most; an eq is measured as it is set.', '“heard: −4.1 db on the hits, where they meet”는 그 방법이 실제로 한 일입니다. 킥이 칠 때, 둘이 겹치는 두 주파수 사이에서 베이스가 얼마나 작아졌는지입니다. 덕킹과 카브는 들리는 값이 셀이 말하는 값과 0.5 db 안으로 맞을 때까지(최대 네 번 들어 보며) 조정하고, 이큐는 설정한 그대로 측정합니다.') +
    h('levels matched', 'levels matched') +
    p('While a way is heard, the stereo out is moved by what that way took from the whole mix, so {{as it is}}, A, B and C are compared at one loudness. It is never kept: a way used leaves the stereo out as it was.', '방법을 듣는 동안 스테레오 아웃이 그 방법이 믹스 전체에서 덜어 낸 만큼 움직여서, {{as it is}}, A, B, C를 같은 크기로 비교합니다. 이 값은 남지 않습니다. 사용한 방법은 스테레오 아웃을 원래대로 둡니다.') +
    h('hear, use this', 'hear, use this') +
    list(
      ['{{hear}} puts a way on in place of whatever was on; play the song to hear it. {{as it is}} takes it off.', '{{hear}}는 걸려 있던 것 대신 그 방법을 겁니다. 곡을 재생해서 듣습니다. {{as it is}}는 걸어 둔 것을 뺍니다.'],
      ['{{use this}} keeps it, as one step of undo: [[⌘Z]] takes it all off again and the three are offered again, [[⇧⌘Z]] brings it back. Only one way is used, never two together: the page says {{A used — the others step back}}.', '{{use this}}는 그 방법을 남깁니다. 실행 취소 한 번 단위입니다. [[⌘Z]]로 전부 다시 빼면 세 방법이 다시 나오고, [[⇧⌘Z]]로 되살립니다. 쓰는 방법은 하나뿐이고 둘을 함께 쓸 수는 없습니다. 페이지에는 {{A used — the others step back}}이라고 나옵니다.'],
      ['A new line said on the command line lets the request go: a way heard and not used is taken off.', '커맨드 라인에 새 줄을 입력하면 요청이 끝납니다. 듣기만 하고 쓰지 않은 방법은 빠집니다.']) +
    note('This version knows one request by the sound: two tracks apart.', '이 버전이 아는 소리 요청은 하나, 두 트랙 떼어 놓기뿐입니다.') }),
])
