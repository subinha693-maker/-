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

## 튜토리얼 (PHASE 3)
- 대본: `src/data/tutorial.json` (10단계, 줄 단위). 줄마다 `target`(강조할 `data-tut` 앵커), `await`(클릭/신호 대기), `pose`(전신 일러스트)를 지정
- 진행: `src/tutorial/controller.ts` — 시작/다음 줄/단계 완료/건너뛰기/이어하기. 단계 완료마다 `tutorial:step` 이벤트 → 자동 저장
- 화면: `src/tutorial/TutorialHost.tsx` — 강조 영역만 뚫린 차단막(설명 중에는 강조 영역도 클릭 불가, 행동 유도 시에만 열림), 타자기 효과, 단계·대화 진행 표시, 건너뛰기 확인
- 최초 실행: 프로필 `firstRun` + 저장 데이터 없음 → 새 게임 시 안내/건너뛰기 선택. 설정에서 "튜토리얼 다시 보기"
- 이어하기: 저장된 `tutorial.step`의 `startScreen`부터 재개. 원정·전투 안내(8·9단계)는 원정 상태를 만들지 않는 훈련 모드 지도/전투 화면 사용
- 비서 NPC 아일라: 성격 확정(활발, 분위기 메이커, 친화력), 대사는 초안(`_draftDialogue: true`)

## 정부 운영 (PHASE 4)
- 시간: `core/loop.ts` — 실시간 1초 = 게임 10분 × 배속(x1/x2/x4), 일시정지. 튜토리얼·전투 중·타이틀에서는 정지. 백그라운드 복귀 시 최대 5초분만 따라잡음
- 경제: `systems/economy.ts`(순수 함수) — 시설 가동률 = 인력 충원율 × 정비 상태 계수 × 투입 자원 충족률. 생산·소비·전력은 게임 1시간 기준. 인구는 식량을 소비. 자원은 0 아래로 내려가지 않음
- 행동: `systems/government.ts` — 인력 배치(인력 유형별 한도), 운영 중지/재개, 정비, 업그레이드, 건설(빈 칸 자동 배치), 연구 시작(비용 선지불). 실패 시 사유 반환
- 공사·연구는 게임 시간으로 진행되고 완료 시 `facility:complete`/`research:complete` 이벤트 → 알림 + 자동 저장
- 경고: `systems/alerts.ts` — 자원 고갈 예상, 자원 부족 가동 저하, 인력 미배치, 정비 필요, 연구 정지
- 모든 수치(시설 목록, 인력, 생산·소비량, 전력, 비용, 공사 시간, 정비 비용, 인구 식량 소비, 연구 비용·시간)는 임시값: `data/facilities.json`, `data/research.json`, `config/balance.json`
- 세이브 호환: 시설에 `job`(공사 정보) 선택 필드 추가. 이전 세이브도 그대로 불러올 수 있음(버전 변경 없음)

## 개척부대 (PHASE 5)
- 캐릭터 확정 정보(`data/characters.json`): 이름(국/영), 무기, 전문 분야, 출신, 능력치 경향성(등급 문자), 고유 스킬명·설명. 미정: 등급, 수치 능력치, 기본 공격, 특성 내용, 스토리
- 초기 6명은 배포 요원(새 게임 시 지급). ID: shion_shirayuko, james_harold, aion, ring, jerag, miley_sneaker
- 육성(`systems/growth.ts`, `config/growth.json`): 숙련도 레벨(상한 = 등급 상한 + 작전 경력서/실무 훈장 확장), 스킬 레벨(인사 공적), 특성 슬롯(고유=인사 공적, 패시브=Phase 2, 궁극 전술=Phase 3), 전문가 등급 승급 Phase 1→2(레벨 + 국가 공인 직무 인증서)→3(레벨 + 고난도 원정 완료 + 특수 부토스 생체시료·유물 잔재), 등급별 장비 슬롯. 숫자는 모두 임시
- 레벨을 얻는 방법은 미정 → "기본 훈련(임시)"로 대체
- 재화(`data/items.json`): 인사 공적(요원별), 국가 공인 직무 인증서(행정·무장·방호 연구 완료 시 지급, 임시 매핑), 특수 부토스 생체시료·유물 잔재·작전 경력서·실무 훈장(원정 보상, PHASE 6/8에서 지급)
- 이력서 확인(`systems/recruit.ts`, `config/recruit.json`): 지원서 검토 → 신규면 편입, 보유 요원이면 그 요원의 인사 공적으로 전환. 모집 대상·확률·비용·천장은 미정(시험용 설정)
- 세이브 버전 2: 캐릭터 ID 변경(ling→ring, zerag→jerag), 요원 육성 필드, 재화, 모집 기록 추가. v1 세이브는 자동 변환
