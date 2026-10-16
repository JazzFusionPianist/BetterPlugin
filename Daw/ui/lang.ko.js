/* ── the room in Korean ──
   On the left a word or phrase exactly as the room writes it in English (numbers as #); on the right how it is said
   in Korean. What is not here stays in English: the names of the prints (tape, space, delay…), the letters of keys,
   and whatever has not been put into words yet. A first pass (2026-10-11): the wording is to be read by someone who
   makes music in Korean and changed here, line by line. */
LANG.lists.ko = {
  /* the bars at the top: panels, tools, what is chosen */
  'patch': '패치', 'mixer': '믹서', 'hand off': '내보내기', 'auto': '오토', 'flex': '플렉스',
  'tool': '도구', 'cmd': '커맨드', 'pointer': '포인터', 'pencil': '연필', 'eraser': '지우개', 'scissors': '가위', 'marquee': '마키', 'smart': '스마트',
  'mode': '모드', 'snap': '스냅', 'grid': '그리드', 'slip': '슬립', 'shuffle': '셔플', 'spot': '스팟',
  'region': '리전', 'regions': '리전', 'gain': '게인', 'transpose': '트랜스포즈', 'fine': '미세 조정', 'fade': '페이드', 'fades': '페이드',
  'colour': '색', 'outline': '모양', 'as read': '읽은 대로', 'as the track': '트랙대로',
  'track': '트랙', 'tracks': '트랙', 'track #': '트랙 #', 'stack': '스택', 'stacks': '스택', 'bus': '버스', 'buses': '버스', 'markers': '마커',
  'bar': '마디', 'bars': '마디', 'beat': '박', 'tick': '틱', 'sample': '샘플', 'many': '여러 개',
  'nudge': '넛지', 'nudge beat': '넛지 박', 'nudge tick': '넛지 틱', 'nudge sample': '넛지 샘플', 'nudge # ms': '넛지 # ms', 'nudge #/#': '넛지 #/#',
  'tempo': '템포', 'key': '키', 'out': '출력', 'in': '입력', 'to': '→',

  /* what a track is, what it listens to and where it plays */
  'audio': '오디오', 'midi': '미디', 'instrument': '악기', 'kind': '종류', 'how many': '몇 개', 'create': '만들기', 'new track': '새 트랙',
  'input': '입력', 'input #': '입력 #', 'input # and #': '입력 #, #', 'output': '출력', 'output #-#': '출력 #-#', 'out #-#': '출력 #-#',
  'stereo out': '스테레오 아웃', 'st out': '스테레오', 'plays to': '보내는 곳', 'hear the input': '입력 듣기',
  'mute': '뮤트', 'solo': '솔로', 'pan': '팬', 'send': '센드', 'volume': '볼륨', 'level': '레벨', 'strip': '스트립', 'strips': '스트립',
  'drums': '드럼', 'bass': '베이스', 'guitar': '기타', 'voice': '보컬', 'effects': '효과', 'notes': '노트',
  'sound': '소리', 'made here': '여기서 만든 소리', 'kit': '킷', 'sampler': '샘플러', 'synth': '신스', 'keyboard': '키보드', 'an octave': '한 옥타브',
  'filter': '필터', 'cutoff': '컷오프', 'resonance': '레조넌스', 'tune': '튠', 'loudness': '음량',
  'recording is in the app': '녹음은 앱에서', 'the plug-in opens here in the app': '플러그인은 앱에서 여기에 열림',

  /* hand off */
  'song': '곡', 'range': '범위', 'mix': '믹스', 'print': '프린트', 'with patch': '패치 포함', 'dry': '드라이', 'both': '둘 다', 'one': '하나', 'all': '전체', 'none': '없음', 'yes': '예', 'no': '아니요',
  '# stems': '스템 #개', '# bit': '#비트',

  /* the foot */
  'rate': '레이트', 'buffer': '버퍼', 'saved': '저장됨', '# empty tracks deleted': '빈 트랙 #개 삭제됨', '# ticks': '#틱', 'by # ms': '# ms씩',

  /* the sheet of keys: its groups */
  'transport': '트랜스포트', 'panels': '패널', 'tools': '도구', 'project': '프로젝트', 'choosing': '선택', 'view': '보기', 'zoom': '확대',
  'cycle': '사이클', 'the song’s time': '곡의 시간', 'automation': '오토메이션', 'flex and lines': '플렉스와 라인', 'alternatives': '대체 버전', 'group': '그룹',
  /* …and its lines */
  'play, stop': '재생, 정지', 'record': '녹음', 'throw the take away': '테이크 버리기', 'click': '클릭', 'count-in': '카운트인',
  'to the start': '처음으로', 'a bar back, a bar on': '한 마디 뒤로, 앞으로', 'eight bars': '여덟 마디', 'go to a bar': '마디로 이동',
  'this sheet': '이 단축키 표', 'tool menu, then a letter': '도구 메뉴, 이어서 글자', 'the other tool, while held': '누르는 동안 다른 도구', 'while held': '누르는 동안',
  'a finer grid, in a drag': '드래그 중 더 촘촘한 그리드', 'no grid': '그리드 없이', 'finely': '미세하게',
  'shuffle, slip, spot, grid': '셔플, 슬립, 스팟, 그리드', 'slip, and back': '슬립, 다시 원래대로',
  'split at the playhead': '플레이헤드에서 자르기', 'join': '합치기', 'mute, solo': '뮤트, 솔로', 'solo only this': '이것만 솔로',
  'duplicate': '복제', 'repeat': '반복', 'reverse': '리버스', 'quantize': '퀀타이즈', 'let go of quantize': '퀀타이즈 풀기',
  'bounce in place': '제자리 바운스', 'strip silence': '무음 제거', 'rename': '이름 바꾸기', 'delete': '삭제', 'copy': '복사',
  'undo': '실행 취소', 'undo, redo': '실행 취소, 다시 실행', 'save': '저장', 'save as': '다른 이름으로 저장', 'new': '새로 만들기', 'open': '열기',
  'import audio': '오디오 가져오기', 'settings': '설정', 'say it': '말로 하기',
  'new audio track': '새 오디오 트랙', 'new bus': '새 버스', 'put in a stack': '스택에 넣기', 'take the stack apart': '스택 풀기', 'open, close a stack': '스택 열기, 닫기',
  'duplicate with what is on it': '담긴 것까지 복제', 'with what is on it': '담긴 것까지', 'on the same track': '같은 트랙에',
  'delete the track': '트랙 삭제', 'delete, regions first': '삭제, 리전 먼저', 'delete the empty ones': '빈 트랙 삭제', 'delete the one here': '여기 있는 것 삭제', 'delete the pressed one': '누른 것 삭제',
  'group, ungroup': '그룹, 그룹 해제', 'groups off, on': '그룹 끄기, 켜기',
  'new marker at the playhead': '플레이헤드에 새 마커', 'a marker here': '여기에 마커', 'delete the marker': '마커 삭제',
  'cycle it': '사이클로', 'cycle this part': '이 파트를 사이클로', 'round what is chosen': '선택한 것을 사이클로', 'goes round': '반복 재생',
  'repeat this part': '이 파트 반복', 'repeat the cycle': '사이클 반복', 'cut the cycle out': '사이클 구간 잘라내기', 'cut it out of the song': '곡에서 잘라내기',
  'make room at the cycle': '사이클 자리에 빈 구간 만들기', 'put it in at the playhead': '플레이헤드에 넣기', 'move it earlier': '앞으로 옮기기', 'move it later': '뒤로 옮기기',
  'at the cycle’s ends': '사이클 양 끝에서', 'inside the cycle': '사이클 안', 'zoom to it': '거기로 확대',
  'by a bar': '한 마디씩', 'by a beat': '한 박씩', 'by a sixteenth': '16분음표씩', 'by a tick': '한 틱씩', 'by ten ticks': '열 틱씩', 'by a sample': '한 샘플씩',
  'earlier, later': '앞으로, 뒤로', 'shorter, longer': '짧게, 길게', 'twice as long, half': '두 배로, 절반으로', 'on, back by its length': '길이만큼 앞으로, 뒤로',
  'the first, the last': '처음, 마지막', 'the last, the next': '이전, 다음', 'the next, the last': '다음, 이전', 'against the last, the next': '이전 것, 다음 것에 붙이기',
  'all that follow': '뒤따르는 모두', 'the others': '나머지', 'the muted ones': '뮤트된 것', 'one more': '하나 더', 'choose several': '여러 개 선택', 'and choose the next': '그리고 다음 것 선택',
  'for what is chosen': '선택한 것에', 'play what is chosen': '선택한 것 재생', 'find the playhead': '플레이헤드 찾기', 'find what is chosen': '선택한 것 찾기',
  'fit, or what is chosen': '전체 보기, 또는 선택한 것', 'taller, shorter rows': '줄 높게, 낮게', 'taller, lower waveforms': '파형 크게, 작게',
  'add': '추가', 'remove': '제거', 'sure?': '정말?', 'bypass': '바이패스', 'wet only': '웨트만', 'off': '끔', 'blends': '섞음', 'adds': '더함', 'amount': '양', 'nothing on this patch yet': '이 패치에는 아직 아무것도 없습니다', 'the wall is full': '벽이 가득 찼습니다', 'left out': '빠짐', 'threshold': '스레숄드', 'depth': '깊이', 'drive': '드라이브', 'hold': '홀드', 'keep': '남김', 'pass': '패스', 'slope': '기울기', 'moves': '움직임', 'decay': '길이', 'feedback': '피드백', 'step': '스텝', 'scale': '스케일', 'interval': '음정', 'cents': '센트', 'engine': '엔진', 'size': '크기', 'spray': '퍼짐', 'scatter': '흩음', 'freeze': '프리즈', 'ratio': '비율', 'attack': '어택', 'release': '릴리즈', 'knee': '니', 'makeup': '메이크업', 'from': '부터', 'learn': '학습', 'smooth': '부드럽게', 'bands': '밴드', 'blur': '번짐', 'clock': '클럭', 'feel': '느낌', 'detector': '디텍터', 'phase': '위상', 'slur': 'slur',
  'before its fader': '페이더 앞', 'stacks do not go deeper than that': '스택은 그보다 깊이 들어가지 않습니다',
  'sounds # of #': '소리 # / #', 'plug-ins # of #': '플러그인 # / #', 'getting ready': '준비 중', 'sounds': '소리',
  'printing the mix': '믹스 프린트 중', 'printing stems': '스템 프린트 중', 'bouncing': '바운스 중', 'file # of #': '파일 # / #',
  'bringing in': '가져오는 중', '# files': '파일 #개',
  'no stem is chosen': '고른 스템이 없습니다',
  'eq': 'EQ', 'dynamics': '다이내믹', 'reverb': '리버브', 'modulation': '모듈레이션', 'saturation': '새츄레이션', 'amp': '앰프', 'pitch': '피치', 'stereo': '스테레오', 'channel': '채널 스트립', 'repair': '복원', 'other': '기타', 'a page left, right': '한 화면 왼쪽, 오른쪽', 'a page up, down': '한 화면 위, 아래',
  'to the playhead': '플레이헤드로', 'to its end': '끝까지', 'to its start, its end': '시작으로, 끝으로', 'to the end of the sound': '소리 끝까지', 'back to where it starts': '시작 지점으로',
  'begin, end at the playhead': '플레이헤드에서 시작, 끝', 'in, up to the playhead': '페이드 인, 플레이헤드까지', 'out, from the playhead': '페이드 아웃, 플레이헤드부터',
  'fill': '채우기', 'fill to the next': '다음 것까지 채우기', 'follow the tempo': '템포 따라가기', 'fit to the tempo': '템포에 맞추기', 'tempo from the file': '파일의 템포로',
  'a transient on, back': '트랜지언트 다음, 이전', 'flex view': '플렉스 보기', 'next parameter': '다음 파라미터',
  'close plug-in windows': '플러그인 창 닫기', 'a plug-in off, on': '플러그인 끄기, 켜기', 'its key': '단축키', 'on, off': '켜기, 끄기', 'change': '바꾸기',

  /* the page the app opens on */
  'projects': '프로젝트', 'new project': '새 프로젝트', 'open from disk': '디스크에서 열기', 'find a project': '프로젝트 찾기', 'tempo or key': '템포 또는 키',
  'length': '길이', 'on disk': '디스크', 'empty': '비어 있음', 'yesterday': '어제', 'audio settings': '오디오 설정', 'creating': '만드는 중', 'opening': '여는 중',
  'band': '밴드', 'voice and guitar': '보컬과 기타', 'mixing': '믹싱', '# gb free': '# gb 남음',
  '# jan': '1월 #일', '# feb': '2월 #일', '# mar': '3월 #일', '# apr': '4월 #일', '# may': '5월 #일', '# jun': '6월 #일', '# jul': '7월 #일', '# aug': '8월 #일', '# sep': '9월 #일', '# oct': '10월 #일', '# nov': '11월 #일', '# dec': '12월 #일',
  'jan #': '#년 1월', 'feb #': '#년 2월', 'mar #': '#년 3월', 'apr #': '#년 4월', 'may #': '#년 5월', 'jun #': '#년 6월', 'jul #': '#년 7월', 'aug #': '#년 8월', 'sep #': '#년 9월', 'oct #': '#년 10월', 'nov #': '#년 11월', 'dec #': '#년 12월',

  /* the question asked when the app is closed with the song changed */
  'save before closing?': '닫기 전에 저장할까요?', 'don’t save': '저장 안 함', 'cancel': '취소',
  'last saved #': '마지막 저장 #', 'not saved since it was made': '만든 뒤로 저장한 적 없음', 'not saved since it was opened #': '# 에 연 뒤로 저장 안 함', 'could not be written': '저장하지 못함',

  /* the list over the command line: what kind of thing a row is */
  'plug-in': '플러그인', 'marker': '마커',
  'the cycle': '지금 사이클', 'from bar # on': '#마디부터 끝까지', 'then the last bar': '끝 마디를 이어서', 'how much': '값',
  'over the stretch': '구간에 걸쳐', 'for the stretch': '구간 동안만',

  /* the settings window */
  'general': '일반', 'recording': '녹음', 'editing': '편집', 'plug-ins': '플러그인', 'command line': '명령줄', 'storage': '저장 공간',
  'language': '언어', 'device': '장치', 'what comes in': '들어오는 소리', 'listen': '듣기', 'time': '시간', 'latency': '지연 시간',
  'low latency': '저지연', 'skipped · # ms': '건너뜀 · # ms', 'low latency off': '저지연 꺼짐', 'low latency: # stepped past': '저지연: #개 건너뜀', 'low latency: nothing to step past': '저지연: 건너뛸 것 없음',
  'in # ms': '입력 # ms', 'out # ms': '출력 # ms', 'there and back # ms': '왕복 # ms', 'samples': '샘플',
  'work': '처리', 'threads': '스레드', 'test tone': '테스트 톤', 'play': '재생',
  'not while a take or a print is under way': '녹음이나 바운스 중에는 바꿀 수 없음', 'that could not be set': '설정하지 못함', 'the input would not open': '입력을 열지 못함',
  'the check leaves the machine’s device as it is': '점검 중에는 장치를 그대로 둠',
  /* a patch kept as a preset (preset.js) */
  'saved as': '저장됨:', 'a file of that name is there': '같은 이름의 파일이 있음',
  /* the meter (meternode.js, meterface.js): the words of loudness stay as engineers say them */
  'meter': '미터', 'the wave as it came': '들어온 파형', 'short term over it': '위의 선은 short term', 'how loud': '라우드니스', 'against the aim': '목표 대비', 'measured for': '측정 시간',
  'each side': '좌우', 'rms, peak, held': 'rms, 피크, 홀드', 'crest': '크레스트', 'the stereo picture': '스테레오', 'correlation': '상관도', 'mono safe': '모노 안전', 'goes under 0': '0 아래로 내려감',
  'never under 0 in': '0 아래로 내려간 적 없음, 측정', 'lowest': '최저', 'aim': '목표', 'listening': '듣는 중', 'this meter is not on the wall any more': '이 미터는 이제 패치에 없음',
  /* the side (side.js) */
  'side': '사이드', 'nothing': '없음', 'the side plays nothing': '사이드: 없음', 'that track is fed by this one': '그 트랙은 이 트랙을 거쳐 옴', 'that track is not there': '그 트랙이 없음', 'not while it prints': '바운스 중에는 안 됨',
  /* macros (macro.js) */
  'macros': '매크로', 'none yet': '아직 없음', 'not wired': '연결 안 됨', 'find a control': '노브 찾기', 'asking the plug-in': '플러그인에 묻는 중', 'none by that name': '그 이름은 없음', 'it has no controls to turn': '돌릴 수 있는 노브가 없음', '# controls': '노브 #개', 'macro': '매크로',
  'untitled': '이름 없음', 'initial': '초기 상태', 'no presets yet': '아직 프리셋 없음', 'save as…': '다른 이름으로 저장…', 'open…': '열기…',
  'that is not a patch': '패치 파일이 아님', 'that preset is not there any more': '그 프리셋은 이제 없음', 'the preset could not be written': '프리셋을 쓰지 못함',
  'one thing this wall has no print for was left out': '이 패치에 없는 프린트 하나는 빠짐', '# things this wall has no print for were left out': '이 패치에 없는 프린트 #개는 빠짐',
}
/* settings > display (look.js, display.js): every part of the room and every quality of it */
Object.assign(LANG.lists.ko, {
  'display': '디스플레이', 'find a part': '부분 찾기', 'keep as…': '이름 붙여 간직…', 'open…': '열기…', 'share…': '공유…',
  'look': '모습', 'as it comes': '처음 그대로', 'one change': '1곳 바뀜', '# changes': '#곳 바뀜', 'kept as': '간직함:', 'written': '파일로 씀',
  'that file holds no look': '모습이 담긴 파일이 아님', 'a colour is written #rrggbb': '색은 #rrggbb로 씀',
  'the window': '창', 'its tones': '바탕 톤', 'every page of the room': '방의 모든 페이지', 'ground': '바탕', 'the walls, the heads, the bars': '벽, 트랙 헤드, 마디 줄',
  'raised': '올라온 면', 'the top bar, the foot, menus': '위 막대, 아래 줄, 메뉴', 'a control at rest': '가만히 있는 컨트롤', 'a control under the hand': '손이 닿은 컨트롤',
  'deepest': '가장 깊은 면', 'the lanes, the patch': '레인, 패치', 'ink': '잉크', 'every word and mark': '모든 글자와 표시', 'words and marks': '글자와 표시',
  'lines between': '사이의 선', 'the ink': '잉크대로', 'their strength': '선의 세기',
  'the bars and the playhead': '마디 줄과 플레이헤드', 'the bars': '마디 줄', 'the bars over the lanes': '레인 위의 마디 줄', 'the window’s ground': '창 바탕대로', 'numbers': '숫자',
  'the playhead': '플레이헤드', 'in every song': '모든 곡에서', 'width': '굵기', 'the cycle': '사이클', 'while it is on': '켜져 있을 때', 'solo’s': '솔로 색대로',
  'tracks’ heads': '트랙 헤드', 'a head': '헤드', 'every track': '모든 트랙', 'its colour, down the edge': '가장자리의 트랙 색', 'number': '번호', 'name': '이름',
  'the chosen head': '고른 헤드', 'the track that is chosen': '고른 트랙', 'wash': '물들임',
  'the lanes': '레인', 'under every track': '모든 트랙 아래', 'every other lane': '한 줄 걸러 레인', 'the chosen lane': '고른 레인', 'the grid': '그리드',
  'bars and beats down the lanes': '레인을 따라 내려오는 마디와 박', 'strength': '세기', 'where the song ends': '곡이 끝나는 곳',
  'a region': '리전 하나', 'every region in every song': '모든 곡의 모든 리전', 'body': '몸', 'fill': '채움', 'its family’s': '가족 색대로', 'or one colour for all': '또는 모두 한 색',
  'edge': '테두리', 'edge width': '테두리 굵기', 'corners': '모서리', 'shape by instrument': '악기별 모양', 'gap from the lane’s edge': '레인 가장자리와의 간격',
  'its sound': '소리', 'the sound drawn on a region': '리전에 그려진 소리', 'deep of its fill': '채움의 짙은 색대로', 'drawn': '그리는 법', 'filled': '채움', 'line': '선', 'half': '반쪽',
  'its name': '이름', 'the name on a region': '리전 위의 이름', 'weight': '두께', 'where': '위치', 'inside': '안쪽',
  'a region’s fades': '리전의 페이드', 'ink or dark, by its fill': '채움에 따라 잉크나 어둠', 'shade': '그늘', 'when chosen': '골랐을 때', 'a region that is chosen': '고른 리전',
  'its fill, lighter': '더 밝은 채움', 'the families': '가족', 'its tracks, deep to light': '트랙들, 짙은 쪽에서 밝은 쪽으로', 'deep end': '짙은 끝', 'light end': '밝은 끝', 'every bus': '모든 버스',
  'meanings': '뜻', 'what a colour means': '색의 뜻', 'wherever it is shown': '보이는 모든 곳', 'listening to the input': '입력 듣기', 'a level': '레벨',
  'the panel': '패널', 'slur, beside the lanes': '레인 옆의 slur', 'its look': '모습', 'by the ground': '바탕에 따라', 'dark': '어둡게', 'light': '밝게',
  'light when the ground is lighter than': '바탕이 이보다 밝으면 밝게', 'on': '켬',
})
/* the Mac's menu bar (menus.js), as the Mac writes its menus in Korean: 파일, 편집, 보기, 윈도우, 도움말 */
LANG.menuKo = {
  'Settings': '설정', 'General': '일반', 'Display': '디스플레이', 'Audio': '오디오', 'Key Commands': '단축키',
  'File': '파일', 'New': '새로 만들기', 'Open…': '열기…', 'Open Recent': '최근 사용 열기', 'No Projects Yet': '아직 프로젝트 없음', 'More…': '더 보기…',
  'Save': '저장', 'Save As…': '다른 이름으로 저장…', 'Rename…': '이름 변경…', 'Revert To…': '이전 버전으로 되돌리기…', 'Import Audio…': '오디오 가져오기…',
  'Hand Off…': '내보내기…', 'Hand Off Stems…': '스템 내보내기…', 'Bounce in Place': '제자리 바운스', 'Bounce in Place in Realtime': '실시간으로 제자리 바운스',
  'Edit': '편집', 'Undo': '실행 취소', 'Redo': '실행 복귀', 'Cut': '오려두기', 'Copy': '복사하기', 'Paste': '붙여넣기', 'Delete': '삭제', 'Select All': '전체 선택',
  'Select': '선택', 'None': '선택 해제', 'Invert': '선택 반전', 'All Following': '뒤따르는 모든 리전', 'All Following on the Same Track': '같은 트랙에서 뒤따르는 모든 리전',
  'Inside the Cycle': '사이클 안의 리전', 'Muted Regions': '뮤트된 리전', 'Previous Region': '이전 리전', 'Next Region': '다음 리전', 'Add Previous Region': '이전 리전 추가',
  'Add Next Region': '다음 리전 추가', 'First Region': '첫 리전', 'Last Region': '마지막 리전', 'Previous Track': '이전 트랙', 'Next Track': '다음 트랙',
  'Split at Playhead': '플레이헤드에서 나누기', 'Split at Cycle Ends': '사이클 끝에서 나누기', 'Join': '합치기', 'Repeat': '반복',
  'Cut Section Between Locators': '로케이터 사이 구간 잘라내기', 'Insert Silence at Locators': '로케이터에 무음 넣기', 'Insert Section at Playhead': '플레이헤드에 구간 넣기', 'Repeat Section Between Locators': '로케이터 사이 구간 반복',
  'Region': '리전', 'Mute': '뮤트', 'Move to Playhead': '플레이헤드로 옮기기', 'Move to Playhead and Select Next': '플레이헤드로 옮기고 다음 선택', 'Loop to the Next Region': '다음 리전까지 루프',
  'Trim Start to Playhead': '시작을 플레이헤드까지 자르기', 'Trim End to Playhead': '끝을 플레이헤드까지 자르기', 'Shuffle Left': '왼쪽으로 셔플', 'Shuffle Right': '오른쪽으로 셔플',
  'Gain': '게인', 'Up 1 dB': '1 dB 올리기', 'Down 1 dB': '1 dB 내리기', 'Up 0.1 dB': '0.1 dB 올리기', 'Down 0.1 dB': '0.1 dB 내리기', 'Back to 0 dB': '0 dB로 되돌리기',
  'Transpose': '트랜스포즈', 'Up a Semitone': '반음 올리기', 'Down a Semitone': '반음 내리기', 'Up an Octave': '옥타브 올리기', 'Down an Octave': '옥타브 내리기',
  'Fine Tune Up 10 Cents': '미세 조정 10센트 올리기', 'Fine Tune Down 10 Cents': '미세 조정 10센트 내리기', 'Back to the Original Pitch': '원래 음높이로 되돌리기', 'Reverse': '리버스',
  'Fades': '페이드', 'Fades for Selection': '선택한 리전에 페이드', 'Fade In up to the Playhead': '플레이헤드까지 페이드 인', 'Fade Out from the Playhead': '플레이헤드부터 페이드 아웃',
  'Nudge': '넛지', 'Earlier': '앞으로', 'Later': '뒤로', 'Shorter': '짧게', 'Longer': '길게',
  'Tempo': '템포', 'Follow the Tempo': '템포 따라가기', 'Fit Region to Project Tempo': '리전을 프로젝트 템포에 맞추기', 'Set Project Tempo from Region': '리전에서 프로젝트 템포 가져오기',
  'Quantize': '퀀타이즈', 'Undo Quantize': '퀀타이즈 해제', 'Strip Silence': '무음 걷어내기', 'Group': '그룹', 'Ungroup': '그룹 해제', 'Colour and Outline…': '색과 모양…',
  'Track': '트랙', 'New Tracks…': '새 트랙…', 'New Audio Track': '새 오디오 트랙', 'New Instrument Track': '새 악기 트랙', 'New Bus': '새 버스',
  'Duplicate': '복제', 'Duplicate with Its Regions': '리전까지 복제', 'Delete Empty Tracks': '빈 트랙 삭제', 'Solo': '솔로', 'Record Enable': '녹음 대기', 'Hear the Input': '입력 듣기',
  'Stack': '스택', 'Make a Stack': '스택 만들기', 'Take the Stack Apart': '스택 풀기', 'Open the Stack': '스택 열기', 'Close the Stack': '스택 닫기',
  'Group for Editing': '편집 그룹 만들기', 'Suspend Groups': '그룹 잠시 끄기', 'Instruments': '악기', 'Typing Keyboard': '타이핑 키보드', 'Capture as Recording': '방금 연주를 녹음으로 담기', 'All Notes Off': '모든 노트 끄기',
  'Transport': '재생', 'Play or Stop': '재생 또는 정지', 'Play from Selection': '선택한 곳부터 재생', 'Record': '녹음', 'Discard Recording': '녹음 버리기',
  'Go to Start': '처음으로', 'Go to End of Sound': '소리 끝으로', 'Back a Bar': '한 마디 뒤로', 'Forward a Bar': '한 마디 앞으로', 'Back Eight Bars': '여덟 마디 뒤로', 'Forward Eight Bars': '여덟 마디 앞으로',
  'Previous Transient': '이전 트랜지언트', 'Next Transient': '다음 트랜지언트', 'Go to Bar…': '마디로 가기…',
  'Cycle': '사이클', 'Cycle Area': '사이클 구간', 'Set to Selection': '선택한 곳으로 정하기', 'Go to Its Start': '시작으로 가기', 'Go to Its End': '끝으로 가기',
  'Move Forward by Its Length': '길이만큼 앞으로 옮기기', 'Move Back by Its Length': '길이만큼 뒤로 옮기기', 'Twice as Long': '두 배로 늘리기', 'Half as Long': '절반으로 줄이기', 'Zoom to the Cycle': '사이클에 맞춰 확대',
  'Click': '클릭', 'Count-In': '카운트인',
  'Markers': '마커', 'Add Marker Here': '여기에 마커 추가', 'Add Marker for Selection': '선택한 곳에 마커 추가', 'Rename Marker…': '마커 이름 변경…', 'Delete Marker Here': '여기 마커 삭제',
  'Previous Marker': '이전 마커', 'Next Marker': '다음 마커', 'Cycle the Marker': '마커를 사이클로', 'Go to Marker': '마커로 가기', 'Marker #': '마커 #',
  'Tools': '도구', 'Tool': '도구', 'Pointer': '포인터', 'Smart': '스마트', 'Pencil': '연필', 'Eraser': '지우개', 'Scissors': '가위', 'Fade': '페이드', 'Marquee': '마키', 'Flex': '플렉스', 'Zoom': '확대/축소', 'Velocity': '벨로시티', 'Tool Menu': '도구 메뉴',
  'Edit Mode': '편집 모드', 'Grid': '그리드', 'Slip': '슬립', 'Shuffle': '셔플', 'Spot': '스팟', 'Slip, and Back': '슬립 켜고 끄기',
  'Nudge Value': '넛지 값', 'Bar': '마디', 'Beat': '박', '10 ticks': '10틱', 'Tick': '틱', 'Sample': '샘플', 'Quantize Value': '퀀타이즈 값', '1/8 Triplet': '1/8 셋잇단', '1/16 Triplet': '1/16 셋잇단',
  'View': '보기', 'Patch': '패치', 'Mixer': '믹서', 'Notes': '노트', 'Prompt': '프롬프트', 'Automation': '오토메이션', 'Next Automation Parameter': '다음 오토메이션 파라미터',
  'Zoom In': '확대', 'Zoom Out': '축소', 'Zoom to Fit or Selection': '전체 또는 선택한 곳에 맞추기', 'Taller Rows': '줄 높이기', 'Shorter Rows': '줄 낮추기', 'Taller Waveforms': '파형 키우기', 'Lower Waveforms': '파형 줄이기',
  'Page Left': '한 화면 왼쪽', 'Page Right': '한 화면 오른쪽', 'Page Up': '한 화면 위', 'Page Down': '한 화면 아래', 'Show the Playhead': '플레이헤드 보기', 'Show the Selection': '선택한 곳 보기',
  'Close Plug-in Windows': '플러그인 창 닫기', 'Say It': '말로 하기',
  'Window': '윈도우', 'Minimize': '최소화', 'Enter Full Screen': '전체 화면 시작', 'Help': '도움말', 'Slur Studio Help': 'Slur Studio 도움말',
  /* the app's own menu, which the Mac makes and the page names */
  'About Slur Studio': 'Slur Studio 정보', 'Settings…': '설정…', 'Services': '서비스', 'Hide Slur Studio': 'Slur Studio 가리기', 'Hide Others': '기타 가리기', 'Show All': '모두 보기', 'Quit Slur Studio': 'Slur Studio 종료',
}
/* a realtime print (realtime.js) */
Object.assign(LANG.lists.ko, {
  'bounce': '바운스', 'offline': '오프라인', 'realtime': '실시간', 'realtime bounce': '실시간 바운스', 'in place': '제자리', 'esc stops it': 'esc로 멈춤',
  '#:# of #:#': '#:# / #:#', 'realtime bounce stopped: nothing was kept': '실시간 바운스를 멈춤: 남긴 것 없음',
})
