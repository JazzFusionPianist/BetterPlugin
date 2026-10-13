// the key commands, set from the app's own sheet (guide/keys.json, written by shots.mjs from the page's SHEET): a key
// added in the app is here at the next build. The Korean lines come from the app's own Korean list (ui/lang.ko.js);
// a line that list does not hold yet is said in MORE below.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { t, lang, koWord, here, p, h, note, table, cols, list, page, chapter } from '../lib.mjs'

const MORE = { 'slur': 'slur 패널', 'the hand': '손', 'by 10 ms': '10 ms씩', 'by 1 ms': '1 ms씩' }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const say = s => lang() === 'ko' ? (koWord(s) || MORE[s] || s) : s
const WORDS = new Set(['click', 'drag', '17'])
const KOW = { click: '클릭', drag: '드래그' }
/* 'f1 f2 f3 f4' is four keys, '⌥⇧⌘.' one, '⌥ click' a key and a word */
function keys (s) {
  return s.split(' ').map(k => {
    if (WORDS.has(k)) return `<span class="kw">${lang() === 'ko' ? (KOW[k] || k) : k}</span>`
    const parts = []
    let rest = k
    while (rest.length > 1 && '⌘⌥⇧⌃'.includes(rest[0])) { parts.push(rest[0]); rest = rest.slice(1) }
    if ('⌘⌥⇧⌃'.includes(rest) && rest.length === 1) parts.push(rest)
    else if (rest.length > 1 && /^[←→↑↓]+$/.test(rest)) parts.push(...rest)                 // '⌘←→' : either arrow
    else parts.push(/^[a-z]$/.test(rest) ? rest.toUpperCase() : rest)
    return `<kbd>${parts.map(x => `<i${'⌘⌥⇧⌃'.includes(x) ? ' class="m"' : ''}>${esc(x)}</i>`).join('')}</kbd>`
  }).join(' ')
}
const group = ([name, rows]) => `<div class="kg"><h3>${esc(say(name))}</h3><table class="tbl keys"><tbody>${rows.map(([what, k]) => `<tr><td>${esc(say(what))}</td><td>${keys(k)}</td></tr>`).join('')}</tbody></table></div>`

