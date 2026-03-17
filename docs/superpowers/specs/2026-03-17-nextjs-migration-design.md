# Next.js Migration Design Spec

## Context

현재 Vite + React SPA를 Next.js App Router로 전환한다.
목적: AdSense 승인을 위한 SSG, Supabase DB 연동 준비, Cloudflare Pages 배포.

이번 단계에서는 **Next.js 전환 + 기존 기능 1:1 마이그레이션**까지 진행한다.
데이터는 기존 JSON을 서버 컴포넌트에서 로딩하되, Supabase 전환용 스키마를 미리 준비한다.

## Tech Stack

- **Next.js 15** (App Router, latest)
- **React 19**
- **TypeScript 5.x**
- **Tailwind CSS 4** (CSS 기반 설정, `@theme {}` 블록 사용 - JS config 파일 불필요)
- **Leaflet + react-leaflet** (dynamic import, ssr: false)
- **@phosphor-icons/react**

## Deployment Strategy

**Phase 1 (이번 작업): `output: 'export'` 정적 빌드**
- 순수 정적 HTML 생성 → Cloudflare Pages에 정적 파일로 배포 (완전 무료)
- API Routes, 미들웨어, 서버사이드 기능 없음
- JSON 데이터를 빌드 시 포함

**Phase 2 (Supabase 연동 후): `@opennextjs/cloudflare`**
- Cloudflare Workers 기반 SSR로 전환
- Supabase에서 실시간 데이터 fetch

## Directory Structure

```
shanghai-butter-rice/
├── app/
│   ├── layout.tsx              # RootLayout: 폰트, 메타, 글로벌 CSS
│   ├── page.tsx                # / → Landing (SSG)
│   ├── about/page.tsx          # /about (SSG)
│   ├── privacy/page.tsx        # /privacy (SSG)
│   ├── terms/page.tsx          # /terms (SSG)
│   ├── [product]/
│   │   └── page.tsx            # /shanghai-butter-rice, /dujjonku (SSG, generateStaticParams)
│   ├── globals.css             # index.css + App.css 통합
│   ├── not-found.tsx           # 404 페이지 (다크 테마, 홈 링크)
│   ├── robots.ts               # robots.txt 동적 생성
│   └── sitemap.ts              # sitemap.xml 동적 생성
├── components/
│   ├── Landing.tsx             # 'use client' - hover 상태
│   ├── MapView.tsx             # 'use client' - 새 컴포넌트, dynamic import 래퍼
│   ├── Map.tsx                 # 'use client' - Leaflet 맵 (기존 코드)
│   ├── TopBar.tsx              # 'use client' - 검색, 필터
│   ├── ShopPanel.tsx           # 'use client' - 바텀시트 (window.innerHeight 가드 필요)
│   ├── DetailPanel.tsx         # 'use client' - 가게 상세
│   ├── ShopCard.tsx            # 'use client' - 카드 (이벤트)
│   ├── ShopList.tsx            # 'use client' - 스크롤 연동
│   ├── ProductIcon.tsx         # 서버/클라이언트 공용
│   ├── About.tsx               # 서버 컴포넌트 (Link 사용, pushState 제거)
│   ├── PrivacyPolicy.tsx       # 서버 컴포넌트 (Link 사용)
│   └── Terms.tsx               # 서버 컴포넌트 (Link 사용)
├── lib/
│   ├── data.ts                 # 데이터 로딩 (JSON → 추후 Supabase)
│   └── supabase.ts             # Supabase 클라이언트 (주석 처리, 준비만)
├── hooks/
│   ├── useShops.ts             # 클라이언트 필터링/검색
│   ├── useFavorites.ts         # localStorage 즐겨찾기
│   └── useIsMobile.ts          # 반응형 레이아웃 분기 (기존 App.tsx에서 추출)
├── types/
│   └── shop.ts                 # Shop, Product 인터페이스 (dataFile 필드 제거)
├── data/
│   ├── shops.json              # 상하이버터떡 데이터
│   ├── dujjonku.json           # 두쫀쿠 데이터
│   └── products.ts             # 상품 정의 (dataFile 제거, slug으로 매핑)
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── supabase/
│   └── schema.sql              # DB 스키마 (계정 생성 후 실행)
├── pipeline/                   # 기존 파이프라인 유지
├── next.config.ts              # output: 'export', images.unoptimized: true
├── postcss.config.mjs          # Tailwind CSS 4 PostCSS 설정
├── tsconfig.json
└── package.json
```

### 삭제 대상 (미사용 컴포넌트)
- `CardStrip.tsx` - 미사용
- `Header.tsx` - TopBar로 대체됨
- `SearchFilter.tsx` - TopBar에 통합됨
- `ShopDetail.tsx` - DetailPanel로 대체됨

### 삭제 대상 (Vite 관련)
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.css` (globals.css에 통합)
- `index.html` (Next.js가 관리)

## Routing Migration

| 현재 (SPA) | Next.js App Router |
|------------|-------------------|
| `window.location.pathname === '/'` | `app/page.tsx` |
| `pathname === 'shanghai-butter-rice'` | `app/[product]/page.tsx` |
| `pathname === 'dujjonku'` | `app/[product]/page.tsx` |
| `pathname === 'about'` | `app/about/page.tsx` |
| `pathname === 'privacy'` | `app/privacy/page.tsx` |
| `pathname === 'terms'` | `app/terms/page.tsx` |
| `window.location.hash` (shop detail) | **hash 유지** (`#shopId`) - 클라이언트 전용, SSG에 영향 없음 |
| `history.pushState` / `popstate` | `next/link` `<Link>` + `useRouter` |

