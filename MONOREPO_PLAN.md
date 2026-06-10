# Monorepo 전환 계획 + 공유 경계

> plugin / web / mobile / marketing을 한 repo에서 굴리기 위한 구조 전환 문서.
> 공유 코드는 한 곳에서 고치면 셋 다 자동 적용된다.

## 1. 목표 구조

```
betterplugin/
├── apps/
│   ├── plugin/        # JUCE WebView 안에서 도는 React 앱 (현재 src/)
│   ├── web/           # 풀-피쳐 웹 앱 (app.betterplugin.com)
│   ├── marketing/     # 랜딩/가입/다운로드 (Next.js, betterplugin.com)
│   └── mobile/        # Capacitor wrap (iOS/Android)
├── packages/
│   ├── ui/            # 공유 React 컴포넌트
│   ├── hooks/         # 공유 hooks (데이터 레이어)
│   ├── lib/           # supabase client, 헬퍼
│   └── types/         # 공유 타입
├── supabase/migrations/   # 그대로
└── Plugin/                # JUCE 네이티브 — 손 안 댐 (동업자 영역)
```

빌드 도구: **pnpm workspaces + Turborepo**

## 2. 핵심 원칙

> **`packages/` 안의 코드는 절대 JUCE 모듈을 직접 import하지 않는다.**

플랫폼 고유 동작(drag-to-DAW, 화면 캡처 등)은 "어댑터"로 주입한다.
plugin은 JUCE 구현을 주입하고, web/mobile은 안 주입하면 그 기능이 자연히 사라진다.

## 3. 공유 경계 (3 Tier)

### Tier 1 — 순수 공유 (`packages/`, 기계적 이동, 손 안 댐)

JUCE를 전혀 모르는 코드. plugin/web/mobile 셋 다 동일하게 사용. **약 90%.**

**Data 레이어:**
- `types/collab.ts`, `types/live.ts`
- `lib/supabase.ts`, `conversations.ts`, `gameRooms.ts`, `earTraining.ts`, `webrtc.ts`
- `hooks/`: useMessages, useConversations, useConversationNotifications,
  useConversationReads, useFollows, useFriends, useProfiles, usePresence,
  useGameRoom, usePokerRoom, useFallingBlocksRoom, useEarTrainingRoom,
  useChess, usePoker, useFallingBlocks, useLive, useLiveChat,
  useLinkPreview, useTurnSound

**UI 레이어:**
- `components/collab/`: ConversationsPanel, ProfilePanel, FriendsList,
  ChessView, PokerView, FallingBlocksView, EarTrainingView, GameListView,
  HoverTooltip, InformationPanel, AddFriendPanel, NewGroupPanel,
  ChatSettingsPanel, SettingsPanel, DisplayPanel, LanguagePanel,
  LivePanel, LiveChat, LinkPreviewCard
- `components/`: FloatingOrbs, LoginForm, SignUpForm
- `i18n/`: 전부

### Tier 2 — 어댑터 필요 (공유하되 플랫폼 동작 주입)

| 파일 | 섞인 JUCE 동작 | 분리 방법 | plugin | web | mobile |
|---|---|---|---|---|---|
| **ChatView** | drag-to-DAW | `onDragAudioToDaw?` prop 주입 | DAW로 드래그 | 기능 없음 | 기능 없음 |
| **linkify** | openExternal | 이미 `window.open` degrade — 거의 그대로 | 네이티브 브라우저 | 새 탭 | 시스템 브라우저 |
| **useMediaSource** | DAW 윈도우 화면 캡처 | 캡처 소스 어댑터 | DAW 윈도우 | `getDisplayMedia` | 카메라/ReplayKit |
| **LiveViewer** | 플러그인 창 리사이즈 | resize 콜백 주입(no-op 가능) | 창 확대 | CSS 확대 | 풀스크린 |

**어댑터 패턴 예시 (drag-to-DAW):**

```tsx
// packages/ui/ChatView.tsx — JUCE 모름
interface ChatViewProps {
  onDragAudioToDaw?: (url: string) => void   // 없으면 drag UI 자체가 안 뜸
}

// apps/plugin/ — JUCE 구현 주입
<ChatView onDragAudioToDaw={(url) => callJuceNative('dragExport', [url])} />

// apps/web/, apps/mobile/ — 안 줌 → 기능 자동 소멸
<ChatView />
```

