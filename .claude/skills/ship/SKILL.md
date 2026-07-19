---
name: ship
description: 검증→커밋→푸시→(요청 시)PR·머지→브랜치 재동기화 리추얼. "커밋해줘", "머지해줘", "푸시해줘" 및 모든 구현 작업의 마무리 단계에 사용.
---

# /ship — 검증·커밋·푸시·머지 리추얼

이 저장소의 git 흐름은 정해져 있다: 작업 브랜치(`claude/...`) → 스쿼시 머지 → main.
스쿼시 머지 특성상 **머지 후 브랜치 재동기화를 빼먹으면 다음 푸시가 반드시 꼬인다.**

## 트리거
- "커밋해줘", "푸시해줘", "머지해줘", "PR 올려줘", 구현 작업 완료 시점

## 입력
- 변경 사항 (working tree), 커밋 메시지 소재(무엇을 왜)

## 단계
1. **검증 체인** (건너뛰기 금지):
   `npx tsc --noEmit` → 변경 파일만 `npx eslint <files>` → `npm run build` → `npx vitest run`
   - 전체 eslint는 기존 경고 28건이 있어 실패한다. 변경/신규 파일만 돌릴 것.
2. **커밋**: 한국어 제목(무엇을 왜) + 본문에 항목별 요약. 모델 ID를 커밋에 넣지 말 것.
3. **푸시**: `git push -u origin <branch>`.
   - non-fast-forward 거절 시: 원격 커밋들이 이미 main에 스쿼시 머지된 이력인지 확인
     (`git merge-base --is-ancestor <sha> origin/main`) → 맞으면 `--force-with-lease`, 아니면 rebase.
4. **PR은 사용자가 요청할 때만** 생성. 본문은 항목별 변경 요약 + 수동 조치.
5. **머지 요청 시**: 스쿼시 머지 → 즉시 브랜치 재동기화:
   `git fetch origin main && git checkout -B <branch> origin/main && git push -u origin <branch> --force-with-lease`
6. **충돌하는 후속 커밋**이 브랜치에 있으면: main 기준으로 `checkout -B` 후 해당 커밋만 `git cherry-pick`.

## 출력
- 커밋 해시 + 푸시/머지 상태 + (있으면) 사용자 수동 조치 안내

## 주의
- 테스트 실패·빌드 실패 상태로 커밋하지 않는다. 실패는 출력 그대로 보고.
- 시크릿 값(.env, serviceKey)은 커밋·응답 어디에도 노출 금지.
- `data/stores/*.json` 같은 압축 포맷 파일은 JSON.stringify 재직렬화 금지 — 문자열 치환으로 최소 diff.
