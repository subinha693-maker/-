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

## 세이브/로드 (PHASE 2)
- 슬롯: 수동 3개(확정) + 자동 저장 1개. 저장소 키 `uha.save.<slot>`, 백업 `.bak`, 임시 `.tmp`
- 안전 저장 순서: `.tmp` 기록 → 다시 읽어 검증 → 기존 본을 `.bak`으로 보관 → 본 슬롯 기록 → `.tmp` 삭제. 시작 시 `recoverInterrupted()`가 중단된 쓰기를 정리
- 로드 검사 순서: JSON 형식 → 저장 포맷 → 체크섬(cyrb53) → 버전(새 버전 거부 / 구버전은 `migrations.ts`로 단계별 변환, 경로 없으면 호환 불가) → 내용 검증(`validate.ts`, 알 수 없는 시설·부대원·연구, 중복 유물 등)
- 손상된 슬롯은 로드를 막고 사유를 표시하며, 정상 백업이 있으면 "백업으로 복구" 제공
- 자동 저장: `core/events.ts` 이벤트(원정 시작·종료, 전투 진입, 시설·연구 완료, 스토리, 튜토리얼 단계, 게임 시간 경과)를 `save/autosave.ts`가 받아 저장. 같은 시점의 요청은 1회로 병합, 전투 중에는 저장하지 않음. 트리거별 사용 여부는 `config/game.json` `save.autosave`
- 전투 중 저장 불가. 전투 진입 직전 자동 저장 → 로드 시 원정 지도(전투 직전)로 복귀
- 프로필(`uha.profile`): 최초 실행 여부, 마지막 슬롯, 사운드 설정. 세이브 슬롯과 별도 보관
- 저장소는 `StorageAdapter` 인터페이스 뒤에 있어 앱 포장 시 파일 저장 방식으로 교체 가능