## Component Migration Details

### 새로 생성하는 컴포넌트
- **`MapView.tsx`** - 새 컴포넌트. Map + TopBar + ShopPanel + DetailPanel을 조합하는 클라이언트 래퍼. 기존 App.tsx의 상태 관리 로직을 여기로 이동.

### Server Components (pushState → Link 전환)
- `About.tsx`, `PrivacyPolicy.tsx`, `Terms.tsx`
  - `history.pushState` + `popstate` 패턴 → `<Link href="/">` 로 교체
  - `'use client'` 제거 가능 → 서버 컴포넌트로 변환

### Client Components - SSR 주의사항
- **ShopPanel.tsx**: `window.innerHeight` 사용 → `useEffect`에서 초기화하도록 수정
- **useFavorites.ts**: `localStorage` → `useEffect`에서 읽기 (hydration mismatch 방지)
- **useIsMobile.ts**: `window.innerWidth` → `useEffect`에서 초기화

## Data Loading

### Phase 1 (이번 작업): JSON 파일 로딩
```typescript
// lib/data.ts
import shopsData from '@/data/shops.json'
import dujjonkuData from '@/data/dujjonku.json'
import type { Shop } from '@/types/shop'

const dataMap: Record<string, Shop[]> = {
  'shanghai-butter-rice': shopsData as Shop[],
  'dujjonku': dujjonkuData as Shop[],
}

export function getShopsByProduct(productSlug: string): Shop[] {
  return dataMap[productSlug] ?? []
}
```

### [product] 페이지
```typescript
// app/[product]/page.tsx
import { getShopsByProduct } from '@/lib/data'
import { getProductBySlug, products } from '@/data/products'
import { notFound } from 'next/navigation'
import { MapView } from '@/components/MapView'

export function generateStaticParams() {
  return products.map(p => ({ product: p.slug }))
}

// Next.js 15: params는 Promise
export default async function ProductPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params
  const productData = getProductBySlug(product)
  if (!productData) notFound()

  const shops = getShopsByProduct(product)

  return <MapView product={productData} initialShops={shops} />
}
```

## Leaflet Handling

```typescript
// components/MapView.tsx
'use client'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./Map').then(m => m.Map), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#141210]" />
})
```

## Styling Migration

- Tailwind CSS 4: CSS 기반 설정 유지 (`@theme {}` 블록)
- `postcss.config.mjs`에 `@tailwindcss/postcss` 플러그인 설정
- `index.css` + `App.css` → `app/globals.css` 통합
- Leaflet CSS: `app/layout.tsx`에서 `import 'leaflet/dist/leaflet.css'`
- 폰트: `next/font/google`로 Outfit, Pretendard는 CDN 유지

## next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',        // 정적 빌드 (Cloudflare Pages용)
  images: {
    unoptimized: true,     // static export에서 이미지 최적화 불가
  },
  trailingSlash: false,
}

export default nextConfig
```

## Metadata & SEO

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: '요즘 뭐가 맛있어? — 트렌드 간식 맛집 지도',
  description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
  openGraph: {
    title: '요즘 뭐가 맛있어? — 트렌드 간식 맛집 지도',
    description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾아보세요.',
    type: 'website',
    locale: 'ko_KR',
    url: 'https://trendeat.org',
  },
}
```

## Supabase 준비 (사용 안 함, 파일만 생성)

### supabase/schema.sql
```sql
create table products (
  slug text primary key,
  name text not null,
  icon_name text not null,
  created_at timestamptz default now()
);

create table shops (
  id text primary key,
  product_slug text not null references products(slug),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text default '',
  hours text default '',
  closed_days text[] default '{}',
  price_range text default '',
  tags text[] default '{}',
  description text default '',
  region text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_shops_product on shops(product_slug);
create index idx_shops_region on shops(region);
```

## Verification Plan

1. `npm run dev` → 로컬 개발 서버 정상 동작
2. `/` → Landing 페이지 렌더링, 상품 선택 → 지도 이동
3. `/shanghai-butter-rice` → 지도 + 가게 목록 표시
4. `/dujjonku` → 동일
5. 가게 클릭 → 상세 패널 열림 (hash 기반)
6. 즐겨찾기 동작 (localStorage)
7. 모바일 반응형 (바텀시트)
8. `/about`, `/privacy`, `/terms` 정상 렌더링
9. 404 페이지 동작 (`/invalid-path`)
10. `npm run build` → 빌드 에러 없음
11. `out/` 디렉토리에 정적 HTML 생성 확인

## Out of Scope (다음 단계)

- Supabase 계정 생성 및 연동
- 로그인/인증
- Google AdSense 설정
- Cloudflare Pages 실제 배포
- 파이프라인 DB 연동
- `@opennextjs/cloudflare` 전환 (Supabase 연동 시)
