import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('automation', t('automation', '오토메이션'),
  t('A line drawn along a track that moves one of its controls as the song goes by.', '트랙을 따라 그린 선이 곡이 흐르는 동안 컨트롤 하나를 움직입니다.'), [

  page(t('lines and points', '라인과 포인트'), { kind: 'wide', cc: 3, txt:
    p('[[A]] or the {{auto}} cell shows the lines. The regions dim and each lane shows one line for its track. A track with no points yet shows a dashed line at the value its control stands at.', '[[A]]나 {{auto}} 칸이 라인을 보여 줍니다. 리전이 흐려지고 레인마다 그 트랙의 라인 하나가 보입니다. 아직 포인트가 없는 트랙은 컨트롤의 현재 값에 점선이 그려집니다.') +
    p('A bus and a stack always show their volume line, in their own colour, and it is edited where it is without [[A]]: click the line for a point, double-click the lane for one.', '버스와 스택은 자기 색의 볼륨 라인이 늘 보이고, [[A]] 없이 그 자리에서 고칩니다. 라인을 클릭하면 포인트, 레인을 더블 클릭해도 포인트가 생깁니다.') +
    legend(
      [1, 'the key on the head names the line; click it for the list. [[⌘Y]] steps to the next line that has points, and shows the lines. The list shows how many points each line has', '헤드의 키가 라인의 이름입니다. 클릭하면 목록. [[⌘Y]]는 포인트가 있는 다음 라인으로 넘어가고 라인을 보여 줍니다. 목록에는 라인마다 포인트 수가 나옵니다'],
      [2, 'what that control reads now', '그 컨트롤의 현재 값'],
      [3, 'a point. From one point to the next the line runs straight, or bent where the command line bent it; before the first and after the last the value holds', '포인트. 포인트 사이는 직선으로 이어지고, 커맨드 라인으로 휘게 한 구간은 곡선으로 이어집니다. 첫 포인트 앞과 마지막 포인트 뒤는 값이 유지됩니다']) +
    h('what a line can be for', '라인을 걸 수 있는 것') +
    table(null,
      ['{{volume}}', ['−∞ to +6 dB', '−∞~+6 dB']],
      ['{{pan}}', ['full left to full right', '완전 왼쪽~완전 오른쪽']],
      ['{{tape}} {{space}} {{delay}}', ['the print’s amount, 0 to 100', '프린트의 양, 0~100']],
      [['a send', '센드'], ['one line for each send the track has', '트랙의 센드마다 라인 하나']],
      [['a macro', '매크로'], ['one line for each of the track’s macros, by its name; it turns what the macro is wired to', '트랙의 매크로마다 라인 하나, 매크로 이름으로. 매크로가 연결된 것을 움직입니다']],
      [['a plug-in’s control', '플러그인 컨트롤'], ['move the control in the plug-in’s window, then open the list: each plug-in offers the control last moved', '플러그인 창에서 컨트롤을 움직인 다음 목록을 엽니다. 플러그인마다 마지막으로 움직인 컨트롤이 나옵니다']]) +
    note('Lines are drawn by hand, point by point, or written by the command line (see “the command line”). On a track of a group that shares automation, a line drawn is drawn on the others too. There is no writing a line by moving a control while the song runs, and no line for the stereo out, for mute or for solo.', '라인은 손으로 포인트를 하나씩 그리거나 커맨드 라인으로 씁니다(“커맨드 라인” 참고). 오토메이션을 함께 하는 그룹의 트랙에 그린 라인은 다른 트랙에도 그려집니다. 재생 중에 컨트롤을 움직여 라인을 쓰는 기능은 없고, 스테레오 아웃, 뮤트, 솔로에는 라인을 걸 수 없습니다.') +
    h('points', '포인트') +
    table(null,
      [['make', '만들기'], ['click the line, or double-click a lane; the pencil: one click', '라인을 클릭하거나 레인을 더블 클릭. 연필은 한 번 클릭']],
      [['choose', '선택'], ['click a point; [[⇧]] click adds; drag empty lane: a box; [[⌘A]] all', '포인트 클릭. [[⇧]] 클릭은 추가. 빈 레인에서 드래그하면 상자. [[⌘A]]는 전부']],
      [['move', '이동'], ['drag a point (the chosen go too) or the line between points (both go; under a marquee, its stretch, stepped at its edges; with no points, all of it). [[⌃]] and up or down: the stretch bent', '포인트 드래그: 선택한 포인트도 함께 움직입니다. 포인트 사이의 라인 드래그: 양옆 포인트가 함께 오르내립니다. 마키 아래면 마키 구간이 움직이고 양 가장자리에 계단이 생깁니다. 포인트가 없는 라인은 통째로 움직입니다. [[⌃]]를 누르고 위아래로 끌면 그 구간이 휩니다']],
      [['nudge', '넛지'], ['[[⌥←]] [[⌥→]] one nudge earlier or later, the chosen points alone. [[⌥↑]] [[⌥↓]] the value, with [[⇧]] ten steps', '[[⌥←]] [[⌥→]] 넛지 한 칸 앞뒤로, 선택한 포인트만. [[⌥↑]] [[⌥↓]] 값 한 단계, [[⇧]]와 함께면 열 단계']],
      [['delete', '삭제'], ['[[⌫]]; with a marquee, every point under it; or the eraser', '[[⌫]]. 마키가 있으면 그 아래 모든 포인트. 또는 지우개']]) +
    p('With a line drawn, the line is what sounds. For volume, moving the fader shifts the whole line up or down, as one step of undo; a macro’s line moves the same way. For pan, a send or a print, moving the control by hand does not change what the line plays.', '라인이 그려져 있으면 라인이 소리를 정합니다. 볼륨은 페이더를 움직이면 라인 전체가 위아래로 옮겨지고, 실행 취소 한 단계가 됩니다. 매크로 라인도 같습니다. 팬, 센드, 프린트는 손으로 컨트롤을 움직여도 라인이 재생하는 값은 바뀌지 않습니다.'),
    art: fig('auto', { w: 196, calls: [[1, 'ap#4', 't'], [2, [274, 96], 'b'], [3, [380, 81], 't']] }) + fig('autolist', { w: 50 }) }),
])
