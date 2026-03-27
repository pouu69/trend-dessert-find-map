# Pipeline Agent Team

이 문서는 Claude Code Agent Team이 데이터 수집 파이프라인을 실행하는 방법을 정의합니다.

## Team Structure

```
Coordinator (main Claude Code session)
├── Agent: keyword-generator     → Stage 1 (sequential, fast)
├── Agent: naver-blog-crawler    → Stage 2a (parallel)
├── Agent: naver-maps-crawler    → Stage 2b (parallel)
├── Agent: kakao-maps-crawler    → Stage 2c (parallel)
├── Agent: data-cleaner          → Stage 3 (sequential, after Stage 2)
├── Agent: enricher              → Stage 4 (sequential, slow)
└── Agent: finalizer             → Stage 5 (sequential, fast)
```

## Execution Protocol

### Phase 1: Keyword Generation (Sequential)

```bash
npx tsx pipeline-v2/stage1-keywords.ts --product "상하이버터떡"
```

Output: `pipeline-v2/data/keywords.json`

### Phase 2: Parallel Crawling (3 Agents in Parallel)

Stage 2의 3개 크롤러는 **독립적**이므로 반드시 병렬로 실행합니다.

**Agent 1 — Naver Blog Crawler:**
```bash
npx tsx pipeline-v2/crawlers/naver-blog.ts --product "상하이버터떡"
```

**Agent 2 — Naver Maps Crawler:**
```bash
npx tsx pipeline-v2/crawlers/naver-maps.ts --product "상하이버터떡"
```

**Agent 3 — Kakao Maps Crawler:**
```bash
npx tsx pipeline-v2/crawlers/kakao-maps.ts --product "상하이버터떡"
```

각 크롤러는 실패해도 다른 크롤러에 영향 없음.
결과는 `stage2-crawl.ts`가 합칩니다:

```bash
npx tsx pipeline-v2/stage2-crawl.ts --product "상하이버터떡"
```

### Phase 3: Data Cleaning (Sequential)

```bash
npx tsx pipeline-v2/stage3-clean.ts
```

Input: `pipeline-v2/data/raw-shops.json`
Output: `pipeline-v2/data/cleaned-shops.json`

### Phase 4: Enrichment (Sequential, Long-running)

```bash
npx tsx pipeline-v2/stage4-enrich.ts
```

- Google Maps 보강 + Nominatim 좌표 fallback
- **주의**: `networkidle` 사용 금지 — 무한 대기 발생
- 20개마다 checkpoint 자동 저장
- Input: `pipeline-v2/data/cleaned-shops.json`
- Output: `pipeline-v2/data/enriched-shops.json`

### Phase 5: Finalize (Sequential)

```bash
npx tsx pipeline-v2/stage5-finalize.ts --output "../data/shops.json"
```

Output: `data/shops.json` (프론트엔드 소비용)

## Agent Dispatch Pattern for Claude Code

Claude Code에서 이 파이프라인을 Agent Team으로 실행하려면:

```
1. Coordinator가 Stage 1 실행 (inline, 빠름)
2. 3개 Agent를 parallel로 dispatch:
   - Agent(subagent_type="general-purpose", prompt="Run: npx tsx pipeline-v2/crawlers/naver-blog.ts ...")
   - Agent(subagent_type="general-purpose", prompt="Run: npx tsx pipeline-v2/crawlers/naver-maps.ts ...")
   - Agent(subagent_type="general-purpose", prompt="Run: npx tsx pipeline-v2/crawlers/kakao-maps.ts ...")
3. 모든 Agent 완료 후, Coordinator가 Stage 2 merge 실행
4. Stage 3 → 4 → 5 순차 실행
```

## Error Handling

| 상황 | 대응 |
|------|------|
| 크롤러 하나가 실패 | 나머지 크롤러 결과로 계속 진행 |
| Google Maps 응답 없음 | Nominatim fallback 사용 |
| networkidle 타임아웃 | 발생 불가 — domcontentloaded만 사용 |
| 전체 Stage 실패 | 해당 Stage에서 중단, 에러 로그 출력 |
| Stage 4 중간 실패 | checkpoint에서 수동 재시작 가능 |

## Config Override

```bash
# 다른 제품으로 실행
npx tsx pipeline-v2/run.ts --product "촉촉한황치즈칩" --output "../data/chokchokhan.json"

# pipeline.config.json의 sources 필드로 크롤러 선택
# "sources": ["naver-blog"]  ← 네이버 블로그만 실행
```
