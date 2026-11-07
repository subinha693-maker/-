# 통합인류행정부 (UNIFIED HUMAN ADMINISTRATION)

정부 운영 + 로그라이크 원정 게임. 현재 PHASE 1(기본 프로젝트 및 UI) 완료 상태.

```bash
npm install
npm run dev        # 개발 서버 (같은 네트워크의 휴대폰에서도 접속 가능: --host)
npm run build      # dist/ 정적 빌드
node tests/phase1.e2e.cjs <screenshot-dir> http://localhost:4173/   # vite preview 실행 후 E2E
```

구조와 원칙은 `docs/ARCHITECTURE.md` 참고. 에셋 출처: Kenney (CC0), Wenrexa 아이콘/UI 팩(라이선스 확인 필요), 사용자 제공 캐릭터 일러스트.
