# 버터떡 데이터 수집 프롬프트

## 개요

트렌드 디저트(버터떡) 판매 매장 데이터를 수집하고 정제하는 전체 워크플로우.
수집 → 정제 → 좌표 확보 → 클리닝 → 최종 반영의 5단계로 진행한다.

---

## 1단계: 네이버 플레이스 크롤링

### 프롬프트

```
"{지역} {키워드}" 로 네이버 플레이스 검색해서 매장 데이터를 수집해줘.
```

### 키워드 조합 예시

- `서울 버터떡`, `성남 버터떡`, `분당 버터떡`, `서현 버터떡`, `정자 버터떡`
- `선유도역 버터떡`, `강남 버터떡`, `홍대 버터떡`
- 변형: `버터모찌`, `상하이버터떡`, `버터라이스떡`

### 방식

- Playwright로 `m.place.naver.com` 모바일 검색
- 지역 중심 좌표(x, y)를 지정해서 해당 지역 결과 우선
- 검색 결과 목록에서 최대 20개 상세 페이지 방문
- 매장명, 주소, 전화번호, 영업시간, 카테고리 추출
- 이전 수집 결과와 중복 제거

### 참고 스크립트

- `scripts/crawl-naver-place-butterttuk.ts` — 상하이버터떡 키워드
- `scripts/crawl-butterttuk-bundang.ts` — 버터떡 키워드 + 블로그 통합

---

## 2단계: 네이버 블로그 크롤링

### 프롬프트

```
블로그에서도 "{키워드}" 검색해서 매장 정보를 추출해줘.
```

### 방식

- `section.blog.naver.com/Search/Post.naver` 에서 블로그 포스트 링크 수집 (3페이지, 키워드당 10개)
- 각 포스트 방문하여 매장 정보 추출:
  1. **네이버 Place OG 링크 카드** (가장 정확)
  2. **네이버 Place/Map 직접 링크**
  3. **본문 텍스트에서 주소 패턴 매칭** (fallback)
- 데스크톱 UA 사용 (블로그는 iframe 구조)

### 블로그 상세 추출 프롬프트

```
https://section.blog.naver.com/Search/Post.naver?keyword={키워드} 여기 페이지 크롤링해서 수집해봐
```

- Playwright MCP로 블로그 검색 결과 스냅샷 확인
- 제목에서 매장명 추출
- 개별 포스트 방문하여 주소, 영업시간, Place ID 등 상세 정보 확보

---

## 3단계: Google Maps 정제 (Enrich)

### 프롬프트

```
수집된 데이터를 정제해야지 (구글맵으로 가게정보를 얻고)
```

### 방식

- 매장명 + 지역으로 Google Maps 검색 (`google.com/maps/search/`)
- `waitUntil: 'domcontentloaded'` 사용 (networkidle은 timeout 발생)
- 첫 번째 결과 클릭 후 3초 대기
- 상세 패널에서 추출: 주소, 전화번호, 영업시간, 평점, 리뷰수, 카테고리
- URL에서 좌표 파싱: `!3d{lat}!4d{lng}` 패턴
- 15개마다 중간 저장 (resume 지원)

### 참고 스크립트

- `scripts/enrich-butterttuk.ts`
- `pipeline/lib/google-maps.ts` — searchGoogleMaps, parseCoordinatesFromUrl

---

## 4단계: 좌표 확보 (Geocoding)

### 프롬프트

```
좌표 없는 건 삭제하지 말고, 모두 좌표를 찾아와.
```

### 방식

- Google Maps에서 좌표 못 찾은 매장은 **Nominatim (OpenStreetMap) API** 사용
- 주소 기반 geocoding: 층수, 호수 등 제거 후 검색
- 실패 시 매장명 + 도시명으로 재시도
- Rate limit: 1.1초/요청

### 참고 스크립트

- `scripts/geocode-nominatim.ts`
- `scripts/geocode-missing.ts` (Google Maps 방식, 성공률 낮음)

---

## 5단계: 데이터 클리닝

### 프롬프트

```
기존 데이터 전면 재검토 및 최신화 한다.
```

### 클리닝 체크리스트

1. **좌표 검증**: 한국 범위 내 (lat 33~39, lng 124.5~132)
2. **주소 정규화**: 보이지 않는 유니코드 문자 제거 (`[\uE000-\uF8FF]`)
3. **역순 주소 수정**: Google Maps가 반환하는 역순 형식 → 정상 형식
4. **비관련 업종 제거**: 마트, 식당, 백화점, 학교, 스파 등
5. **이름이 지역명인 항목 제거**: "경상남도", "문정동" 등
6. **중복 제거**: 이름 기준 (lowercase trim)
7. **Google Maps 오매칭 이름 복원**: 원래 네이버 매장명으로 되돌림

### 비관련 업종 키워드 (삭제 대상)

```
이마트, 롯데백화점, 현대백화점, 신세계백화점, GS더프레시, 배스킨라빈스,
횟집, 해장국, 칼국수, 감자탕, 갈비, 순대, 족발, 닭발, 마라탕,
양꼬치, 훠궈, 스시, 마트, 전자랜드, 도서관, 초등학교, 네일, 스파,
맥도날드, 버거킹, 서브웨이, ...
```

---

## 6단계: 최종 반영

### 프롬프트

```
데이터 반영해줘.
```

### 방식

```bash
npx tsx pipeline/stage5-finalize.ts --product "버터떡" --output "../data/shops.json"
npx next build
```

- `enriched-shops.json` → `data/shops.json` 변환
- 지역 정규화 (서울특별시 → 서울)
- ID 부여, 지역/이름순 정렬
- Next.js 빌드로 정적 페이지 생성

