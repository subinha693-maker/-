# 통합인류행정부 (UNIFIED HUMAN ADMINISTRATION)

정부 운영 + 로그라이크 원정 게임. PHASE 1~9 구현 완료(지역 탈환 1~6단계 포함). 콘텐츠 상당수는 임시 데이터.

```bash
npm install
npm run dev        # 개발 서버 (같은 네트워크의 휴대폰에서도 접속 가능: --host)
npm run build      # dist/ 정적 빌드
npm test           # 세이브 시스템 단위 테스트
node tests/phase1.e2e.cjs <dir>; node tests/phase2.e2e.cjs <dir>; node tests/phase3.e2e.cjs <dir>; node tests/phase4.e2e.cjs <dir>; node tests/phase5.e2e.cjs <dir>; node tests/phase6.e2e.cjs <dir>; node tests/phase7.e2e.cjs <dir>; node tests/region2.e2e.cjs <dir>; node tests/region3.e2e.cjs <dir>; node tests/region4.e2e.cjs <dir>; node tests/region5.e2e.cjs <dir>; node tests/region6.e2e.cjs <dir>   # vite preview 실행 후 E2E
```

구조와 원칙은 `docs/ARCHITECTURE.md` 참고. 에셋 출처: Kenney (CC0), Wenrexa 아이콘/UI 팩(라이선스 확인 필요), 사용자 제공 캐릭터 일러스트.
