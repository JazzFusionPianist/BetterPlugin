import { t, p, lead, h, note, steps, list, legend, table, cols, fig, draw, D, page, chapter } from '../lib.mjs'

export default () => chapter('welcome', t('before you begin', '시작하기 전에'),
  t('What Slur Studio is for, how this guide writes things down, and where the app keeps your work on the disk.', 'Slur Studio가 무엇을 위한 프로그램인지, 이 책이 무엇을 어떻게 적는지, 앱이 작업물을 디스크 어디에 두는지 설명합니다.'), [

  page(t('what slur studio is', 'slur studio는 어떤 프로그램인가'), { kind: 'split', tw: 100, mid: true, txt:
    lead('Slur Studio is a place to sketch a song: record, drag sound in, play an instrument, cut and move, set a rough mix, then hand the whole thing off to the program you finish in.', 'Slur Studio는 곡을 스케치하는 곳입니다. 녹음하고, 소리를 끌어다 놓고, 악기를 치고, 자르고 옮기고, 대략 믹스를 잡은 다음 마무리할 프로그램으로 통째로 넘깁니다.') +
    p('It runs on a Mac with macOS 12 or later. This guide is written for version 0.1.0, an alpha: the app is still growing, and a page is added here whenever a feature is.', 'macOS 12 이상의 Mac에서 돌아갑니다. 이 책은 0.1.0 알파 버전 기준입니다. 앱은 아직 자라는 중이고, 기능이 생길 때마다 이 책에도 쪽이 더해집니다.') +
    h('three things to know first', '먼저 알아 둘 세 가지') +
    list(
      ['__One window.__ The song, the mixer, the patch of each track and the Slur panel all stand on one board. Nothing floats except a plug-in’s own window.', '__창은 하나.__ 곡, 믹서, 트랙마다의 패치, Slur 패널이 모두 한 판 위에 있습니다. 떠다니는 것은 플러그인 자체의 창뿐입니다.'],
      ['__One sound at a time on a track.__ A region put somewhere covers what was under it. Two regions sound together only where you make a crossfade.', '__트랙에서는 한 번에 한 소리.__ 리전을 어딘가에 놓으면 그 밑에 있던 것을 덮습니다. 두 리전이 함께 들리는 곳은 크로스페이드를 만든 자리뿐입니다.'],
      ['__A patch on every track.__ Patch on Slur is built in: its prints and your Audio Unit and VST3 plug-ins stand on one wall and are wired as you like, side by side too.', '__트랙마다 패치.__ Patch on Slur가 들어 있습니다. 그 프린트와 Audio Unit, VST3 플러그인이 한 벽에 서고, 병렬을 포함해 원하는 대로 선으로 잇습니다.']) +
    note('Everything in the app saves by itself every few seconds. You can still press [[⌘S]] whenever you like.', '앱 안의 모든 것은 몇 초마다 저절로 저장됩니다. 물론 [[⌘S]]를 눌러도 됩니다.'),
    art: draw(150, 96,
      D.txt(0, 4, 'a sketch, from the first idea to the hand off', '스케치 한 편, 첫 아이디어에서 내보내기까지', 's') +
      // five steps across, joined by arrows
      [['start page', '시작 화면', 'new project, or open one', '새 프로젝트 또는 열기'], ['sound in', '소리 넣기', 'record, drag files, play notes', '녹음, 파일 드래그, 노트 연주'], ['edit', '편집', 'cut, move, fade, time', '자르기, 옮기기, 페이드, 시간'], ['patch and mix', '패치와 믹스', 'prints, plug-ins, sends', '프린트, 플러그인, 센드'], ['hand off', '내보내기', 'stems, mix, notes, the project', '스템, 믹스, 노트, 프로젝트']].map(([en, ko, en2, ko2], i) => {
        const x = i * 30.6, on = i === 4
        return D.cell(x, 12, 26, 11, en, ko, on ? 'on' : '') + D.txt(x + 13, 28, en2, ko2, 'xs m') + (i < 4 ? D.arrow([[x + 26.6, 17.5], [x + 30.2, 17.5]]) : '')
      }).join('') +
      // the folder that leaves, and where it goes
      D.arrow([[135.4, 31.5], [135.4, 46]]) +
      D.box(96, 47, 54, 46, 'soft') + D.txt(99, 53, 'the hand-off folder', '내보내기 폴더', 'b') +
      [['01 kick.wav', '01 kick.wav'], ['02 snare.wav', '02 snare.wav'], ['03 hats.wav …', '03 hats.wav …'], ['one file for each track', '트랙마다 파일 하나'], ['or the mix, as one file', '또는 믹스 파일 하나']].map(([en, ko], i) => D.line(99, 58.2 + i * 7, 101.5, 58.2 + i * 7, 'soft') + D.txt(103, 59.2 + i * 7, en, ko, 's')).join('') +
      D.arrow([[96, 70], [64, 70]]) + D.cell(20, 63, 44, 14, 'the program you finish in', '마무리할 프로그램', 'dash') +
      D.txt(42, 82, 'Logic, Cubase, Live, Pro Tools …', 'Logic, Cubase, Live, Pro Tools …', 'xs m')) }),

  page(t('how this guide writes things', '이 책의 표기법'), { kind: 'text', cc: 3, txt:
    h('keys', '키') +
    p('A key is drawn as a cap: [[B]], [[⌥⌘N]], [[space]]. Caps in one frame are pressed together. The signs are those on a Mac keyboard: [[⌘]] command, [[⌥]] option, [[⇧]] shift, [[⌃]] control, [[↩]] return, [[⌫]] delete.', '키는 키캡으로 그립니다. [[B]], [[⌥⌘N]], [[space]]. 한 테두리 안의 키는 함께 누릅니다. 기호는 Mac 키보드와 같습니다. [[⌘]] command, [[⌥]] option, [[⇧]] shift, [[⌃]] control, [[↩]] return, [[⌫]] delete.') +
    p('Keys are read by where they sit on the keyboard, so they work the same with a Korean input source. While you type in a box (a name, the command line) the keys type; they are commands again when you leave the box.', '키는 자판에서의 위치로 읽기 때문에 한글 입력 상태에서도 똑같이 동작합니다. 이름 칸이나 커맨드 라인처럼 글자를 치는 칸 안에서는 글자가 입력되고, 칸을 벗어나면 다시 단축키가 됩니다.') +
    h('words on the screen', '화면의 글자') +
    p('Words the app itself shows are set in bold, exactly as written there: {{hand off}}, {{mixer}}, {{plays to}}. The app writes everything in lowercase. Lines of the Mac’s menu bar are written the Mac’s way: ((File > Save As…)).', '앱이 화면에 보여 주는 글자는 굵게, 화면에 적힌 그대로 적습니다. {{hand off}}, {{mixer}}, {{plays to}}. 앱은 모든 글자를 소문자로 씁니다. Mac 메뉴 막대의 항목은 Mac의 방식대로 적습니다. ((File > Save As…)).') +
    note('The pictures in this guide show the app in English. In Settings the app can also speak Korean; names you gave are never translated.', '이 책의 그림과 화면 글자는 영어 표시 기준입니다. 설정에서 앱의 언어를 한국어로 바꿀 수 있으며, 직접 붙인 이름은 번역되지 않습니다.') +
    h('the hand', '손동작') +
    table(null,
      [['click', '클릭'], ['press the mouse button once', '마우스 버튼을 한 번 누르기']],
      [['double-click', '더블 클릭'], ['twice on the same thing, quickly', '같은 것을 빠르게 두 번']],
      [['right-click', '오른쪽 클릭'], ['the other mouse button, or two fingers on a trackpad. Control and click is not a right-click here: control means a finer grid', '마우스의 다른 버튼, 트랙패드에서는 두 손가락. 여기서는 control 클릭이 오른쪽 클릭이 아닙니다. control은 더 촘촘한 그리드입니다']],
      [['drag', '드래그'], ['press, move, let go', '누른 채 움직이고 놓기']]) +
    h('two habits that work everywhere', '어디서나 통하는 두 가지') +
    table(null,
      ['[[⌥]] ' + t('click', '클릭'), ['back to where it starts: a fader to 0 dB, a pan to the middle, a region’s gain to none, a print to its first amount, the zoom to the whole song', '처음 값으로. 페이더는 0 dB, 팬은 가운데, 리전 게인은 0, 프린트는 처음 양, 줌은 곡 전체']],
      ['[[⇧]] ' + t('drag', '드래그'), ['finely: the thing moves a fifth as far', '미세하게. 움직임이 5분의 1이 됩니다']]) +
    h('numbers on pictures', '그림의 번호') +
    p('A numbered square beside a picture, with a line to a part of it, belongs to the same number in the list beside it.', '그림 옆의 번호 네모와 거기서 뻗은 선은 옆 목록의 같은 번호를 가리킵니다.') +
    h('drawings', '도해') +
    p('In drawings, ink lines are things and blue arrows are what moves: the sound, your hand, or time.', '도해에서 검은 선은 사물이고, 파란 화살표는 움직이는 것입니다. 소리, 손, 또는 시간.') +
    h('where the app talks back', '앱이 말하는 자리') +
    p('Short messages (“saved”, “nudge beat”, “2 crossfades, 3 fades”) appear at the foot of the window, beside the command line.', '“saved”, “nudge beat”, “2 crossfades, 3 fades” 같은 짧은 말은 창 맨 아래, 커맨드 라인 옆에 나타납니다.') }),

  page(t('where your work is kept', '작업물이 놓이는 곳'), { kind: 'split', tw: 104, mid: true, txt:
    lead('A project is a folder of its own, as in Logic: in it the project file (the song and earlier copies of it), Audio Files (every sound it uses) and Bounces (what it hands off).', '프로젝트는 Logic처럼 자기 폴더입니다. 그 안에 프로젝트 파일(곡과 곡의 이전 사본), Audio Files(곡이 쓰는 모든 소리), Bounces(내보낸 것)가 있습니다.') +
    table(null,
      [['new projects', '새 프로젝트'], ['~/Music/Slur Studio/Projects, as a folder __name__ holding __name.sls__. Save As can put one anywhere, in a folder of its own. A project from before stays as it was: one __name.sls__ with its sounds inside', '~/Music/Slur Studio/Projects 안에 __이름__ 폴더로, 그 안에 __이름.sls__. Save As로 어디에나, 역시 자기 폴더로 둘 수 있습니다. 예전 프로젝트는 그대로입니다: 소리를 안에 품은 __이름.sls__ 하나']],
      [['sounds', '소리'], ['every file brought in, every take and every bounce in place is copied into the project’s Audio Files as it comes. A project never points at files elsewhere', '가져온 파일, 테이크, 제자리 바운스는 들어오는 대로 프로젝트의 Audio Files로 복사됩니다. 프로젝트가 바깥 파일을 가리키는 일은 없습니다']],
      [['earlier copies', '이전 사본'], ['at most one every ten minutes of work, the newest 24 kept. ((File > Revert To…)) goes back to one', '작업 10분에 하나까지, 최근 24개를 보관합니다. ((File > Revert To…))로 되돌아갑니다']],
      [['hand-off folders', '내보내기 폴더'], ['wherever you say, under the name you give; the panel opens on the project’s own Bounces (for a project from before: the last place used, ~/Music/Slur Studio to begin with)', '정한 위치에 정한 이름으로. 저장 창은 그 프로젝트의 Bounces에서 열립니다(예전 프로젝트는 마지막에 쓴 위치, 처음에는 ~/Music/Slur Studio)']]) +
    h('good to know', '알아 둘 것') +
    list(
      ['The app saves the song every 3 seconds when something changed.', '바뀐 것이 있으면 3초마다 곡을 저장합니다.'],
      ['Closing the window quits the app. If the song has changed since you last saved it yourself, it asks first: save, don’t save, cancel.', '창을 닫으면 앱이 종료됩니다. 마지막으로 직접 저장한 뒤 곡이 바뀌었으면 먼저 묻습니다. save, don’t save, cancel.'],
      ['Only one copy of the app runs. Opening it again brings the first to the front.', '앱은 하나만 실행됩니다. 다시 열면 이미 열린 것이 앞으로 나옵니다.'],
      ['The first time a track listens to an input, macOS asks whether Slur Studio may use the microphone.', '트랙이 처음 입력을 들으려 할 때 macOS가 마이크 사용을 허락할지 묻습니다.'],
      ['With less than 10 GB free on the disk the app says so once at the start. A take is not begun with less than 300 MB free.', '디스크 여유가 10 GB 아래면 시작할 때 한 번 알려 줍니다. 300 MB 아래에서는 녹음을 시작하지 않습니다.']),
    art: draw(146, 104,
      D.txt(0, 4, 'on the disk', '디스크에서', 's') +
      D.txt(0, 12, '~/Music/Slur Studio', '~/Music/Slur Studio', 'b') +
      D.line(2, 14, 2, 86, 'soft') +
      D.line(2, 22, 8, 22, 'soft') + D.txt(10, 23, 'Projects', 'Projects', 'b') +
      D.line(12, 25, 12, 60, 'soft') +
      D.line(12, 32, 18, 32, 'soft') + D.cell(20, 27.5, 40, 9, 'low tide ep', 'low tide ep', 'on') + D.txt(63, 33, 'one project, a folder of its own', '프로젝트 하나, 자기 폴더 하나', 's') +
      D.line(24, 36.5, 24, 60, 'soft') +
      D.line(24, 43, 30, 43, 'soft') + D.txt(32, 44, 'low tide ep.sls', 'low tide ep.sls') + D.txt(63, 44, 'the song, and earlier copies of it', '곡, 그리고 곡의 이전 사본', 's') +
      D.line(24, 51, 30, 51, 'soft') + D.txt(32, 52, 'Audio Files', 'Audio Files') + D.txt(63, 52, 'sounds brought in, takes, bounces in place', '가져온 소리, 테이크, 제자리 바운스', 's') +
      D.line(24, 59, 30, 59, 'soft') + D.txt(32, 60, 'Bounces', 'Bounces') + D.txt(63, 60, 'stems and mixes handed off', '내보낸 스템과 믹스', 's') +
      D.line(36, 63, 36, 72, 'soft') + D.line(36, 72, 42, 72, 'soft') + D.cell(44, 67.5, 50, 9, 'low tide ep chorus stems', 'low tide ep chorus stems', 'dash') + D.txt(97, 73, 'a hand-off', '내보낸 것', 's') +
      D.line(36, 72, 36, 85, 'soft') + D.line(36, 85, 42, 85, 'soft') + D.cell(44, 80.5, 50, 9, 'low tide ep song mix.wav', 'low tide ep song mix.wav', 'dash') + D.txt(97, 86, 'named for the project and the range', '프로젝트와 범위로 이름', 's') +
      D.txt(0, 98, '~/Library/Application Support/Slur Studio', '~/Library/Application Support/Slur Studio', 'b') + D.txt(75, 98, 'settings: device, language, what was open', '설정: 장치, 언어, 열려 있던 것', 's')) }),
])
