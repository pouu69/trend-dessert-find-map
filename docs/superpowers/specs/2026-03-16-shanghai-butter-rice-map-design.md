# 상하이버터떡 맵 서비스 - 디자인 스펙

## 개요

한국에서 유행하는 "상하이버터떡"을 판매하는 곳을 큐레이팅하는 맵 서비스. 소비자가 주변 판매처를 쉽게 찾고, 즐겨찾기로 저장할 수 있는 PC 웹 서비스.

**Phase 1 범위:** 소비자용 기능만 (사업자 자가 등록은 Phase 2)

## 기술 스택

- **프론트엔드:** React + Vite + TypeScript
- **지도:** OpenStreetMap + Leaflet (react-leaflet)
- **스타일링:** Tailwind CSS (커스텀 테마)
- **데이터:** JSON 정적 파일 (크롤링 스크립트로 수집, 수동 CLI 실행)
- **데이터 수집:** Playwright 기반 크롤링 (API 키 불필요, 무료)
- **즐겨찾기:** localStorage (로그인 불필요)
- **배포:** Phase 1 스코프 외. 로컬 개발 환경에서 검증 후 결정

## 레이아웃

**사이드 패널 + 지도** 구조:
- 좌측 (38%): 검색/필터 + 가게 리스트 패널
- 우측 (62%): OpenStreetMap 지도
- 모바일 대응: Phase 1에서는 PC 웹에 집중. 모바일 반응형은 스코프 외

## 디자인 스타일

