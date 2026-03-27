# Pipeline Agent Team

이 문서는 Claude Code Agent Team이 데이터 수집 파이프라인을 실행하는 방법을 정의합니다.

## IMPORTANT: Product Name

**Coordinator는 사용자 요청에서 제품명을 추출하여 `--product` 인자로 전달해야 합니다.**
절대 하드코딩된 제품명을 사용하지 마세요.

예시:
- 사용자: "버터떡 데이터 수집해줘" → `--product "버터떡"`
- 사용자: "촉촉한황치즈칩 매장 찾아줘" → `--product "촉촉한황치즈칩"`
- 사용자: "두쫀쿠 파이프라인 돌려줘" → `--product "두쫀쿠"`

아래 모든 커맨드에서 `{product}`는 사용자가 요청한 제품명으로 대체합니다.

## Pipeline Flow

```
Stage 1: 키워드 생성 (fast)
    ↓
Stage 2: 네이버 블로그 크롤링 — 가게 발견 (discovery)
    ↓
Stage 3: 데이터 정제 + 중복제거
    ↓
Stage 4: 카카오맵 + 구글맵 보강 — 가게 상세정보 (enrichment) ← 병렬 Agent Team
    ↓
Stage 5: 최종 스키마 생성
```

**핵심 원칙:**
- **Discovery (발견)**: 네이버 블로그만 사용. 블로그 포스트에서 가게 이름/주소를 추출
- **Enrichment (보강)**: 카카오맵, 구글맵으로 발견된 가게의 상세정보 조회
- **Naver Maps는 사용 불가** — headless 크롤링 차단됨 (테스트 완료)

## Team Structure

```
Coordinator (main Claude Code session)
├── Stage 1: keyword-generator     (inline, fast)
├── Stage 2: blog-crawler          (sequential, main discovery)
├── Stage 3: data-cleaner          (inline, fast)
├── Stage 4: enrichment team       (PARALLEL Agent Team)
│   ├── Agent: kakao-enricher      → 카카오맵에서 가게 상세정보 조회
│   └── Agent: google-enricher     → 구글맵에서 평점/좌표 조회
└── Stage 5: finalizer             (inline, fast)
```

## Execution Protocol

### Phase 1: Keyword Generation (inline)

```bash
npx tsx pipeline-v2/stage1-keywords.ts --product "{product}"
```

### Phase 2: Blog Crawling — Discovery (sequential)

```bash
npx tsx pipeline-v2/stage2-crawl.ts --product "{product}"
```

- 네이버 블로그 검색 → 포스트 방문 → 가게 정보 추출
- 추출 전략 (confidence 순):
  1. SmartEditor 지도 블록 (0.95) — 이름 + 주소 + GPS 좌표
  2. Naver Place 링크 (0.85) — 가게 이름
  3. 텍스트 분석 + 주소 근접성 (0.60) — 주소 주변에서 가게명 추론
  4. 제목 키워드 추출 (0.40) — 블로그 제목에서 가게명

### Phase 3: Data Cleaning (inline)

```bash
npx tsx pipeline-v2/stage3-clean.ts
```

### Phase 4: Map Enrichment (PARALLEL Agent Team)

이 단계에서 **카카오맵과 구글맵을 병렬 Agent로 실행**하여 성능을 높입니다.

전체 실행 (순차):
```bash
npx tsx pipeline-v2/stage4-enrich.ts
```

**Agent Team 병렬 실행 패턴:**

Stage 4를 Agent Team으로 분할할 때, Coordinator가 직접 enrichment를 오케스트레이션합니다:

```
1. cleaned-shops.json 로드
2. 병렬 Agent dispatch:
   Agent A: 카카오맵 enrichment (주소, 전화, 영업시간, 카테고리)
   Agent B: 구글맵 enrichment (평점, 리뷰수, 좌표)
3. 두 Agent 결과를 merge
4. Nominatim fallback으로 좌표 없는 가게 보충
5. enriched-shops.json 저장
```

**주의사항:**
- `networkidle` 사용 금지 — 무한 대기 발생
- 20개마다 checkpoint 자동 저장
- 카카오맵은 가게 이름 + 주소 힌트로 검색 (정확도 향상)

### Phase 5: Finalize (inline)

```bash
npx tsx pipeline-v2/stage5-finalize.ts --output "../data/shops.json"
```

## Agent Dispatch Pattern for Claude Code

```
0. 사용자 요청에서 제품명(product) 추출
1. Coordinator가 Stage 1 실행 (inline): --product "{product}"
2. Coordinator가 Stage 2 실행 (blog crawling): --product "{product}"
3. Coordinator가 Stage 3 실행 (inline)
4. Stage 4 병렬 enrichment:
   - Agent(prompt="카카오맵으로 cleaned-shops.json의 가게 정보를 enrichment해줘")
   - Agent(prompt="구글맵으로 cleaned-shops.json의 가게 좌표/평점을 enrichment해줘")
   → 결과 merge 후 Nominatim fallback
5. Coordinator가 Stage 5 실행 (inline)
```

## Error Handling

| 상황 | 대응 |
|------|------|
| 블로그 크롤링 실패 | 에러 로그 후 수집된 데이터로 계속 |
| 카카오맵 응답 없음 | 해당 가게 스킵, 구글맵으로 보완 |
| 구글맵 응답 없음 | Nominatim fallback 사용 |
| networkidle 타임아웃 | 발생 불가 — domcontentloaded만 사용 |
| Stage 4 중간 실패 | checkpoint에서 수동 재시작 가능 |

## Config Override

```bash
# 제품명은 항상 사용자 요청에서 추출하여 --product로 전달
npx tsx pipeline-v2/run.ts --product "{product}"

# 출력 경로 변경 시
npx tsx pipeline-v2/run.ts --product "{product}" --output "../data/custom-output.json"
```