export default () => {
  const SHEET = JSON.parse(readFileSync(join(here, 'keys.json'), 'utf8'))
  const all = SHEET.flat()
  const a = all.slice(0, 8), b = all.slice(8)
  return chapter('keys', t('key commands', '단축키'),
    t('Every key the app answers to, as its own sheet lists them. In the app the same list opens with shift and slash, or with the keys button at the foot of the window.', '앱이 알아듣는 모든 단축키를 앱 안의 표 그대로 실었습니다. 앱에서는 shift와 슬래시를 누르거나 창 아래의 keys 버튼을 누르면 같은 표가 열립니다.'), [
      page(t('playing, tools, regions, choosing', '재생, 도구, 리전, 선택'), { kind: 'text', cc: 4, txt: a.map(group).join('') }),
      page(t('tracks, markers, time, view, project', '트랙, 마커, 시간, 보기, 프로젝트'), { kind: 'text', cc: 4, txt: p('Keys are read by their place on the keyboard, so they are the same whatever language the keyboard is set to.', '단축키는 키보드에서의 위치로 읽기 때문에, 입력 언어가 한글이어도 똑같이 동작합니다.') + b.map(group).join('') }),
      page(t('also bound, and the menu bar', '표에 없는 키, 그리고 메뉴 막대'), { kind: 'split', tw: 128, txt:
        p('These keys work but are not on the app’s own sheet.', '아래 키들은 동작하지만 앱의 단축키 표에는 없습니다.') +
        table(null,
          ['[[⌘K]]', ['the computer’s keys as a keyboard, and back', '컴퓨터 자판을 건반으로, 다시 원래대로']],
          ['[[⇧R]]', ['capture what was just played', '방금 연주한 것 캡처']],
          ['[[⌥⌘S]]', ['a new track of notes', '새 노트 트랙']],
          ['[[⌃⌘.]]', ['every note off', '모든 노트 끄기']],
          ['[[⌘C]] [[⌘X]] [[⌘V]]', ['copy, cut, paste regions; paste lands at the playhead', '리전 복사, 잘라내기, 붙이기. 플레이헤드에 붙습니다']],
          ['[[↑]] [[↓]]', ['the track above, below; with [[⇧]] the rows passed are chosen too', '위, 아래 트랙. [[⇧]]와 함께면 지나간 줄도 선택']],
          ['[[⌘U]]', ['the cycle exactly round what is chosen, not rounded to bars', '선택한 것에 정확히 맞춘 사이클(마디로 반올림하지 않음)']],
          ['[[⌘[]] [[⌘]]]', ['the same as [[[]] and [[]]]', '[[[]], [[]]]와 같음']],
          ['[[⌃.]] [[⌃,]]', ['the same as [[tab]] and [[⌥tab]]', '[[tab]], [[⌥tab]]과 같음']],
          ['[[⇧tab]] [[⌥⇧tab]]', ['a marquee from the playhead to the next, the last beginning', '플레이헤드에서 다음, 이전 시작점까지 마키']],
          ['[[⌃home]] [[⌃end]]', ['the playhead to where what is chosen begins, ends', '플레이헤드를 선택한 것의 시작, 끝으로']],
          ['[[⌃⌥⇧↑]] [[⌃⌥⇧↓]]', ['region gain by 0.1 dB', '리전 게인 0.1 dB씩']],
          ['[[⌘E]]', ['hand off, set to stems', '내보내기, 스템으로 맞춰서']],
          ['[[⌥K]]', ['the sheet of keys', '단축키 표']],
          ['[[esc]]', ['closes what is open, one thing a press; with nothing open, lets go of everything chosen', '열린 것을 한 번에 하나씩 닫기. 열린 것이 없으면 모든 선택 해제']],
          [['number pad', '숫자 패드'], ['enter plays, 0 stops, the point plays and stops, the star records, 1 to 9 go to the first nine markers', 'enter 재생, 0 정지, 점은 재생/정지, 별표는 녹음, 1~9는 처음 아홉 마커로']]) +
        note('The sheet only lists the keys; they cannot be reassigned in this version.', '표는 키를 보여 주기만 합니다. 이 버전에서는 키를 바꿀 수 없습니다.'),
        art: `<div style="width:126mm">` + h('the menu bar', '메뉴 막대') + p('The Mac’s menu bar is written the Mac’s way. Most commands live on the page or on keys; these are the lines the menus hold.', 'Mac의 메뉴 막대는 Mac의 방식대로 적혀 있습니다. 명령 대부분은 화면이나 키에 있고, 메뉴에는 다음 항목이 있습니다.') +
          cols(3,
            h('Slur Studio', 'Slur Studio') + list(['Settings… [[⌘,]]', 'Settings… [[⌘,]]'], ['Key Command Assignments… [[⌥K]]', 'Key Command Assignments… [[⌥K]]']) +
            h('File', 'File') + list(['New [[⌘N]]', 'New [[⌘N]]'], ['Open… [[⌘O]]', 'Open… [[⌘O]]'], ['Open Recent…', 'Open Recent…'], ['Save [[⌘S]]', 'Save [[⌘S]]'], ['Save As… [[⇧⌘S]]', 'Save As… [[⇧⌘S]]'], ['Rename…', 'Rename…'], ['Revert To…', 'Revert To…'], ['Import Audio… [[⌘I]]', 'Import Audio… [[⌘I]]'], ['Hand Off… [[⌘B]]', 'Hand Off… [[⌘B]]']),
            h('Edit', 'Edit') + list(['Undo, Redo, Cut, Copy, Paste, Select All', 'Undo, Redo, Cut, Copy, Paste, Select All'], ['Cut Section Between Locators [[⌃⌘X]]', 'Cut Section Between Locators [[⌃⌘X]]'], ['Insert Silence at Locators [[⌃⌘Z]]', 'Insert Silence at Locators [[⌃⌘Z]]'], ['Insert Section at Playhead [[⌃⌘V]]', 'Insert Section at Playhead [[⌃⌘V]]'], ['Repeat Section Between Locators [[⌃⌘R]]', 'Repeat Section Between Locators [[⌃⌘R]]']) +
            h('Region', 'Region') + list(['Fades for Selection', 'Fades for Selection'], ['Strip Silence [[⌃X]]', 'Strip Silence [[⌃X]]'], ['Group [[⌥⌘G]]', 'Group [[⌥⌘G]]'], ['Ungroup [[⌥⌘U]]', 'Ungroup [[⌥⌘U]]'], ['Set Project Tempo from Region [[⌃⌥T]]', 'Set Project Tempo from Region [[⌃⌥T]]'], ['Fit Region to Project Tempo [[⌃⌥F]]', 'Fit Region to Project Tempo [[⌃⌥F]]']),
            h('Track', 'Track') + list(['New Tracks… [[⌥⌘N]]', 'New Tracks… [[⌥⌘N]]'], ['New Audio Track [[⌥⌘A]]', 'New Audio Track [[⌥⌘A]]'], ['New Bus', 'New Bus'], ['Duplicate', 'Duplicate'], ['Rename…', 'Rename…'], ['Delete', 'Delete'], ['Group for Editing [[⌃⌘G]]', 'Group for Editing [[⌃⌘G]]'], ['Suspend Groups', 'Suspend Groups']) +
            h('Window', 'Window') + list(['Minimize [[⌘M]]', 'Minimize [[⌘M]]'], ['Zoom', 'Zoom'], ['Enter Full Screen [[⌃⌘F]]', 'Enter Full Screen [[⌃⌘F]]'])) + `</div>` }),
    ])
}