### Tier 3 — Plugin 전용 (`apps/plugin/`에만 존재)

JUCE 네이티브와 직접 통신. web/mobile엔 아예 없음.
- `lib/`: juceBridge.ts, dawAudio.ts, nativeVideo.ts, pluginWindow.ts, pastePolyfill.ts
- ChatView의 drag-to-DAW 구현부
- useMediaSource의 native window capture 구현부

## 4. 기능별 플랫폼 매트릭스

| 기능 | plugin | web | mobile | 비고 |
|---|---|---|---|---|
| 채팅 (DM/그룹) | ✅ | ✅ | ✅ | Tier 1 |
| 친구/팔로우 | ✅ | ✅ | ✅ | Tier 1 |
| 게임 4종 | ✅ | ✅ | ✅ | Tier 1 (전부 공유) |
| Live 방송 | DAW 화면 | 브라우저 화면 | 카메라/ReplayKit | Tier 2 어댑터 |
| drag-to-DAW | ✅ | ✗ | ✗ | plugin 전용 |
| 캘린더 | ✗ | ✅ | ✅ | 신규 (Phase 2) |
| 음악 커뮤니티 | ✗ | ✅ | ✅ | 신규 (Phase 2) |

> ⚠️ 모바일 Live: iOS Safari는 `getDisplayMedia` 화면공유 미지원.
> 모바일은 화면공유 대신 카메라 스트리밍이 현실적. (Phase 3에서 확정)

## 5. 전환 작업량

| Tier | 파일 수 | 작업 |
|---|---|---|
| 1 (순수 공유) | ~50 | `packages/`로 이동 + import 경로 수정 (기계적) |
| 2 (어댑터) | 4 | JUCE 부분 prop 추출 (반나절) |
| 3 (plugin 전용) | 6 | `apps/plugin/`에 남김 |

**총 소요: 반나절 ~ 하루.**

## 6. 동업자 합의 사항

1. **타이밍**: 전환(반나절) 동안 plugin push 잠깐 멈춤. 끝나면 새 구조 pull 후 재개.
   - 전환 후엔 멈춤 없음. 공유 코드 한 번 고치면 셋 다 자동 적용.
2. **JUCE 코드(`Plugin/`)는 손 안 댐** — 동업자 영역.
3. **빌드**: Vercel + GitHub Actions 설정은 전환하는 쪽이 수정. CMakeLists는 React 코드 경로(`apps/plugin/`)만 바뀜 — 동업자 확인 필요.
4. **명령어**: npm → pnpm. `pnpm --filter plugin dev`. 학습 5분.
5. **영역**: plugin = 동업자 / web·mobile·marketing = 너 / 공유 packages = 둘 다.
   공유 코드 만질 땐 서로 알림.
6. **검증**: 전환 PR merge 전, 동업자가 plugin 빌드 한 번 돌려 OK 확인.

## 7. 일상 워크플로우 (전환 후)

```bash
pnpm install                  # root에서 한 번
pnpm --filter plugin dev      # plugin만
pnpm --filter web dev         # web만
pnpm --filter marketing dev   # marketing만
```

**충돌 규칙은 지금과 동일** — 두 사람이 *같은 파일*을 동시에 수정할 때만 충돌.
다른 app / 다른 파일을 만지면 충돌 없음.

## 8. 로드맵

| Phase | 기간 | 작업 |
|---|---|---|
| 0. 인프라 | 반나절~1일 | monorepo 전환 (이 문서) |
| 1. 마케팅 | 2-3주 | Next.js 랜딩 + 가입 + 다운로드 + waitlist |
| 2. 웹 본체 | 4-6주 | web 분리 + 캘린더 + 음악 커뮤니티 |
| 3. 모바일 | 4-6주 | Capacitor wrap + 스토어 제출 |
| 4. plugin 통합 | 동업자 작업과 병행 | 동업자 plugin이 공유 packages 쓰게 정리 |