**클린 & 모던:**
- 베이스: 화이트 (#FAFAFA, #FFFFFF)
- 포인트 컬러: 오렌지 (#FF9500)
- 텍스트: 다크 그레이 (#1a1a1a), 서브텍스트 (#999)
- 보더/구분선: 라이트 그레이 (#F0F0F0, #eee)
- 카드: 흰색 배경, 둥근 모서리 (12px), 부드러운 그림자
- 폰트: 산세리프 시스템 폰트
- 태그: 오렌지 배경 (#FFF3E0) + 오렌지 텍스트
- 핀 마커: 오렌지 원형 + 흰색 보더 + 🧈 이모지

## 데이터 스키마

`src/data/shops.json`:
```json
[
  {
    "id": "shop-001",
    "name": "원조 상하이떡방",
    "address": "서울 종로구 ...",
    "lat": 37.5705,          // number | null (지오코딩 실패 시 null)
    "lng": 126.9780,          // number | null
    "phone": "02-1234-5678",
    "hours": "09:00-21:00",
    "closedDays": ["월요일"],
    "priceRange": "3000-5000",
    "tags": ["원조", "줄서는맛집"],
    "description": "30년 전통의 상하이버터떡 전문점",
    "region": "서울"
  }
]
```

## 프로젝트 구조

```
shanghai-butter-rice/
├── src/
│   ├── components/
│   │   ├── Header.tsx           # 상단 헤더 (로고, 즐겨찾기 탭)
│   │   ├── Map.tsx              # Leaflet 지도 컴포넌트
│   │   ├── ShopList.tsx         # 가게 리스트 패널
│   │   ├── ShopCard.tsx         # 개별 가게 카드
│   │   ├── ShopDetail.tsx       # 가게 상세 뷰
│   │   └── SearchFilter.tsx     # 검색바 + 지역 필터 태그
│   ├── hooks/
│   │   ├── useShops.ts          # 가게 데이터 로딩, 필터링, 검색
│   │   └── useFavorites.ts      # localStorage 즐겨찾기 관리
│   ├── data/
│   │   └── shops.json           # 가게 데이터
│   ├── types/
│   │   └── shop.ts              # Shop 타입 정의
│   ├── App.tsx                  # 메인 레이아웃 (헤더 + 사이드패널 + 지도)
│   └── main.tsx                 # 엔트리포인트
├── public/
├── scripts/
│   └── collect-data.ts        # 데이터 수집 스크립트 (CLI)
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## 데이터 수집 (scripts/collect-data.ts)

Playwright 기반 브라우저 크롤링으로 상하이버터떡 판매처 데이터를 수집하는 CLI 스크립트. API 키 불필요.

**수집 소스 & 방법:**
1. **네이버 지도**: Playwright로 네이버 지도 페이지 열기 → "상하이버터떡" 검색 → 검색 결과 리스트에서 가게명, 주소, 전화번호, 영업시간, 카테고리 스크래핑
2. **카카오맵**: Playwright로 카카오맵 페이지 열기 → 같은 키워드 검색 → 결과 스크래핑

**수집 흐름:**
1. 네이버 지도에서 검색 결과 전체 페이지 순회하며 수집
2. 카카오맵에서 동일하게 수집
3. 가게명 + 주소 기준으로 중복 제거 (정규화 후 문자열 비교)
4. 두 소스 데이터를 병합 (네이버 우선, 카카오에서 보완)
5. 주소 → 위경도 변환: Nominatim API (OpenStreetMap 무료 지오코딩, API 키 불필요)
6. `src/data/shops.json`에 출력

**실행 방법:**
```bash
npm run collect-data
# → src/data/shops.json 생성/업데이트
```

**기술 구현:**
- `playwright`: 네이버 지도, 카카오맵 브라우저 자동화 크롤링
- Nominatim API: 주소 → 위경도 변환 (무료, rate limit 1req/sec → 요청 간 1초 딜레이 적용)
- 수집된 데이터를 Shop 스키마에 맞게 정규화
- 기존 shops.json이 있으면 merge (신규 추가 + 기존 데이터 보존)
- 중복 판별: 가게명 정규화(공백/특수문자 제거) AND 주소 시/구/동 모두 일치해야 중복으로 판단

**에러 처리:**
- 개별 가게 수집 실패 시: warning 로그 후 해당 가게 건너뛰고 계속 진행
- 전체 소스 접근 불가 시 (DOM 구조 변경 등): 에러 메시지 출력 후 종료, 기존 shops.json 보존
- Nominatim 지오코딩 실패 시: lat/lng을 null로 설정, 지도에 미표시하되 리스트에는 표시

**API 키:** 불필요. 모든 수집이 브라우저 크롤링 + 무료 Nominatim API로 동작

**지역(region) 값:** 주소에서 시/도 단위로 추출 (예: "서울", "경기", "부산"). 필터 태그는 shops.json의 region 고유값에서 동적 생성

## 핵심 기능 상세

### 1. 지도 (Map.tsx)
- react-leaflet로 OpenStreetMap 렌더링
- 커스텀 마커: 오렌지 원형 + 🧈 이모지
- 마커 클릭 → 사이드 리스트가 해당 카드로 스크롤 + 하이라이트
- 초기 중심: 서울 (37.5665, 126.9780), 줌 레벨 11
- 지도 영역 변경 시 `onMoveEnd` 이벤트로 visible shops 업데이트

### 2. 가게 리스트 (ShopList.tsx + ShopCard.tsx)
- 필터링/검색 결과에 따른 가게 카드 리스트
- 카드 구성: 가게명, 주소, 태그, 즐겨찾기 버튼
- 카드 hover → 해당 지도 마커 하이라이트
- 카드 클릭 → ShopDetail 확장 뷰
- 현재 지도 영역 내 가게만 표시 (지도 연동)

### 3. 검색/필터 (SearchFilter.tsx)
- 텍스트 검색: 가게명, 주소 대상 (debounced)
- 지역 필터: 태그 형태 (shops.json의 region 고유값에서 동적 생성)
- 필터 변경 → 지도 핀 + 리스트 즉시 업데이트

### 4. 즐겨찾기 (useFavorites.ts)
- localStorage에 가게 ID 배열 저장
- ShopCard에 하트 아이콘 → 토글
- 헤더의 "즐겨찾기" 탭 클릭 → 저장된 가게만 리스트에 표시

### 5. 가게 상세 (ShopDetail.tsx)
- 사이드 패널 내에서 확장 (리스트 대체)
- 표시 정보: 이름, 주소, 전화번호, 영업시간, 휴무일, 가격대, 설명
- 뒤로가기 버튼 → 리스트로 복귀
- 해당 가게 위치로 지도 센터링

## 인터랙션 흐름

1. **초기 로드**: 전체 가게가 지도 핀 + 리스트에 표시
2. **검색/필터**: 결과에 맞는 가게만 표시, 지도 자동 fit bounds
3. **카드 hover**: 대응하는 지도 마커 하이라이트 (크기 확대 + 색상 진하게)
4. **마커 클릭**: 사이드 리스트가 해당 카드로 스크롤 + 하이라이트
5. **카드 클릭**: 상세 뷰 전환 + 지도 해당 위치로 센터링
6. **즐겨찾기 토글**: 하트 아이콘 클릭으로 저장/삭제
7. **지도 이동/줌**: 보이는 영역 내 가게만 리스트에 표시

## 핵심 라이브러리

- `react` + `react-dom`: UI 프레임워크
- `react-leaflet` + `leaflet`: OpenStreetMap 지도
- `tailwindcss`: 스타일링
- `typescript`: 타입 안전성
- `playwright`: 네이버 지도/카카오맵 크롤링 (devDependency)

## 검증 방법

**데이터 수집:**
1. `npm run collect-data` 실행 (API 키 불필요)
2. `src/data/shops.json`에 가게 데이터가 생성되는지 확인
3. 수집된 데이터의 lat/lng이 유효한 범위인지 확인

**웹 서비스:**
1. `npm run dev`로 로컬 개발 서버 실행
2. 지도가 정상 렌더링되고 마커가 표시되는지 확인
3. 검색/필터가 리스트와 지도 핀을 동시에 업데이트하는지 확인
4. 카드 hover ↔ 마커 하이라이트 연동 확인
5. 즐겨찾기 저장/삭제가 localStorage에 반영되는지 확인
6. 가게 상세 뷰 진입/복귀가 자연스러운지 확인
7. 브라우저 새로고침 후 즐겨찾기가 유지되는지 확인
