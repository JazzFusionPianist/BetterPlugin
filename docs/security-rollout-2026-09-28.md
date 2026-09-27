# Slur 보안 운영 적용 기록 — 2026-09-28 KST

전체 보안 릴리스는 미완료다. 아래 두 추가 마이그레이션만 이번에 운영 적용했다.
채팅 E2EE, 비공개 파일 API, 라이브 보호, 새 클라이언트는 아직 운영 배포하지 않았다.

## 이번에 운영 적용한 변경

대상 Supabase 프로젝트: `svhjgiloekkjrcefclqs`.

- `20260927181510_security_avatar_ownership`: 타인 아바타 경로에 업로드·덮어쓰기·삭제를
  막고 본인의 경로만 허용. 기존 웹 그룹 사진 경로 `groups/<conversation-id>/...`는
  현재 관리자에게만 쓰기 허용. 이미지 종류와 10 MiB 업로드 제한 적용.
- `20260927181602_security_internal_function_permissions`: 트리거 전용 함수
  `enforce_group_member_cap`, `rls_auto_enable`의 공개·일반 사용자 직접 실행 권한 회수.
  `poker_deal_hand` 익명 실행 회수, 로그인 사용자 호출은 기존 호스트 검사 유지.
  게임 방 갱신 함수 5개의 search_path를 빈 값으로 고정.
- 기존 `20260923185345_security_admin_roles` 적용 상태 확인.

마이그레이션 파일 이름을 운영이 발급한 버전에 맞췄다. 미적용 files_and_access의
아바타 DELETE 정책 생성 전에 DROP IF EXISTS를 추가하여 선적용과 충돌하지 않게 했다.
전체 릴리스 시 적용 이력을 기준으로 누락된 파일만 순서대로 적용해야 한다.
원격에는 로컬보다 뒤 버전의 호환 수정이 먼저 적용되어 있으므로 무작정 db push하지 않는다.

## 검증

- 기존 아바타 18개 모두 사용자 ID 경로와 소유자 일치 확인. 사용자 파일 내용은 읽지 않음.
- `pnpm test:security`: 13개 통과. 타인 아바타 생성/덮어쓰기/경로 재할당/삭제 거부,
  그룹 관리자 업로드 허용, 일반 멤버·외부인·퇴장 관리자 거부 시나리오 추가.
- 권한을 회수해도 DB 트리거가 계속 작동하는 회귀 테스트 통과.
- 적용 후 운영 pg_policies, proconfig, has_function_privilege와 마이그레이션 이력 재조회.
  함수 검색 경로 경고 5건 제거 확인. 실제 사용자 UI의 로그인·업로드는 아직 미검증.

## 배포 차단 원인

- Vercel 연결의 팀 ID는 로컬 연결 정보와 일치하지만 프로젝트 목록은 0개.
- get_project는 내부 `idOrName` 입력 규격 오류로 실패. 권한 오류라고 단정하지 않음.
- Vercel CLI 60.1.3 `whoami`: Logged out.
- 운영 대시보드는 로그인 페이지로 이동. Codex 브라우저에 로그인 화면을 열고 사용자에게
  프로젝트 보유 계정 로그인을 요청했다. 인증키·비밀번호를 채팅에 요청하지 않았다.
- R2 서버 자격증명·비공개 버킷·TURN·정리 작업 설정에 접근하지 못해 검증/배포 불가.

새 클라이언트 없이 E2EE 강제 정책만 적용하면 구형 Slur의 메시지 전송이 실패한다.
따라서 나머지 강제 정책은 API·웹·설치 플러그인을 함께 전환할 때 적용한다.
설치된 Slur에 보안 변경을 통합하는 작업도 남아 있다. 이전 로그인 수정만 설치된 상태와
이번 DB 변경을 전체 제품 배포 완료로 혼동하지 않는다.

## 남은 운영 점검

Supabase advisors 재검사에서 다음이 남아 있다. 알림 개수는 취약점 확정 개수가 아니다.

- [유출 비밀번호 검사](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): 비활성화 상태. Auth 설정 접근 및 플랜 지원 확인 필요.
- [공개 스키마 확장](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public): pg_net 1건. 확장 이동 가능 여부와 기존 예약 작업 의존성 확인 필요.
- [익명 SECURITY DEFINER 호출](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable): 4건. 공개 재생 집계·회원가입 이름 확인 및 권한 조회 helper가 포함됨.
- [로그인 사용자 SECURITY DEFINER 호출](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): 9건. 서버에서 권한을 검사하는 관리자 RPC 등 의도한 진입점이 포함됨.
- [RLS 정책 없음](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): private 관리자 원장/감사 테이블 2건은 클라이언트 직접 접근을 막는 의도된 설정.

전체 전환 절차와 암호화의 미구현 범위(전방향 안전성, 기기별 폐기 등)는
`security-implementation-2026-09-24.md`에 기록되어 있다.
