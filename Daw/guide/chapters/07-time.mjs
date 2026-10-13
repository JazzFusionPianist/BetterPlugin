import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

// a row of parts for the drawings: [name, bars, class]
const row = (y, parts, x0 = 0, u = 2.6) => { let x = x0, s = ''; for (const [name, bars, cls = ''] of parts) { const w = bars * u; s += D.cell(x, y, w, 8, name, name, cls); x += w } return s }

export default () => chapter('time', t('the song’s time', '곡의 시간'),
  t('Markers divide the song into parts. A stretch of time can be cut out of every track at once, repeated, or made room for. Then tempo, measure, and what undo takes back.', '마커는 곡을 파트로 나눕니다. 시간 구간을 모든 트랙에서 한꺼번에 잘라내거나, 반복하거나, 빈 구간을 만들 수 있습니다. 이어서 템포, 박자, 그리고 실행 취소가 되돌리는 것.'), [

  page(t('markers and parts', '마커와 파트'), { kind: 'split', tw: 118, txt:
    p('A marker begins on a whole bar; its part runs to the next marker, the last one to the end of the song. The part that is playing is the filled cell of the marker band.', '마커는 마디 시작에 놓이고, 그 파트는 다음 마커까지, 마지막 파트는 곡 끝까지 이어집니다. 마커 띠에서 채워진 칸이 지금 재생 중인 파트입니다.') +
    table(null,
      ['[[⌥\']]', ['a marker on the bar nearest the playhead; its name box opens', '플레이헤드에서 가장 가까운 마디에 마커. 이름 칸이 열립니다']],
      ['[[⌥⇧\']]', ['a marker where what is chosen begins, named after it', '선택한 것이 시작하는 곳에 마커. 그 이름을 따릅니다']],
      ['[[⇧\']]', ['rename the marker that was clicked, else the one the playhead is in', '클릭했던 마커, 없으면 플레이헤드가 있는 파트의 마커 이름 바꾸기']],
      ['[[⌥.]] [[⌥,]]', ['the playhead to the next, the last marker', '플레이헤드를 다음, 이전 마커로']],
      ['[[⌃⌥C]]', ['the cycle over that marker’s part, turned on', '그 마커의 파트에 사이클을 걸고 켜기']],
      ['[[⌥⌫]]', ['delete the marker of the part the playhead is in', '플레이헤드가 있는 파트의 마커 삭제']],
      [['number pad 1 to 9', '숫자 패드 1~9'], ['the playhead to the first to ninth marker', '플레이헤드를 첫째~아홉째 마커로']]) +
    h('the menu of a marker', '마커의 메뉴') +
    p('Right-click a marker. The lower lines move the song’s time: everything on every track goes with the part.', '마커를 오른쪽 클릭합니다. 아래쪽 항목은 곡의 시간을 움직입니다. 모든 트랙의 모든 것이 파트와 함께 갑니다.') +
    table(null,
      ['{{repeat this part}}', ['a copy of the part is put in right after it', '파트의 사본을 바로 뒤에 끼워 넣습니다']],
      ['{{move it earlier}} {{move it later}}', ['it changes places with the part before, after', '이전, 다음 파트와 자리를 바꿉니다']],
      ['{{cut it out of the song}}', ['the part goes and the song closes over it', '파트가 없어지고 곡이 그 위로 닫힙니다']]) +
    note('While the song plays, a click on a marker never jumps mid-bar: the song goes there at the next bar line.', '재생 중에 마커를 클릭하면 마디 중간에 넘어가지 않고, 다음 마디 선에서 그곳으로 넘어갑니다.'),
    art: fig('markermenu', { w: 124 }) }),

  page(t('cutting time out, putting it in', '시간 잘라내기와 넣기'), { kind: 'split', tw: 108, mid: true, txt:
    lead('The cycle’s two ends say which stretch. It need not be switched on.', '사이클의 양 끝이 구간을 정합니다. 켜져 있지 않아도 됩니다.') +
    table([['key', '키'], ['Edit menu', 'Edit 메뉴'], ['what happens', '일어나는 일']],
      ['[[⌃⌘X]]', 'Cut Section Between Locators', ['the stretch goes out of the song and the song closes over it. It is kept, to be put in elsewhere', '구간이 곡에서 빠지고 곡이 그 위로 닫힙니다. 빠진 구간은 다른 곳에 넣을 수 있게 보관됩니다']],
      ['[[⌃⌘Z]]', 'Insert Silence at Locators', ['room is made: everything from the cycle’s start on goes later by the cycle’s length', '빈 구간 만들기: 사이클 시작부터의 모든 것이 사이클 길이만큼 뒤로 갑니다']],
      ['[[⌃⌘V]]', 'Insert Section at Playhead', ['the stretch last taken out is put in at the playhead', '마지막으로 빼낸 구간을 플레이헤드에 끼워 넣습니다']],
      ['[[⌃⌘R]]', 'Repeat Section Between Locators', ['a copy of the stretch is put in right after it', '구간의 사본을 바로 뒤에 끼워 넣습니다']]) +
    h('what goes along', '함께 움직이는 것') +
    list(
      ['every track’s regions, and its alternatives put aside; what crosses an edge of the stretch is cut there', '모든 트랙의 리전과 따로 둔 대체 버전. 구간 가장자리에 걸친 것은 거기서 잘립니다'],
      ['every automation line, the markers, the cycle', '모든 오토메이션 라인, 마커, 사이클'],
      ['crossfades on the edges are parted and made again where the same two ends meet again', '가장자리의 크로스페이드는 갈라졌다가, 같은 두 끝이 다시 만나면 다시 만들어집니다']) +
    note('Each is one step to undo. The stretch that was taken out is forgotten when the tempo or the measure changes.', '각각 실행 취소 한 번입니다. 빼낸 구간은 템포나 박자가 바뀌면 잊힙니다.'),
    art: draw(146, 92,
      D.txt(0, 4, 'the song', '곡', 's') + row(6, [['intro', 4], ['verse', 8], ['pre', 4], ['chorus', 8], ['verse 2', 8], ['out', 4]]) +
      `<rect x="31.2" y="16" width="10.4" height="1.2" fill="#C99A22"/>` + D.txt(36.4, 21, 'the cycle', '사이클', 'xs m') +
      D.txt(0, 32, 'cut the cycle out', '사이클 구간 잘라내기', 's') + D.txt(60, 32, '', '', 'xs') + row(34, [['intro', 4], ['verse', 8], ['chorus', 8], ['verse 2', 8], ['out', 4]]) + D.arrow([[86, 38], [92, 38]], 'ink') + D.cell(94, 34, 10.4, 8, 'pre', 'pre', 'blf') + D.txt(106, 39, 'kept', '보관됨', 'xs') +
      D.txt(0, 53, 'repeat the cycle', '사이클 반복', 's') + row(55, [['intro', 4], ['verse', 8], ['pre', 4], ['pre', 4, 'blf'], ['chorus', 8], ['verse 2', 8], ['out', 4]]) +
      D.txt(0, 74, 'make room at the cycle', '사이클 자리에 빈 구간', 's') + row(76, [['intro', 4], ['verse', 8], ['', 4, 'dash'], ['pre', 4], ['chorus', 8], ['verse 2', 8], ['out', 4]]) +
      D.txt(0, 90, 'every track, every line and every marker goes along', '모든 트랙, 모든 라인, 모든 마커가 함께 움직입니다', 'xs')) }),

  page(t('tempo, measure, undo', '템포, 박자, 실행 취소'), { kind: 'text', cc: 3, txt:
    h('one tempo, one measure', '템포 하나, 박자 하나') +
    p('A song has one tempo and one measure from beginning to end. Click the tempo on the control bar to type it (40 to 240, two decimals); click the measure for its list (2/4, 3/4, 4/4, 5/4, 6/4, 7/4, 3/8, 5/8, 6/8, 7/8, 9/8, 12/8).', '곡은 처음부터 끝까지 템포 하나, 박자 하나를 갖습니다. 컨트롤 바의 템포를 클릭해 입력하고(40~240, 소수 둘째 자리까지), 박자를 클릭해 목록에서 고릅니다(2/4, 3/4, 4/4, 5/4, 6/4, 7/4, 3/8, 5/8, 6/8, 7/8, 9/8, 12/8).') +
    h('what a change of tempo does', '템포가 바뀌면') +
    table(null,
      [['a file', '파일'], ['keeps its length in seconds: it becomes more bars, or fewer, and still begins where it began', '초 단위 길이를 유지합니다. 마디 수가 늘거나 줄고, 시작 위치는 그대로입니다']],
      [['a file that follows the tempo', '템포를 따라가는 파일'], ['keeps its bars and is stretched; the pitch stays', '마디 수를 유지하며 늘어납니다. 피치는 그대로']],
      [['notes', '노트'], ['keep their beats', '박 위치를 유지합니다']],
      [['two that now overlap', '겹치게 된 둘'], ['the one that begins later is heard; the earlier is cut back there', '나중에 시작하는 것이 들리고, 앞의 것은 거기서 잘립니다']]) +
    p('A tempo change is a step that can be undone; undoing it brings the regions back as many bars long as they were. A song that is playing stops, takes the tempo, and goes on from the same bar.', '템포 변경은 실행 취소할 수 있고, 취소하면 리전이 원래 마디 길이로 돌아옵니다. 재생 중이면 멈췄다가 템포를 바꾸고 같은 마디에서 이어 갑니다.') +
    h('what a change of measure does', '박자가 바뀌면') +
    p('Nothing that sounds moves. Every region, point, marker, the cycle and the playhead stay at their moment, which is another bar now: a region that began on bar 17 in 4/4 begins partway through bar 22 in 3/4.', '소리 나는 것은 아무것도 움직이지 않습니다. 모든 리전, 포인트, 마커, 사이클, 플레이헤드는 제 시각에 그대로 있고, 그 시각이 다른 마디 번호가 될 뿐입니다. 4/4에서 17마디에 시작하던 리전은 3/4에서는 22마디 중간에서 시작합니다.') +
    note('A change of measure empties the undo history and the clipboard.', '박자를 바꾸면 실행 취소 기록과 클립보드가 비워집니다.') +
    h('the key', '키') +
    p('The key cell is a label of up to 8 characters. It is saved with the project and written into the hand-off’s info page.', '키 칸은 8자까지의 메모입니다. 프로젝트에 저장되고 내보내기의 info 파일에 적힙니다.') +
    h('undo and redo', '실행 취소와 다시 실행') +
    p('[[⌘Z]] undo, [[⇧⌘Z]] redo, up to 120 steps. Not while a take is being recorded.', '[[⌘Z]] 실행 취소, [[⇧⌘Z]] 다시 실행. 최대 120단계. 녹음 중에는 안 됩니다.') +
    table(null,
      [['a step', '한 단계인 것'], ['any edit of regions; making, deleting, reordering, renaming tracks; routing, sends, stacks, groups, alternatives; automation; markers; a change of tempo; everything one command line did', '리전의 모든 편집. 트랙 만들기, 삭제, 순서, 이름. 라우팅, 센드, 스택, 그룹, 대체 버전. 오토메이션. 마커. 템포 변경. 커맨드 라인 한 줄이 한 모든 일']],
      [['not a step', '단계가 아닌 것'], ['choosing; the tool, the mode, the nudge value; zoom and scrolling; where the cycle stands; mixer moves made by hand (fader, pan, mute, solo, a print’s amount); adding, removing or switching off a plug-in; anything done on an instrument’s page', '선택. 도구, 모드, 넛지 값. 줌과 스크롤. 사이클 위치. 손으로 한 믹서 조작(페이더, 팬, 뮤트, 솔로, 프린트 양). 플러그인 추가, 제거, 끄기. 악기 페이지에서 한 모든 일']]) +
    p('Going back over an edit leaves the mix where it is now. Going back also brings back what was chosen and where the cycle stood. A drag that ends where it began leaves no step.', '편집을 되돌려도 믹스는 지금 상태로 남습니다. 되돌리면 그때 선택했던 것과 사이클 위치도 돌아옵니다. 시작한 자리에서 끝난 드래그는 단계를 남기지 않습니다.') +
    note('The history is emptied when a project is opened and when the measure changes.', '기록은 프로젝트를 열 때와 박자를 바꿀 때 비워집니다.') }),
])