---

## 데이터 파일 구조

```
pipeline/data/
  enriched-shops.json    ← 정제된 매장 데이터 (source of truth)

data/
  shops.json             ← 프론트엔드용 최종 데이터 (stage5 출력)
  products.ts            ← 상품 정의 (slug, name, keywords)

lib/
  data.ts                ← 프론트엔드 데이터 로딩
```

## EnrichedShop 스키마

```typescript
{
  name: string          // 매장명
  address: string       // 전체 주소
  phone: string         // 전화번호
  hours: string         // 영업시간
  category: string      // 카테고리 (베이커리, 카페 등)
  rating: string        // Google Maps 평점
  reviewCount: string   // 리뷰 수
  lat: number | null    // 위도
  lng: number | null    // 경도
  description: string   // 설명
  source: string        // 출처 (naver-place, blog-oglink, blog-text 등)
}
```

---

---

## 추가 크롤링 소스 (미구현)

### A. 카카오맵 검색

```
카카오맵에서 "{지역} 버터떡" 검색해서 매장 수집해줘.
```

- `map.kakao.com` 키워드 검색
- 네이버 플레이스에 없는 매장 발견 가능
- 카카오 자체 평점/리뷰 데이터 확보
- 좌표가 바로 제공되어 geocoding 불필요

### B. 카카오맵 웹 크롤링

```
카카오맵에서 "{지역} 버터떡" 검색해서 매장 수집해줘.
```

- Playwright로 `map.kakao.com` 키워드 검색 (API 키 불필요)
- 검색 결과 리스트에서 매장명, 주소, 카테고리 추출
- 좌표가 페이지 내 data 속성 또는 URL에 포함 → geocoding 불필요
- 네이버 플레이스에 없는 매장 발견 가능

### C. Google Maps 웹 크롤링

```
구글맵에서 "{지역} 버터떡" 검색해서 결과 수집해줘.
```

- Playwright로 `google.com/maps/search/` 결과 크롤링 (API 키 불필요)
- 검색 결과 목록을 순회하며 각 매장 클릭 → 상세 정보 추출
- 좌표가 URL에 포함 (`!3d{lat}!4d{lng}`) → 수집+enrichment 동시 처리
- 평점, 리뷰수, 카테고리 동시 확보

### D. 유튜브 웹 크롤링

```
유튜브에서 "버터떡 파는곳" 검색해서 영상 설명란에서 매장 정보 추출해줘.
```

- Playwright로 `youtube.com/results?search_query=` 검색 (API 키 불필요)
- 상위 영상 10~20개 방문 → 설명란에서 매장명, 주소, 네이버맵 링크 추출
- 맛집 유튜버 영상에 매장 정보가 정리되어 있는 경우 많음
- 주소/Place 링크가 있으면 정확도 높음

### E. 네이버 카페 웹 크롤링

```
네이버 카페에서 "버터떡 파는곳" 검색해서 매장 정보 추출해줘.
```

- `search.naver.com/search.naver?where=article&query=` 통합검색 카페탭 크롤링
- 게시글 방문 → 블로그와 동일한 방식으로 Place 링크/주소 추출
- 지역 맘카페, 맛집 카페에서 실사용자 후기 기반 매장 발견
- 신규 오픈 매장 정보가 블로그보다 빠르게 올라옴

### F. 네이버 통합검색 크롤링

```
네이버에서 "버터떡 파는곳" 통합검색해서 플레이스 결과 수집해줘.
```

- `search.naver.com` 통합검색 → "장소" 섹션에서 매장 리스트 추출
- 네이버 플레이스 직접 검색과 다른 결과가 나올 수 있음
- Place ID가 포함되어 상세 페이지 직접 접근 가능

---

## 크롤링 소스별 비교

> 모든 방식은 Playwright 웹 크롤링 기반, API 키/비용 없음

| 소스 | 정확도 | 커버리지 | 좌표 확보 | 구현 난이도 |
|------|--------|----------|-----------|-------------|
| 네이버 플레이스 | ★★★★★ | 높음 | 별도 필요 | 낮음 |
| 네이버 블로그 | ★★★☆☆ | 중간 | 별도 필요 | 중간 |
| 카카오맵 | ★★★★★ | 높음 | 바로 확보 | 낮음 |
| Google Maps | ★★★★☆ | 중간 | 바로 확보 | 낮음 |
| 유튜브 | ★★☆☆☆ | 낮음 | 별도 필요 | 중간 |
| 네이버 카페 | ★★☆☆☆ | 중간 | 별도 필요 | 중간 |
| 네이버 통합검색 | ★★★★☆ | 높음 | 별도 필요 | 낮음 |

### 추천 우선순위

1. **카카오맵** — 좌표 바로 확보, 네이버와 교차 검증
2. **Google Maps 직접 검색** — 수집+enrichment 동시 처리
3. **네이버 통합검색** — 플레이스 직접 검색과 다른 결과 발견
4. **유튜브/카페** — 보조 수단, 최신 매장 발견

---

## 수집 팁

- **키워드는 구체적일수록 좋다**: "서현 버터떡" > "경기 버터떡"
- **네이버 플레이스가 가장 정확**: OG 링크 카드가 있는 블로그가 그다음
- **Google Maps enrichment는 이름 오매칭이 빈번**: 반드시 이름 복원 필요
- **Nominatim은 주소 geocoding에 효과적**: Google Maps보다 성공률 높음
- **보이지 않는 유니코드 문자 주의**: Google Maps 주소에 Private Use Area 문자가 섞임
- **비관련 업종 필터는 수동 검토 필수**: 자동 필터 후에도 눈으로 확인해야 함
