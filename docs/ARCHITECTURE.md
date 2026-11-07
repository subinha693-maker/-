# 통합인류행정부 — 아키텍처 (PHASE 1 기준)

## 기술 스택
- TypeScript + React 19 + Vite, 상태 관리 zustand
- 모바일 대응: 1080 논리 높이 고정 스테이지(폭 1920~2400 가변)를 화면에 맞춰 균일 확대/축소, 세로 화면에서는 회전 안내, PWA manifest(가로·전체화면)
- 전투/지도 렌더링에 PixiJS는 PHASE 7에서 필요 시 도입 (현재 미설치)

## 폴더 구조
| 경로 | 역할 |
|---|---|
| `src/core` | 타입(`types.ts`), 설정 로더, 새 게임 상태 생성, 게임 시간, zustand 게임 스토어, 화면 라우터 |
| `src/config` | 규칙·밸런스 설정값 (`game.json`, `balance.json`). 미확정 값은 `_placeholders`/`_placeholder`로 표시 |
| `src/data` | 콘텐츠 정의 JSON + `index.ts`(조회·무결성 검사) |
| `src/systems` | 정부 운영·연구·모집·원정·전투 시스템 (PHASE 4~) |
| `src/save` | 세이브/로드 (PHASE 2) |
| `src/tutorial` | 튜토리얼 진행 로직 (PHASE 3) |
| `src/ui/components` | 공통 컴포넌트 (Stage, Panel, Button, Tabs, Modal, TopBar, BaseView, CharacterArt, Icon) |
| `src/ui/screens` | 화면 14종 + 개발용 화면 목록 |
| `src/styles` | 디자인 토큰, 공통/화면 스타일 |
| `public/assets` | 가공된 에셋 (캐릭터 webp, Kenney 렌더 스프라이트, 아이콘) |
| `tools/render-kenney` | Kenney GLB → 아이소메트릭 2D 스프라이트 렌더/색보정 도구 |
| `tests` | Playwright E2E (`phase1.e2e.cjs`) |

## 핵심 규칙
1. 저장 대상 상태는 모두 `GameState` 하나에 있으며 정의 데이터는 ID로만 참조한다.
2. 수치·규칙은 코드에 하드코딩하지 않고 `config`/`data`에 둔다.
3. 아직 구현되지 않은 버튼은 비활성화하고 `PHASE n 예정` 태그를 붙인다.
4. 사용자가 확정하지 않은 콘텐츠(시설·연구 항목, 난이도 수치, 대사 등)는 `(임시)`/`미정`으로 화면에 드러낸다.

## 확정된 설정 (사용자 결정)
- 모바일 구동 지원 / 제공 에셋 활용
- 전투: 두 개의 진입로(1열·2열), 각 최대 4명
- 게임 시간: 실시간 1초 = 게임 10분 (`config/game.json` `time.gameMinutesPerRealSecond`)
- 전투 중 저장 불가, 로드 시 전투 시작 직전으로 복귀 (`battle.saveDuringBattle: false`)
- 비서 NPC 이름: 아일라 / 캐릭터 이름: 시온 시라유코, 제임스 해럴드, 아이온, 링, 제라그, 마일리 스니커
