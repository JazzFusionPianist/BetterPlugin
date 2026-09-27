# Slur 보안 운영 적용 기록 — 2026-09-28 KST

**전체 전환은 아직 미완료다.** 새 서버·웹은 운영 환경으로 빌드했지만 서비스 주소로
승격하지 않았다. 새 Slur 설치본도 서버/DB와 함께 전환하기 위해 아직 설치하지 않았다.
현재 중단 지점은 기존 R2 서버 키에 새 비공개 버킷을 허용하는 변경의 사용자 승인이다.

## 운영 적용 완료

Supabase 프로젝트 `svhjgiloekkjrcefclqs`:

- 기존 `20260923185345_security_admin_roles` 적용 확인.
- `20260927181510_security_avatar_ownership`: 자신의 아바타 경로만 쓰기·삭제 허용.
  그룹 사진은 현재 그룹 관리자만 변경. 이미지 형식 및 10 MiB 제한.
- `20260927181602_security_internal_function_permissions`: 내부 트리거 함수 직접
  실행 권한 회수, poker_deal_hand 익명 실행 회수, 게임 함수 5개 search_path 고정.

Cloudflare:

- 비공개 `slur-private-files` 버킷 생성(APAC, Standard). 공개 r2.dev 및 custom domain 없음.
- CORS 저장 결과 확인: plugin/web 운영 주소, juce://juce.backend, capacitor://localhost;
  GET/HEAD/PUT, Content-Type/If-None-Match/Range. 공개 읽기 권한을 만들지 않는다.
- 기존 coop-chat-attachments는 공개 포트폴리오와 구형 첨부파일이 섞여 있으므로
  비공개 파일 분류·이전 전까지 설정을 유지했다. 38개 / 약398 MB 관찰.

Vercel better-plugin 운영/preview 환경:

- 서버 전용 SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET 설정.
- CLOUDFLARE_R2_PRIVATE_BUCKET 설정. 기존 R2/TURN 자격증명은 유지.
- 비밀값을 클라이언트 환경변수·Git·출력에 넣지 않았다.

## 통합 및 검증

- 최신 origin/main 92742b0 기반 managed worktree, branch codex/slur-security-release.
  원래 frontend 작업의 무관한 지역/트랙 내보내기 변경은 포함하지 않았다.
- 최신 StudioShell/LivePane과 네이티브 carried UI를 유지하면서 보안 코드를 통합했다.
- 보안 회귀 테스트 **14개 통과**, plugin/web TypeScript 통과.
- plugin Vite 및 web Next 빌드 통과, pnpm production dependency audit 취약점 0개.
- 기존 기록 전환에서 처음 10개의 실패 기록 때문에 뒤 기록이 영구적으로 막히는 문제 수정.
  커서가 다음 기록으로 이동하고 한 바퀴 뒤 실패 기록을 다시 시도하는 회귀 테스트 추가.
- 테스트 계정 3개를 관리자 API로 생성해 실제 비밀번호 로그인 성공 확인.
  이는 사용자의 기존 계정 또는 DAW 화면에서의 로그인 성공을 대신하지 않는다.
- Slur 1.0.18 AU/VST3 universal(arm64/x86_64) 빌드 준비. Xcode27 환경 때문에 이 로컬
  빌드는 macOS12 이상 대상; 기본 스크립트의 기존 macOS11 대상은 유지했다.
  AAX는 이번 보안 릴리스로 빌드·설치하지 않았다.

## 배포 및 실제 차단 사유

Vercel CLI 인증 완료. 연결 도구의 잘못된 빈 목록 응답은 CLI로 해결했다.
커밋 작성자 이메일과 배포 계정 이메일이 달라 처음 배포가 BLOCKED였다.
실제 인증된 사용자 계정 이메일로 릴리스 커밋을 만든 뒤 빌드가 READY가 됐다.

서버 readiness 결과: authentication=true, privateStorage=false.
Cloudflare 토큰 화면에서 기존 coop-chat-uploader의 적용 범위가
coop-chat-attachments 한 곳인 것을 확인했다.

해결할 변경은 해당 키의 Object Read & Write 범위에 slur-private-files를 추가하는 것이다.
관리자 권한이나 다른 버킷 권한을 추가하지 않는다. 저장 직전까지 준비했고,
브라우저 도구의 보안상 접근 확대 확인 규칙에 따라 사용자에게 승인을 요청했다.
승인 없이 저장하지 않았다.

## 다음 전환 순서

1. 승인된 R2 토큰 범위 변경 저장, readiness의 privateStorage=true 확인.
2. 검증된 staged plugin/web 빌드와 설치본을 함께 준비.
3. 아직 미적용인 security_files_and_access부터 security_legacy_storage까지 7개
   마이그레이션을 순서대로 적용. 이미 적용된 3개를 중복 실행하지 않는다.
4. 별도 테스트 계정으로 E2EE 전송·평문 거부·비공개 파일 업로드/서명 다운로드·
   CORS·파일 변조·탈퇴·라이브 초대/강퇴·TURN 접근을 검증한다.
5. parse-schedule / cleanup-attachments 함수와 정리 작업 비밀값을 반영한다.
6. staged 배포를 운영 도메인으로 승격, 백업 후 AU/VST3 설치. 열린 DAW를 강제 종료하지 않는다.
7. 기존 공개 R2의 private 참조만 분류 후 비공개 복사/검증/DB 전환/공개 원본 제거.
   구형 Supabase attachments는 준비된 비공개 정책과 서명 경로로 전환한다.
8. 사용자가 복구 키를 설정한 뒤 이전 평문 기록을 본인 기기에서 암호화한다.

새 클라이언트 없이 E2EE 강제 정책만 먼저 적용하면 구형 Slur가 메시지를 보내지 못하므로,
현재는 기존 서비스 주소와 기존 설치본을 유지한다.

## 남은 보안 범위

현재 E2EE는 계정 복구 키 + libsodium의 메시지/파일 암호화다.
Double Ratchet/전방향 안전성, 기기별 키와 선택적 기기 폐기, 독립 암호 검토는 미완료다.
이전 평문 기록/백업은 자동으로 E2EE가 되지 않는다. 라이브 미디어는 WebRTC 보안과
인증된 입장/시그널/TURN 권한을 사용하며, 라이브 채팅은 E2EE 대상이 아니다.
장시간 TURN 갱신, SFU 확장, 운영 경보와 복구 훈련도 별도 검증이 필요하다.

Supabase advisor에서 유출 비밀번호 검사 비활성화, pg_net 공개 스키마,
일부 SECURITY DEFINER API 및 의도적으로 정책이 없는 private 테이블 경고가 남아 있다.
코드 수정만으로 모든 보안 또는 법적 준수 완료를 선언하지 않는다.
