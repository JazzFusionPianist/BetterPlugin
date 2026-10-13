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
  'region': '리전', 'regions': '리전', 'gain': '게인', 'transpose': '트랜스포즈', 'fade': '페이드', 'fades': '페이드',
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
  'in # ms': '입력 # ms', 'out # ms': '출력 # ms', 'there and back # ms': '왕복 # ms', 'samples': '샘플',
  'work': '처리', 'threads': '스레드', 'test tone': '테스트 톤', 'play': '재생',
  'not while a take or a print is under way': '녹음이나 바운스 중에는 바꿀 수 없음', 'that could not be set': '설정하지 못함', 'the input would not open': '입력을 열지 못함',
  'the check leaves the machine’s device as it is': '점검 중에는 장치를 그대로 둠',
  /* a patch kept as a preset (preset.js) */
  'saved as': '저장됨:', 'a file of that name is there': '같은 이름의 파일이 있음',
  'untitled': '이름 없음', 'initial': '초기 상태', 'no presets yet': '아직 프리셋 없음', 'save as…': '다른 이름으로 저장…', 'open…': '열기…',
  'that is not a patch': '패치 파일이 아님', 'that preset is not there any more': '그 프리셋은 이제 없음', 'the preset could not be written': '프리셋을 쓰지 못함',
  'one thing this wall has no print for was left out': '이 패치에 없는 프린트 하나는 빠짐', '# things this wall has no print for were left out': '이 패치에 없는 프린트 #개는 빠짐',
}
