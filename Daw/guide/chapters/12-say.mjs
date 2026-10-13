import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

// one clause of a line, drawn as cells: [word, kind]
const clause = (x, y, cells) => { let s = '', cx = x; for (const [w, kind, wd] of cells) { const ww = wd || Math.max(12, w.length * 1.75 + 5); s += D.cell(cx, y, ww, 8, w, w, kind === 'do' ? 'on' : kind === 'then' ? 'dash' : '') + D.txt(cx + ww / 2, y + 12.5, ...({ who: ['who', '누구'], where: ['where', '어디'], much: ['how much', '얼마나'], do: ['do', '무엇을'], then: ['then', '그리고'] })[kind], 'xs m'); cx += ww + 1.6 } return s }

export default () => chapter('say', t('the command line', '커맨드 라인'),
  t('Type what you want done, in English or in Korean, at the foot of the window. Everything one line does is one step of undo.', '창 맨 아래에 하고 싶은 일을 영어나 한국어로 입력합니다. 한 줄이 한 모든 일은 실행 취소 한 번으로 되돌아갑니다.'), [

  page(t('saying it', '말로 하기'), { kind: 'split', tw: 112, txt:
    table(null,
      ['[[/]]', ['the keys go to the command line; whatever is in it is selected, so typing replaces it', '키 입력이 커맨드 라인으로 갑니다. 들어 있던 글자가 선택되어 있어서 입력하면 바뀝니다']],
      ['[[↩]]', ['run the line', '줄 실행']],
      [['a letter', '글자 하나'], ['a list opens of what begins with it: tracks, what is on the track just named, markers, acts. [[↑]] [[↓]] choose, [[tab]] or [[↩]] takes, [[esc]] closes it', '그 글자로 시작하는 것의 목록이 열립니다: 트랙, 방금 말한 트랙에 있는 것, 마커, 동작. [[↑]] [[↓]]로 고르고 [[tab]]이나 [[↩]]로 넣고 [[esc]]로 닫습니다']],
      ['[[↑]] [[↓]]', ['lines said before; the last 60 are kept while the app is open', '전에 입력한 줄. 앱이 열려 있는 동안 최근 60줄을 기억합니다']],
      ['[[esc]]', ['leave', '나가기']]) +
    p('The answer appears right beside what you typed. One change is shown as before and after: “kick −6.0 to −9.0 db”. Anything else in a few words: “cut at 19.1.1”, “3 tracks −2 db”. While nothing else has been done since, an {{undo}} key stands beside the answer; it, or [[⌘Z]], takes the whole line back.', '답은 입력한 글자 바로 옆에 나옵니다. 값 하나가 바뀌면 전과 후로 보여 줍니다. “kick −6.0 to −9.0 db”. 그 밖에는 몇 마디로. “cut at 19.1.1”, “3 tracks −2 db”. 그 뒤로 다른 일을 하지 않았다면 답 옆에 {{undo}} 키가 서 있습니다. 그것이나 [[⌘Z]]로 줄 전체를 되돌립니다.') +
    h('how a line is read', '줄을 읽는 방식') +
    list(
      ['A line is one clause, or several joined by `then`. Each clause says, in any order: who, where, what to do, how much.', '한 줄은 절 하나, 또는 `then`으로 이은 여러 절입니다. 절마다 순서에 상관없이 누구, 어디, 무엇을, 얼마나를 말합니다.'],
      ['`and` (or a comma) joins names; it does not start a new action. Say `drums 2db down then solo bass`, not “and solo bass”.', '`and`(또는 쉼표)는 이름을 잇는 말이고 새 동작을 시작하지 않습니다. “and solo bass”가 아니라 `drums 2db down then solo bass`라고 합니다.'],
      ['In Korean, particles stick to the word before them (`킥을`, `코러스로`, `17부터 24까지`), and the endings 고 and 서 start the next clause: `드럼 전부 2db 내리고 버스로 묶어`.', '한국어에서는 조사가 앞말에 붙고(`킥을`, `코러스로`, `17부터 24까지`), 어미 고, 서가 다음 절을 시작합니다. `드럼 전부 2db 내리고 버스로 묶어`.'],
      ['A clause that names nobody takes who the clause before named.', '누구인지 말하지 않은 절은 앞 절에서 말한 대상을 이어받습니다.'],
      ['One word it does not know and the whole line is refused: “couldn’t read that”. Nothing is changed.', '모르는 낱말이 하나라도 있으면 줄 전체를 거절합니다. “couldn’t read that”. 아무것도 바뀌지 않습니다.']) +
    note('Both languages are read whichever language the app is set to. No line leaves the Mac: the command line is read by the app itself.', '앱의 언어 설정과 상관없이 두 언어를 모두 읽습니다. 입력한 줄은 Mac 밖으로 나가지 않습니다. 커맨드 라인은 앱이 직접 읽습니다.'),
    art: fig('say-1', { w: 140, cap: ['one change: the level before and after', '값 하나의 변화: 전과 후의 레벨'] }) + fig('say-2', { w: 140, cap: ['two clauses joined by then, and the undo key', 'then으로 이은 두 절과 undo 키'] }) + fig('say-3', { w: 140, cap: ['a line in Korean: choose the chorus', '한국어 한 줄: 코러스 선택'] }) +
      draw(140, 50,
        D.txt(0, 4, 'two clauses', '절 두 개', 's') +
        clause(0, 8, [['drums', 'who'], ['2db down', 'much'], ['then', 'then'], ['solo', 'do'], ['bass', 'who']]) +
        clause(0, 30, [['드럼 전부', 'who', 22], ['2db 내리', 'much', 22], ['고', 'then', 9], ['버스로', 'who', 18], ['묶어', 'do', 14]])) }),

  page(t('plain lines', '간단한 줄'), { kind: 'split', tw: 128, txt:
    table([['type', '입력'], ['in Korean', '한국어로'], ['does', '하는 일']],
      ['`play`', '`재생`', ['plays', '재생']],
      ['`stop`', '`정지` `멈춰`', ['stops', '정지']],
      ['`record`', '`녹음`', ['starts a take', '녹음 시작']],
      ['`tempo 96`', '`템포 96`', ['the tempo, whole numbers from 60 to 180 here', '템포. 여기서는 60~180의 정수']],
      ['`17`  `bar 17`  `17.3`', '`마디 17`', ['the playhead to bar 17 (beat 3)', '플레이헤드를 17마디로(3박)']],
      ['`undo`  `redo`', '`되돌려`  `다시 실행`', ['one step back, forward', '한 단계 뒤로, 앞으로']],
      ['`save`', '`저장`', ['saves now', '지금 저장']],
      ['`click on`  `click off`', '`클릭 켜`  `클릭 꺼`', ['the click', '클릭']],
      ['`cycle on`  `cycle off`', '`사이클 켜`  `사이클 꺼`', ['the cycle', '사이클']],
      ['`new track`', '`트랙 추가`', ['a new audio track', '새 오디오 트랙']],
      ['`new bus`', '`버스 추가`', ['a new bus', '새 버스']],
      ['`export`  `hand off`', '`내보내기`', ['opens the hand-off panel', '내보내기 패널 열기']],
      ['`mixer`  `patch`', '`믹서`  `패치`', ['opens that page', '그 페이지 열기']]) +
    note('A bare number is a bar. A bare signed number (`-3`, `+2`) changes the gain of the chosen regions by that many dB.', '숫자만 쓰면 마디입니다. 부호가 붙은 숫자(`-3`, `+2`)는 선택한 리전의 게인을 그만큼 dB 바꿉니다.'),
    art: `<div style="width:128mm">` + h('a track named outright, then one thing', '트랙 이름을 그대로 쓰고 한 가지') +
      table([['type', '입력'], ['in Korean', '한국어로'], ['does', '하는 일']],
        ['`kick -3`', '`킥 -3`', ['the fader by that much', '페이더를 그만큼']],
        ['`kick 2 db down`', '`킥 2db 내려`', ['the fader down, up', '페이더 내리기, 올리기']],
        ['`kick to -6`', '', ['the fader to that level', '페이더를 그 레벨로']],
        ['`kick mute`  `kick solo`', '`킥 뮤트`  `킥 솔로`', ['mute, solo; `unmute`, `unsolo` undo them', '뮤트, 솔로. `언뮤트`, `솔로 해제`로 풉니다']],
        ['`kick pan l 30`  `kick pan c`', '`킥 팬 왼쪽 30`', ['pan, 0 to 100 each way', '팬, 양쪽으로 0~100']],
        ['`guitar transpose +2`', '`기타 피치 -1`', ['every region on the track, in semitones', '트랙의 모든 리전, 반음 단위']],
        ['`guitar space 40`', '`기타 리버브 40`', ['the track’s own patch: tape, space (reverb), delay (echo), mix', '트랙의 패치: tape, space(리버브), delay(에코), mix']]) +
      p('The track’s exact name may stand anywhere in the line, with a particle after it in Korean (`킥을 -3`). A bare unsigned number after a name (`kick 3`) is not read: it needs a sign, a direction word, or `to`.', '트랙의 정확한 이름은 줄 어디에 있어도 되고, 한국어에서는 조사가 붙어도 됩니다(`킥을 -3`). 이름 뒤에 부호 없는 숫자만 쓰면(`kick 3`) 읽지 않습니다. 부호, 방향을 나타내는 말, 또는 `to`가 필요합니다.') + `</div>` }),

  page(t('who, where, how much', '누구, 어디, 얼마나'), { kind: 'text', cc: 3, txt:
    h('who', '누구') +
    table(null,
      [['what is chosen', '선택한 것'], '`this`  `these`  `it`', '`이거`  `선택한 거`'],
      [['everything', '전부'], '`all`  `every`  `both`', '`전부`  `모두`  `다`'],
      [['a track', '트랙'], ['its name, or any word of its name', '이름, 또는 이름 속 아무 낱말'], ['the same', '같음']],
      [['a family', '계열'], '`drums` `bass` `vocals` `guitars` `keys` `fx` `buses`', '`드럼` `베이스` `보컬` `기타` `건반` `효과음` `버스`'],
      [['a destination', '목적지'], '`to reverb`  `into drums`', '`리버브로`  `드럼에`']) +
    p('Many words answer for each other: kick and 킥, hat and 하이햇, reverb and 리버브, delay and echo and 에코. A word that is many by itself (drums, vocals, guitars, keys, buses) means all of them with no question. Two track words in a row are one narrower name: `lead vox` is the track that is both.', '서로 통하는 낱말이 많습니다. kick과 킥, hat과 하이햇, reverb와 리버브, delay와 echo와 에코. 그 자체로 여럿을 뜻하는 낱말(drums, vocals, guitars, keys, buses)은 묻지 않고 전부를 뜻합니다. 트랙 낱말 둘을 연달아 쓰면 더 좁은 이름 하나입니다. `lead vox`는 둘 다에 해당하는 트랙입니다.') +
    h('where', '어디') +
    table(null,
      [['here', '여기'], '`here`  `now`', '`여기`  `지금`'],
      [['the start, the end', '처음, 끝'], '`the start`  `the end`', '`처음`  `끝`'],
      [['a bar', '마디'], '`bar 17`  `at 19`', '`17마디로`  `19에서`'],
      [['a part', '파트'], ['a marker’s name, or `intro` `verse` `pre` `chorus` `bridge` `outro` `break` `drop`', '마커 이름, 또는 `intro` `verse` `pre` `chorus` `bridge` `outro` `break` `drop`'], '`인트로` `벌스` `프리` `코러스` `후렴` `브리지` `아웃트로` `간주`'],
      [['which one', '몇 번째'], '`second chorus`  `next chorus`  `chorus 2`', '`두 번째 코러스`  `다음 코러스`  `2절 코러스`'],
      [['a stretch', '구간'], '`from 17 to 24`  `17~24`  `from here`', '`17부터 24까지`  `여기부터 끝까지`'],
      [['the cycle', '사이클'], '`the cycle`', '`사이클`']) +
    p('A bar named as the end is in the stretch: 17 to 24 is eight bars. “to” a marker stops where it begins; “through” a marker takes it in. A stretch with nobody named means every audio track. A part with nothing said about which one is the one the playhead is in, else the next.', '끝으로 말한 마디는 구간에 들어갑니다. 17에서 24까지는 여덟 마디입니다. 마커 “to”는 그 시작에서 멈추고, “through”는 그 파트까지 포함합니다. 누구인지 말하지 않은 구간은 모든 오디오 트랙을 뜻합니다. 몇 번째인지 말하지 않은 파트는 플레이헤드가 있는 것, 없으면 다음 것입니다.') +
    h('how much', '얼마나') +
    table(null,
      [['level', '레벨'], '`3 db`  `-3`  `+1.5`', '`3db`  `3데시벨`'],
      [['direction', '방향'], '`up` `louder`  `down` `quieter`', '`올려` `키워`  `내려` `줄여`'],
      [['length', '길이'], '`2 bars`  `2 beats`', '`2마디`  `2박`'],
      [['how often', '횟수'], '`twice`  `3 times`', '`두 번`  `3번`'],
      [['half', '절반'], '`in half`', '`반으로`'],
      [['grid', '그리드'], '`1/4` `1/8` `1/16` `1/32`', ['the same', '같음']]) +
    h('when a word is not enough', '낱말이 부족할 때') +
    p('When more than one track answers to a word, nothing is done and the line asks, for example “which 킥: kick in, kick out, or all”. Answer with the next line: a name or a word that singles one out, a digit (1 is the first listed), or `all`.', '한 낱말에 트랙이 둘 이상 해당하면 아무것도 하지 않고 되묻습니다. 예: “which 킥: kick in, kick out, or all”. 다음 줄로 답합니다. 이름이나 하나를 가려내는 낱말, 숫자(1은 첫 번째), 또는 `전부`.') }),

  page(t('what it can do', '할 수 있는 일'), { kind: 'text', cc: 1, txt:
    table([['', ''], ['in English', '영어로'], ['in Korean', '한국어로'], ['what happens', '일어나는 일']],
      [['go there', '이동'], '`second chorus`  `go to bar 17`', '`2절 코러스로`  `다음 코러스`', ['The playhead moves. While the song plays, a marker is reached at the next bar line.', '플레이헤드가 이동합니다. 재생 중이면 마커에는 다음 마디 선에서 넘어갑니다.']],
      [['loop', '루프'], '`loop verse 2`', '', ['The cycle is set round that part and turned on.', '그 파트에 사이클을 걸고 켭니다.']],
      [['louder, quieter', '크게, 작게'], '`vocals +1`  `raise this 3 db`', '`보컬 전부 2db 내려`  `이거 3db 올려`', ['Tracks named: their faders. This, or nobody named: the gain of the chosen regions.', '트랙을 말하면 그 페이더, 이거라고 하거나 말하지 않으면 선택한 리전의 게인.']],
      [['cut', '자르기'], '`cut at 19`  `cut this in half`', '`드럼 19에서 잘라`  `이거 반으로 잘라`', ['Splits regions at a place, at both ends of a stretch, or in the middle.', '위치에서, 구간의 양 끝에서, 또는 가운데에서 리전을 자릅니다.']],
      [['mute', '뮤트'], '`kick and snare mute`  `mute from here to the end`', '`리드 보컬 뮤트`  `17~24 뮤트`', ['Tracks alone: the tracks’ mute. With a stretch: it is cut free and the regions inside are muted.', '트랙만 말하면 트랙 뮤트. 구간과 함께면 그 구간을 잘라 안의 리전을 뮤트합니다.']],
      [['solo', '솔로'], '`solo drums`', '`드럼 솔로`  `드럼 솔로 해제`', ['The named tracks’ solo.', '말한 트랙의 솔로.']],
      [['delete', '삭제'], '`delete pre`  `delete this`', '`pre 삭제`  `이거 지워`', ['Deletes regions, never a track.', '리전을 지웁니다. 트랙은 지우지 않습니다.']],
      [['once more', '한 번 더'], '`pre once more`  `repeat this twice`', '`pre 한 번 더`  `이거 2번 반복`', ['A part: the song itself repeats that stretch, and everything after moves later. Regions: repeated right after themselves.', '파트: 곡 자체가 그 구간을 반복하고 뒤의 모든 것이 밀립니다. 리전: 바로 뒤에 반복됩니다.']],
      [['copy, move', '복사, 이동'], '`copy this to bar 41`  `move this to bar 33`', '`이거 41마디에 복사`  `이거 33마디로 옮겨`', ['Needs the place; without one it asks “copy it to where”.', '위치가 필요합니다. 없으면 “copy it to where”라고 묻습니다.']],
      [['fade', '페이드'], '`fade out guitar 2 bars`  `fade in this`', '`기타 2마디 페이드 아웃`  `이거 페이드 인`', ['The length said; else from the playhead; else one bar.', '말한 길이. 없으면 플레이헤드 기준, 그것도 아니면 한 마디.']],
      [['quantize', '퀀타이즈'], '`quantize this 1/16`', '`이거 1/16 퀀타이즈`', ['A grid said with it becomes the quantize value.', '함께 말한 그리드가 퀀타이즈 값이 됩니다.']],
      [['choose', '선택'], '`select chorus`  `select drums`', '`코러스 선택`  `드럼 선택`', ['A part: a marquee over it on every track. Tracks: those tracks.', '파트: 모든 트랙에 걸친 마키. 트랙: 그 트랙들.']],
      [['send', '센드'], '`send guitar to reverb`  `send keys to reverb -6`', '`기타를 리버브로 보내`', ['A send to a bus by name, or to a reverb or delay bus, which is made if there is none. −12 dB unless a level is said.', '이름으로 말한 버스, 또는 리버브나 딜레이 버스로 센드. 없으면 만듭니다. 레벨을 말하지 않으면 −12 dB.']],
      [['put together', '묶기'], '`group all vocals and send to reverb`  `group drums to bus`', '`보컬 전부 묶어서 리버브로 보내`  `드럼을 버스로 묶어`', ['The tracks go into a stack named after the family; with “to bus”, a new bus they play into.', '트랙들이 계열 이름을 딴 스택으로 들어갑니다. “버스로”라고 하면 새 버스로 나갑니다.']]) +
    note('Not in the command line in this version: plug-in controls, automation, markers, deleting or renaming tracks, the measure, and tempo other than whole numbers from 60 to 180. A line the app cannot read is refused; nothing guesses for it.', '이 버전의 커맨드 라인에 없는 것: 플러그인 컨트롤, 오토메이션, 마커, 트랙 삭제와 이름 바꾸기, 박자, 60~180 정수 이외의 템포. 앱이 읽지 못한 줄은 거절되며, 대신 짐작해 주는 것은 없습니다.') }),
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
])
