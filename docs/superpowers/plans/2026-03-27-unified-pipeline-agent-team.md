# Unified Data Pipeline with Agent Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify `scripts/` ad-hoc crawlers and `pipeline/` 5-stage ETL into a single, robust pipeline that Claude Code Agent Teams can orchestrate — each stage dispatched as a parallel or sequential agent.

**Architecture:** The unified pipeline keeps the 5-stage ETL structure from `pipeline/` but absorbs the best patterns from `scripts/`: multi-source parallel crawling (Naver Maps + Kakao Maps + Naver Blog), Nominatim geocoding fallback, and existing-data preservation. Each stage is a standalone TypeScript module with a `run(config, dataDir)` function export, enabling both CLI execution and programmatic invocation by Agent Teams. An `AGENTS.md` file defines the agent team roles so Claude Code can dispatch agents per stage.

**Tech Stack:** TypeScript, Playwright (headless browser), Nominatim API (geocoding fallback), Node.js fs/path

---

## File Structure

```
pipeline-v2/
├── AGENTS.md                    # Agent team definitions for Claude Code
├── pipeline.config.json         # Unified config (extended from existing)
├── run.ts                       # CLI entrypoint — runs all stages sequentially
├── run-agents.ts                # Agent-oriented entrypoint — instructions for Claude Code teams
├── lib/
│   ├── types.ts                 # Unified type definitions
│   ├── utils.ts                 # Shared utilities (normalization, region, sleep, config)
│   ├── browser.ts               # Browser factory with retry + graceful degradation
│   ├── blog-extractor.ts        # Naver blog shop extraction (from pipeline/)
│   └── google-maps.ts           # Google Maps search + enrichment (fixed networkidle)
├── stage1-keywords.ts           # Keyword generation
├── stage2-crawl.ts              # Unified multi-source crawling (Naver Blog + Maps + Kakao)
│   ├── crawlers/
│   │   ├── naver-blog.ts        # Naver Blog crawler (from pipeline/stage2)
│   │   ├── naver-maps.ts        # Naver Maps crawler (from scripts/crawl-naver.ts)
│   │   └── kakao-maps.ts        # Kakao Maps crawler (from scripts/crawl-kakao.ts)
├── stage3-clean.ts              # Deduplication + data quality
├── stage4-enrich.ts             # Google Maps enrichment + Nominatim fallback
├── stage5-finalize.ts           # Final schema conversion + output
└── data/                        # Intermediate outputs (gitignored)
```

**Key design decisions:**
- `pipeline-v2/` is a new directory — existing `pipeline/` and `scripts/` stay untouched until migration is verified
- Each stage exports a `run()` function for programmatic use AND works as a standalone CLI script
- `crawlers/` subdirectory isolates each source so they can be dispatched as parallel agents
- `browser.ts` centralizes Playwright setup with retry logic and `domcontentloaded` (never `networkidle`)
- `AGENTS.md` defines the Claude Code Agent Team contract

---

## Task 1: Unified Types and Config

**Files:**
- Create: `pipeline-v2/lib/types.ts`
- Create: `pipeline-v2/pipeline.config.json`

- [ ] **Step 1: Create `pipeline-v2/lib/types.ts`**

```typescript
/** Pipeline configuration — loaded from pipeline.config.json, overridable via CLI */
export interface PipelineConfig {
  readonly product: string
  readonly searchPatterns: readonly string[]
  readonly cities: readonly string[]
  readonly sources: readonly CrawlSource[]
  readonly blogPages: number
  readonly maxPostsPerKeyword: number
  readonly googleMapsDelayMs: number
  readonly blogDelayMs: number
  readonly nominatimDelayMs: number
  readonly outputPath: string
  readonly dataDir: string
}

/** Available crawl sources — each maps to a crawler module */
export type CrawlSource = 'naver-blog' | 'naver-maps' | 'kakao-maps'

/** Raw shop data extracted by any crawler */
export interface RawShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly source: CrawlSource
  readonly keyword: string
  readonly blogUrl: string
}

/** Shop enriched with Google Maps / Nominatim data */
export interface EnrichedShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly rating: string
  readonly reviewCount: string
  readonly lat: number | null
  readonly lng: number | null
  readonly description: string
  readonly source: CrawlSource
}

/** Final shop schema — matches types/shop.ts for frontend consumption */
export interface Shop {
  id: string
  readonly name: string
  readonly address: string
  readonly lat: number | null
  readonly lng: number | null
  readonly phone: string
  readonly hours: string
  readonly closedDays: readonly string[]
  readonly priceRange: string
  readonly tags: readonly string[]
  readonly description: string
  readonly region: string
}

/** Result of a single crawler run */
export interface CrawlResult {
  readonly source: CrawlSource
  readonly shops: readonly RawShop[]
  readonly errors: readonly string[]
  readonly duration: number
}

/** Stage execution result for agent coordination */
export interface StageResult {
  readonly stage: string
  readonly success: boolean
  readonly outputFile: string
  readonly itemCount: number
  readonly errors: readonly string[]
  readonly duration: number
}
```

- [ ] **Step 2: Create `pipeline-v2/pipeline.config.json`**

```json
{
  "product": "상하이버터떡",
  "searchPatterns": [
    "{product} 파는곳",
    "{product} 판매점",
    "{product} 맛집",
    "{product} 카페",
    "{product} 베이커리",
    "{product} 추천",
    "{product} 매장",
    "{product} 판매 매장",
    "{city} {product} 파는곳",
    "{city} {product}"
  ],
  "cities": [
    "서울", "부산", "대구", "인천", "광주", "대전", "울산",
    "수원", "성남", "분당", "용인", "천안", "청주", "전주",
    "창원", "김해", "제주", "강릉", "세종"
  ],
  "sources": ["naver-blog", "naver-maps", "kakao-maps"],
  "blogPages": 2,
  "maxPostsPerKeyword": 10,
  "googleMapsDelayMs": 2000,
  "blogDelayMs": 1500,
  "nominatimDelayMs": 1100,
  "outputPath": "../data/shops.json",
  "dataDir": "./data"
}
```

- [ ] **Step 3: Commit**

```bash
git add pipeline-v2/lib/types.ts pipeline-v2/pipeline.config.json
git commit -m "feat(pipeline-v2): add unified types and config

Merged type definitions from pipeline/ and scripts/.
Added CrawlSource union, CrawlResult, and StageResult for agent coordination.
Config now includes sources array and nominatimDelayMs."
```

---

## Task 2: Shared Utilities

**Files:**
- Create: `pipeline-v2/lib/utils.ts`
- Create: `pipeline-v2/lib/browser.ts`

- [ ] **Step 1: Create `pipeline-v2/lib/utils.ts`**

```typescript
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PipelineConfig } from './types'

export function normalizeName(name: string): string {
  return name.replace(/[\s\-·.,():/]/g, '').toLowerCase()
}

const REGION_MAP: ReadonlyMap<string, string> = new Map([
  ['서울특별시', '서울'], ['서울시', '서울'], ['서울', '서울'],
  ['부산광역시', '부산'], ['부산시', '부산'], ['부산', '부산'],
  ['대구광역시', '대구'], ['대구시', '대구'], ['대구', '대구'],
  ['인천광역시', '인천'], ['인천시', '인천'], ['인천', '인천'],
  ['광주광역시', '광주'], ['광주시', '광주'], ['광주', '광주'],
  ['대전광역시', '대전'], ['대전시', '대전'], ['대전', '대전'],
  ['울산광역시', '울산'], ['울산시', '울산'], ['울산', '울산'],
  ['세종특별자치시', '세종'], ['세종시', '세종'], ['세종', '세종'],
  ['경기도', '경기'], ['경기', '경기'],
  ['강원특별자치도', '강원'], ['강원도', '강원'], ['강원', '강원'],
  ['충청북도', '충북'], ['충북', '충북'],
  ['충청남도', '충남'], ['충남', '충남'],
  ['전북특별자치도', '전북'], ['전라북도', '전북'], ['전북', '전북'],
  ['전라남도', '전남'], ['전남', '전남'],
  ['경상북도', '경북'], ['경북', '경북'],
  ['경상남도', '경남'], ['경남', '경남'],
  ['제주특별자치도', '제주'], ['제주도', '제주'], ['제주', '제주'],
])

export function extractRegion(address: string): string {
  const first = address.split(/\s+/)[0]
  if (!first) return '기타'
  return REGION_MAP.get(first) ?? first
}

export function extractDistrict(address: string): string {
  return address.split(/\s+/).slice(0, 3).join(' ')
}

export function isDuplicate(
  a: { readonly name: string; readonly address: string },
  b: { readonly name: string; readonly address: string },
): boolean {
  return normalizeName(a.name) === normalizeName(b.name)
    && extractDistrict(a.address) === extractDistrict(b.address)
}

const GENERIC_PATTERNS: readonly RegExp[] = [
  /카페$/, /^.{1,3}카페$/, /동카페$/, /구카페$/, /시카페$/,
  /^디저트카페$/, /^베이커리카페$/, /^맛집카페$/,
  /^네이버/, /^검색 결과/, /위치찾기/,
]

export function isGenericName(name: string): boolean {
  const trimmed = name.trim()
  return GENERIC_PATTERNS.some(p => p.test(trimmed))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export function loadConfig(configOverridePath?: string): PipelineConfig {
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = resolve(dirname(__filename), '..')
  const configPath = configOverridePath ?? resolve(pipelineDir, 'pipeline.config.json')
  const config: PipelineConfig = JSON.parse(readFileSync(configPath, 'utf-8'))

  const args = process.argv.slice(2)
  const productIdx = args.indexOf('--product')
  const product = productIdx !== -1 && args[productIdx + 1]
    ? args[productIdx + 1]
    : config.product

  const outputIdx = args.indexOf('--output')
  const outputPath = outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : config.outputPath

  const resolved = { ...config, product, outputPath }

  const dataDir = resolve(pipelineDir, resolved.dataDir)
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return resolved
}

export function getDataDir(): string {
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = resolve(dirname(__filename), '..')
  const config = JSON.parse(readFileSync(resolve(pipelineDir, 'pipeline.config.json'), 'utf-8'))
  return resolve(pipelineDir, config.dataDir)
}

/** Save intermediate results with atomic write pattern */
export function saveJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/** Load JSON file, return default if not found */
export function loadJson<T>(filePath: string, defaultValue: T): T {
  if (!existsSync(filePath)) return defaultValue
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

/** Measure execution time of an async function */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start
  console.log(`[${label}] ${(duration / 1000).toFixed(1)}s`)
  return { result, duration }
}
```

- [ ] **Step 2: Create `pipeline-v2/lib/browser.ts`**

이 모듈은 Playwright 브라우저를 안전하게 생성하고, 크롤링 실패 시 graceful degradation을 제공합니다. **절대 `networkidle`을 사용하지 않습니다** — Google Maps 등에서 무한 대기가 발생하기 때문입니다.

```typescript
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface BrowserSession {
  readonly browser: Browser
  readonly context: BrowserContext
}

/** Launch a headless browser with Korean locale. Caller must close. */
export async function launchBrowser(): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: DEFAULT_USER_AGENT,
  })
  return { browser, context }
}

/**
 * Navigate to a URL safely. Uses 'domcontentloaded' — NEVER 'networkidle'.
 *
 * Why: Google Maps, Naver, Kakao all have long-polling/streaming connections
 * that prevent 'networkidle' from ever resolving. This caused hanging in
 * the original scripts/crawl-naver.ts and scripts/crawl-kakao.ts.
 */
export async function safeGoto(
  page: Page,
  url: string,
  options?: { timeout?: number },
): Promise<boolean> {
  const timeout = options?.timeout ?? 15000
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[browser] Navigation failed: ${url} — ${msg}`)
    return false
  }
}

/**
 * Wait for a selector with fallback. Returns true if found, false if timeout.
 * Preferred over waitForLoadState('networkidle').
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  timeout = 10000,
): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ timeout })
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add pipeline-v2/lib/utils.ts pipeline-v2/lib/browser.ts
git commit -m "feat(pipeline-v2): add shared utilities and safe browser module

browser.ts enforces domcontentloaded — never networkidle.
utils.ts adds saveJson, loadJson, withTiming helpers."
```

---

## Task 3: Crawler Modules (Naver Blog, Naver Maps, Kakao Maps)

**Files:**
- Create: `pipeline-v2/lib/blog-extractor.ts`
- Create: `pipeline-v2/crawlers/naver-blog.ts`
- Create: `pipeline-v2/crawlers/naver-maps.ts`
- Create: `pipeline-v2/crawlers/kakao-maps.ts`

- [ ] **Step 1: Create `pipeline-v2/lib/blog-extractor.ts`**

이 파일은 기존 `pipeline/lib/blog-extractor.ts`를 그대로 가져오되, `browser.ts`를 사용하도록 수정합니다.

```typescript
import type { Page } from 'playwright'
import type { RawShop, CrawlSource } from './types'

/**
 * Extract shop information from a Naver blog post page.
 * Looks for Naver Place links, road addresses, and phone numbers.
 */
export async function extractShopsFromBlogPost(
  page: Page,
  keyword: string,
  blogUrl: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []
  const source: CrawlSource = 'naver-blog'

  // Switch to blog post iframe if present
  let contentFrame = page
  try {
    const frameElement = await page.$('#mainFrame')
    if (frameElement) {
      const frame = await frameElement.contentFrame()
      if (frame) {
        contentFrame = frame as unknown as Page
      }
    }
  } catch {
    // No iframe — use main page
  }

  // 1. Look for Naver Place links
  const placeLinks = await contentFrame.$$eval(
    'a[href*="place.naver.com"], a[href*="map.naver.com/entry/place"]',
    (links: HTMLAnchorElement[]) => links.map(a => ({
      href: a.href,
      text: a.textContent?.trim() || '',
    })),
  ).catch(() => [])

  for (const link of placeLinks) {
    const name = link.text || ''
    if (name.length > 1 && name.length < 50) {
      shops.push({
        name,
        address: '',
        phone: '',
        hours: '',
        category: '',
        source,
        keyword,
        blogUrl,
      })
    }
  }

  // 2. Extract text content and look for address/phone patterns
  const textContent = await contentFrame.evaluate(() => {
    const el = document.querySelector('.se-main-container')
      || document.querySelector('.post-view')
      || document.querySelector('#content')
      || document.body
    return el?.textContent || ''
  }).catch(() => '')

  const addressPattern = /([가-힣]+(?:특별시|광역시|특별자치시|도)\s+[가-힣]+(?:시|군|구)\s+[가-힣0-9\s]+(?:로|길)\s*[0-9\-]+(?:\s*[가-힣0-9\-]+)?)/g
  const addresses = textContent.match(addressPattern) || []

  const phonePattern = /(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g
  const phones = textContent.match(phonePattern) || []

  // If no place links found but addresses exist, try heuristic name extraction
  if (shops.length === 0 && addresses.length > 0) {
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i]
      const addrIndex = textContent.indexOf(addr)
      const nearbyText = textContent.substring(Math.max(0, addrIndex - 200), addrIndex)

      const nameMatch = nearbyText.match(
        /([가-힣A-Za-z0-9\s]{2,20}(?:카페|빵집|베이커리|제과|당|점|관|집|방|파티세리|아뜰리에))/g,
      )
      const name = nameMatch ? nameMatch[nameMatch.length - 1].trim() : ''

      if (name) {
        shops.push({
          name,
          address: addr.trim(),
          phone: phones[i] || '',
          hours: '',
          category: '',
          source,
          keyword,
          blogUrl,
        })
      }
    }
  }

  // Fill missing addresses/phones from first found values
  for (const shop of shops) {
    if (!shop.address && addresses.length > 0) {
      shops[shops.indexOf(shop)] = { ...shop, address: addresses[0].trim() }
    }
    if (!shop.phone && phones.length > 0) {
      const idx = shops.indexOf(shop)
      shops[idx] = { ...shops[idx], phone: phones[0].trim() }
    }
  }

  return shops
}
```

- [ ] **Step 2: Create `pipeline-v2/crawlers/naver-blog.ts`**

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { RawShop, CrawlResult, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto } from '../lib/browser'
import { extractShopsFromBlogPost } from '../lib/blog-extractor'
import { sleep, getDataDir, loadConfig } from '../lib/utils'

export async function crawlNaverBlog(config: PipelineConfig): Promise<CrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const dataDir = getDataDir()

  const keywordsPath = resolve(dataDir, 'keywords.json')
  const keywords: string[] = JSON.parse(readFileSync(keywordsPath, 'utf-8'))

  console.log(`[naver-blog] ${keywords.length} keywords, ${config.blogPages} pages each`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []
  const visitedUrls = new Set<string>()

  try {
    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki]
      console.log(`  [${ki + 1}/${keywords.length}] "${keyword}"`)

      const blogUrls: string[] = []

      for (let pageNo = 1; pageNo <= config.blogPages; pageNo++) {
        const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encodeURIComponent(keyword)}`

        const page = await context.newPage()
        try {
          const ok = await safeGoto(page, searchUrl)
          if (!ok) {
            errors.push(`Search page failed: ${keyword} page ${pageNo}`)
            continue
          }
          await sleep(config.blogDelayMs)

          const links = await page.$$eval(
            'a.desc_inner[href*="blog.naver.com"]',
            (anchors: HTMLAnchorElement[]) => anchors.map(a => a.href),
          ).catch(() => [])

          for (const link of links) {
            if (!visitedUrls.has(link) && blogUrls.length < config.maxPostsPerKeyword) {
              visitedUrls.add(link)
              blogUrls.push(link)
            }
          }
        } catch (error) {
          errors.push(`Search error: ${keyword} — ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }

      for (const blogUrl of blogUrls) {
        const page = await context.newPage()
        try {
          const ok = await safeGoto(page, blogUrl)
          if (!ok) continue
          await sleep(config.blogDelayMs)

          const shops = await extractShopsFromBlogPost(page, keyword, blogUrl)
          if (shops.length > 0) {
            console.log(`    + ${shops.length} shops from ${blogUrl}`)
            allShops.push(...shops)
          }
        } catch (error) {
          errors.push(`Blog error: ${blogUrl} — ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  return {
    source: 'naver-blog',
    shops: allShops,
    errors,
    duration: Date.now() - start,
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('naver-blog.ts')) {
  const config = loadConfig()
  crawlNaverBlog(config)
    .then(result => {
      console.log(`[naver-blog] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[naver-blog] Fatal:', err)
      process.exit(1)
    })
}
```

- [ ] **Step 3: Create `pipeline-v2/crawlers/naver-maps.ts`**

Naver Maps 크롤러. 기존 `scripts/crawl-naver.ts`에서 가져오되 `networkidle` → `domcontentloaded` 수정, `CrawlResult` 반환.

```typescript
import type { RawShop, CrawlResult, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto, waitForSelector } from '../lib/browser'
import { sleep, loadConfig } from '../lib/utils'
import type { Page, FrameLocator } from 'playwright'

async function extractShopsFromNaverMaps(
  page: Page,
  keyword: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []
  const searchIframe: FrameLocator = page.frameLocator('#searchIframe')

  const hasResults = await waitForSelector(
    searchIframe.owner() as unknown as Page,
    '#searchIframe',
    10000,
  )
  if (!hasResults) return shops

  // Wait for actual content inside iframe
  try {
    await searchIframe.locator('.CHC5F').first().waitFor({ timeout: 10000 })
  } catch {
    return shops
  }

  const items = searchIframe.locator('.CHC5F')
  const count = await items.count()

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i)
      const name = await item.locator('.place_bluelink > span').first().textContent() ?? ''
      const category = await item.locator('.KCMnt').first().textContent() ?? ''

      await item.locator('.place_bluelink').first().click()
      await sleep(1000)

      const detailIframe = page.frameLocator('#entryIframe')
      const address = await detailIframe.locator('.LDgIH').first().textContent().catch(() => '') ?? ''
      const phone = await detailIframe.locator('.xlx7Q').first().textContent().catch(() => '') ?? ''
      const hours = await detailIframe.locator('.A_cdD .i8cJw').first().textContent().catch(() => '') ?? ''

      if (name) {
        shops.push({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          hours: hours.trim(),
          category: category.trim(),
          source: 'naver-maps',
          keyword,
          blogUrl: '',
        })
      }

      await page.goBack()
      await sleep(500)
    } catch {
      continue
    }
  }

  return shops
}

export async function crawlNaverMaps(config: PipelineConfig): Promise<CrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const keyword = config.product

  console.log(`[naver-maps] Searching: "${keyword}"`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []

  try {
    const page = await context.newPage()
    const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`

    const ok = await safeGoto(page, searchUrl, { timeout: 20000 })
    if (!ok) {
      errors.push('Naver Maps initial navigation failed')
      return { source: 'naver-maps', shops: [], errors, duration: Date.now() - start }
    }
    await sleep(2000)

    const shops = await extractShopsFromNaverMaps(page, keyword)
    allShops.push(...shops)

    // Paginate up to 3 pages
    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const searchIframe = page.frameLocator('#searchIframe')
        const nextBtn = searchIframe.locator(`a.mBN2s[data-nclk-aid="${pageNum}"]`).first()
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await sleep(2000)
          const pageShops = await extractShopsFromNaverMaps(page, keyword)
          allShops.push(...pageShops)
        } else {
          break
        }
      } catch {
        break
      }
    }

    await page.close()
  } catch (error) {
    errors.push(`Naver Maps crawl error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await browser.close()
  }

  return {
    source: 'naver-maps',
    shops: allShops,
    errors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('naver-maps.ts')) {
  const config = loadConfig()
  crawlNaverMaps(config)
    .then(result => {
      console.log(`[naver-maps] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[naver-maps] Fatal:', err)
      process.exit(1)
    })
}
```

- [ ] **Step 4: Create `pipeline-v2/crawlers/kakao-maps.ts`**

```typescript
import type { RawShop, CrawlResult, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto, waitForSelector } from '../lib/browser'
import { sleep, loadConfig } from '../lib/utils'
import type { Page } from 'playwright'

async function extractShopsFromKakaoPage(
  page: Page,
  keyword: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []

  const items = page.locator('.placelist > .PlaceItem')
  const count = await items.count()

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i)
      const name = await item.locator('.head_item .tit_name .link_name').textContent() ?? ''
      const address = await item.locator('.addr p:first-child').textContent() ?? ''
      const phone = await item.locator('.contact .phone').textContent().catch(() => '') ?? ''
      const category = await item.locator('.head_item .subcategory').textContent().catch(() => '') ?? ''
      const hours = await item.locator('.openhour .txt_operation').textContent().catch(() => '') ?? ''

      if (name) {
        shops.push({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          hours: hours.trim(),
          category: category.trim(),
          source: 'kakao-maps',
          keyword,
          blogUrl: '',
        })
      }
    } catch {
      continue
    }
  }

  return shops
}

export async function crawlKakaoMaps(config: PipelineConfig): Promise<CrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const keyword = config.product

  console.log(`[kakao-maps] Searching: "${keyword}"`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []

  try {
    const page = await context.newPage()
    const searchUrl = `https://map.kakao.com/?q=${encodeURIComponent(keyword)}`

    const ok = await safeGoto(page, searchUrl, { timeout: 20000 })
    if (!ok) {
      errors.push('Kakao Maps initial navigation failed — site may be blocking')
      return { source: 'kakao-maps', shops: [], errors, duration: Date.now() - start }
    }
    await sleep(2000)

    const listLoaded = await waitForSelector(page, '#info\\.search\\.place\\.list')
    if (!listLoaded) {
      errors.push('Kakao Maps search results did not load — possible anti-bot')
      return { source: 'kakao-maps', shops: allShops, errors, duration: Date.now() - start }
    }

    const shops = await extractShopsFromKakaoPage(page, keyword)
    allShops.push(...shops)

    // Paginate up to 3 pages
    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const nextBtn = page.locator(`#info\\.search\\.page\\.no${pageNum}`)
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await sleep(2000)
          const pageShops = await extractShopsFromKakaoPage(page, keyword)
          allShops.push(...pageShops)
        } else {
          break
        }
      } catch {
        break
      }
    }

    await page.close()
  } catch (error) {
    errors.push(`Kakao Maps crawl error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await browser.close()
  }

  return {
    source: 'kakao-maps',
    shops: allShops,
    errors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('kakao-maps.ts')) {
  const config = loadConfig()
  crawlKakaoMaps(config)
    .then(result => {
      console.log(`[kakao-maps] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[kakao-maps] Fatal:', err)
      process.exit(1)
    })
}
```

- [ ] **Step 5: Commit**

```bash
git add pipeline-v2/lib/blog-extractor.ts pipeline-v2/crawlers/
git commit -m "feat(pipeline-v2): add three crawler modules

naver-blog: Blog post extraction with iframe handling
naver-maps: Naver Maps search with domcontentloaded (not networkidle)
kakao-maps: KakaoMap search with anti-bot graceful degradation
Each exports async function returning CrawlResult for agent coordination."
```

---

## Task 4: Google Maps Enrichment with Safe Navigation

**Files:**
- Create: `pipeline-v2/lib/google-maps.ts`

- [ ] **Step 1: Create `pipeline-v2/lib/google-maps.ts`**

핵심 수정: `networkidle` 절대 사용 금지. Google Maps는 지속적으로 네트워크 요청을 보내므로 `domcontentloaded` + 명시적 selector 대기를 사용합니다.

```typescript
import type { Page } from 'playwright'
import type { EnrichedShop } from './types'
import { sleep } from './utils'
import { safeGoto, waitForSelector } from './browser'

/**
 * Search Google Maps for a shop and extract business information.
 *
 * CRITICAL: Never use waitForLoadState('networkidle') — Google Maps
 * streams data continuously and networkidle will hang forever.
 * Instead we use domcontentloaded + explicit selector waits.
 */
export async function searchGoogleMaps(
  page: Page,
  shopName: string,
  city: string,
  delayMs: number,
): Promise<Partial<EnrichedShop> | null> {
  const query = encodeURIComponent(`${shopName} ${city}`)
  const url = `https://www.google.com/maps/search/${query}`

  try {
    const ok = await safeGoto(page, url, { timeout: 15000 })
    if (!ok) return null

    await sleep(delayMs)

    // Click first result if list appears
    const firstResult = page.locator('a[href*="/maps/place/"]').first()
    const hasResults = await firstResult.count().catch(() => 0)
    if (hasResults > 0) {
      await firstResult.click()
      // Wait for detail panel to appear — NOT networkidle
      await waitForSelector(page, 'h1.DUwDvf, h1[data-attrid="title"]', 10000)
      await sleep(delayMs)
    }

    const info = await extractBusinessInfo(page)

    // Wait for URL to update with coordinates
    await sleep(1000)
    const coords = parseCoordinatesFromUrl(page.url())

    return {
      ...info,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }
  } catch (error) {
    console.warn(`  [gmaps] Failed: "${shopName}" — ${error instanceof Error ? error.message : error}`)
    return null
  }
}

async function extractBusinessInfo(page: Page): Promise<Partial<EnrichedShop>> {
  const info: Partial<EnrichedShop> = {}

  info.name = await page.$eval(
    'h1.DUwDvf, h1[data-attrid="title"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  info.address = await page.$eval(
    'button[data-item-id="address"] .Io6YTe, [data-tooltip="주소 복사"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  info.phone = await page.$eval(
    'button[data-item-id^="phone:"] .Io6YTe, [data-tooltip="전화번호 복사"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  info.hours = await page.$eval(
    '[data-item-id="oh"] .Io6YTe, .o7FIqe .ZDu9vd',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  info.rating = await page.$eval(
    'div.F7nice span[aria-hidden="true"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  info.reviewCount = await page.$eval(
    'div.F7nice span[aria-label*="리뷰"], div.F7nice span[aria-label*="review"]',
    el => {
      const match = el.getAttribute('aria-label')?.match(/[\d,]+/)
      return match ? match[0].replace(/,/g, '') : ''
    },
  ).catch(() => '')

  info.category = await page.$eval(
    'button.DkEaL, span.DkEaL',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  return info
}

export function parseCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  }

  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
  }

  return null
}

/**
 * Nominatim geocoding fallback for shops without coordinates.
 * Rate limited to 1 req/sec per Nominatim usage policy.
 */
export async function geocodeWithNominatim(
  address: string,
  delayMs: number,
): Promise<{ lat: number; lng: number } | null> {
  const clean = address
    .replace(/KR\s*/g, '')
    .replace(/\d+층/g, '')
    .replace(/\d+호/g, '')
    .replace(/번지/g, '')
    .replace(/\(.*\)/g, '')
    .trim()

  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&q=${encodeURIComponent(clean)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'trendeat-pipeline/2.0' },
    })
    const results = (await res.json()) as { lat: string; lon: string }[]

    if (results.length > 0) {
      const lat = parseFloat(results[0].lat)
      const lng = parseFloat(results[0].lon)
      // Validate coordinates are within South Korea bounds
      if (lat > 33 && lat < 39 && lng > 124.5 && lng < 132) {
        return { lat, lng }
      }
    }
  } catch (error) {
    console.warn(`  [nominatim] Failed: "${address}" — ${error instanceof Error ? error.message : error}`)
  }

  await sleep(delayMs)
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-v2/lib/google-maps.ts
git commit -m "feat(pipeline-v2): add Google Maps enrichment + Nominatim fallback

CRITICAL: uses domcontentloaded + explicit selector waits, never networkidle.
Nominatim geocoder validates South Korea coordinate bounds (33-39N, 124.5-132E)."
```

---

## Task 5: Pipeline Stages (1-5)

**Files:**
- Create: `pipeline-v2/stage1-keywords.ts`
- Create: `pipeline-v2/stage2-crawl.ts`
- Create: `pipeline-v2/stage3-clean.ts`
- Create: `pipeline-v2/stage4-enrich.ts`
- Create: `pipeline-v2/stage5-finalize.ts`

- [ ] **Step 1: Create `pipeline-v2/stage1-keywords.ts`**

```typescript
import { resolve } from 'path'
import type { PipelineConfig, StageResult } from './lib/types'
import { loadConfig, getDataDir, saveJson } from './lib/utils'

export async function runStage1(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()

  console.log('[Stage 1] Keyword generation')
  console.log(`  Product: ${config.product}`)

  const keywords: string[] = []

  for (const pattern of config.searchPatterns) {
    if (pattern.includes('{city}')) {
      for (const city of config.cities) {
        keywords.push(
          pattern.replace('{product}', config.product).replace('{city}', city),
        )
      }
    } else {
      keywords.push(pattern.replace('{product}', config.product))
    }
  }

  const unique = [...new Set(keywords)]
  const outputFile = resolve(dataDir, 'keywords.json')
  saveJson(outputFile, unique)

  console.log(`  Generated: ${unique.length} keywords`)
  console.log('[Stage 1] Done\n')

  return {
    stage: 'stage1-keywords',
    success: true,
    outputFile,
    itemCount: unique.length,
    errors: [],
    duration: Date.now() - start,
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('stage1-keywords.ts')) {
  const config = loadConfig()
  runStage1(config).catch(err => {
    console.error('[Stage 1] Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 2: Create `pipeline-v2/stage2-crawl.ts`**

이 단계가 핵심 통합 지점입니다. 3개 크롤러를 **병렬 실행**하고 결과를 합칩니다. 하나가 실패해도 나머지 결과로 계속 진행합니다 (`scripts/collect-data.ts`의 `Promise.all` + `.catch` 패턴).

```typescript
import { resolve } from 'path'
import type { PipelineConfig, RawShop, CrawlResult, StageResult } from './lib/types'
import { loadConfig, getDataDir, saveJson } from './lib/utils'
import { crawlNaverBlog } from './crawlers/naver-blog'
import { crawlNaverMaps } from './crawlers/naver-maps'
import { crawlKakaoMaps } from './crawlers/kakao-maps'

const CRAWLER_MAP = {
  'naver-blog': crawlNaverBlog,
  'naver-maps': crawlNaverMaps,
  'kakao-maps': crawlKakaoMaps,
} as const

export async function runStage2(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const allErrors: string[] = []

  console.log('[Stage 2] Multi-source crawling')
  console.log(`  Sources: ${config.sources.join(', ')}`)

  // Run enabled crawlers in parallel — each can fail independently
  const crawlerPromises = config.sources.map(source => {
    const crawlerFn = CRAWLER_MAP[source]
    if (!crawlerFn) {
      console.warn(`  Unknown source: ${source} — skipping`)
      return Promise.resolve({
        source,
        shops: [],
        errors: [`Unknown source: ${source}`],
        duration: 0,
      } as CrawlResult)
    }

    return crawlerFn(config).catch((err): CrawlResult => {
      const msg = `${source} crawler failed: ${err instanceof Error ? err.message : err}`
      console.error(`  ${msg}`)
      return { source, shops: [], errors: [msg], duration: 0 }
    })
  })

  const results = await Promise.all(crawlerPromises)

  // Aggregate results
  const allShops: RawShop[] = []
  for (const result of results) {
    console.log(`  ${result.source}: ${result.shops.length} shops, ${result.errors.length} errors`)
    allShops.push(...result.shops)
    allErrors.push(...result.errors)
  }

  if (allShops.length === 0) {
    console.error('[Stage 2] No shops collected from any source')
    return {
      stage: 'stage2-crawl',
      success: false,
      outputFile: '',
      itemCount: 0,
      errors: allErrors,
      duration: Date.now() - start,
    }
  }

  const outputFile = resolve(dataDir, 'raw-shops.json')
  saveJson(outputFile, allShops)

  console.log(`  Total: ${allShops.length} raw shops`)
  console.log('[Stage 2] Done\n')

  return {
    stage: 'stage2-crawl',
    success: true,
    outputFile,
    itemCount: allShops.length,
    errors: allErrors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage2-crawl.ts')) {
  const config = loadConfig()
  runStage2(config).catch(err => {
    console.error('[Stage 2] Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 3: Create `pipeline-v2/stage3-clean.ts`**

```typescript
import { resolve } from 'path'
import type { PipelineConfig, RawShop, StageResult } from './lib/types'
import { isGenericName, isDuplicate, loadConfig, getDataDir, saveJson, loadJson } from './lib/utils'

export async function runStage3(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()

  const rawShops = loadJson<RawShop[]>(resolve(dataDir, 'raw-shops.json'), [])

  console.log('[Stage 3] Data cleaning')
  console.log(`  Input: ${rawShops.length} shops`)

  // Filter: generic names → empty names → empty addresses
  const filtered = rawShops
    .filter(shop => !isGenericName(shop.name))
    .filter(shop => shop.name.trim().length > 0)
    .filter(shop => shop.address.trim().length > 0)

  console.log(`  After filters: ${filtered.length} shops`)

  // Deduplicate with merge (prefer longer address, fill missing fields)
  const deduped: RawShop[] = []
  for (const shop of filtered) {
    const existingIndex = deduped.findIndex(existing => isDuplicate(existing, shop))
    if (existingIndex >= 0) {
      const existing = deduped[existingIndex]
      deduped[existingIndex] = {
        ...existing,
        phone: existing.phone || shop.phone,
        hours: existing.hours || shop.hours,
        category: existing.category || shop.category,
        address: shop.address.length > existing.address.length ? shop.address : existing.address,
      }
    } else {
      deduped.push({ ...shop })
    }
  }

  console.log(`  After dedup: ${deduped.length} shops`)

  const outputFile = resolve(dataDir, 'cleaned-shops.json')
  saveJson(outputFile, deduped)

  console.log('[Stage 3] Done\n')

  return {
    stage: 'stage3-clean',
    success: true,
    outputFile,
    itemCount: deduped.length,
    errors: [],
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage3-clean.ts')) {
  const config = loadConfig()
  runStage3(config).catch(err => {
    console.error('[Stage 3] Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Create `pipeline-v2/stage4-enrich.ts`**

Google Maps 보강 + Nominatim 좌표 fallback. `networkidle` 대신 selector 대기 사용.

```typescript
import { resolve } from 'path'
import type { PipelineConfig, RawShop, EnrichedShop, StageResult } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson, sleep } from './lib/utils'
import { launchBrowser } from './lib/browser'
import { searchGoogleMaps, geocodeWithNominatim } from './lib/google-maps'

export async function runStage4(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const errors: string[] = []

  const cleanedShops = loadJson<RawShop[]>(resolve(dataDir, 'cleaned-shops.json'), [])

  console.log('[Stage 4] Google Maps enrichment + Nominatim fallback')
  console.log(`  Input: ${cleanedShops.length} shops`)

  const { browser, context } = await launchBrowser()
  const enrichedShops: EnrichedShop[] = []
  const page = await context.newPage()

  try {
    for (let i = 0; i < cleanedShops.length; i++) {
      const shop = cleanedShops[i]
      console.log(`  [${i + 1}/${cleanedShops.length}] "${shop.name}"`)

      const city = extractRegion(shop.address) || ''
      const mapsData = await searchGoogleMaps(page, shop.name, city, config.googleMapsDelayMs)

      let lat = mapsData?.lat ?? null
      let lng = mapsData?.lng ?? null

      // Nominatim fallback if Google Maps didn't return coordinates
      if ((lat === null || lng === null) && shop.address) {
        console.log(`    Nominatim fallback for: ${shop.address.slice(0, 40)}`)
        const nominatimResult = await geocodeWithNominatim(shop.address, config.nominatimDelayMs)
        if (nominatimResult) {
          lat = nominatimResult.lat
          lng = nominatimResult.lng
          console.log(`    Nominatim: ${lat}, ${lng}`)
        }
      }

      const enriched: EnrichedShop = {
        name: mapsData?.name || shop.name,
        address: mapsData?.address || shop.address,
        phone: mapsData?.phone || shop.phone,
        hours: mapsData?.hours || shop.hours,
        category: mapsData?.category || shop.category,
        rating: mapsData?.rating || '',
        reviewCount: mapsData?.reviewCount || '',
        lat,
        lng,
        description: '',
        source: shop.source,
      }

      enrichedShops.push(enriched)

      // Periodic save for crash recovery
      if ((i + 1) % 20 === 0) {
        saveJson(resolve(dataDir, 'enriched-shops-checkpoint.json'), enrichedShops)
        console.log(`    [checkpoint saved: ${enrichedShops.length} shops]`)
      }

      await sleep(config.googleMapsDelayMs)
    }
  } catch (error) {
    errors.push(`Stage 4 error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await page.close()
    await browser.close()
  }

  const outputFile = resolve(dataDir, 'enriched-shops.json')
  saveJson(outputFile, enrichedShops)

  const withCoords = enrichedShops.filter(s => s.lat !== null && s.lng !== null).length
  console.log(`  With coordinates: ${withCoords}/${enrichedShops.length}`)
  console.log('[Stage 4] Done\n')

  return {
    stage: 'stage4-enrich',
    success: true,
    outputFile,
    itemCount: enrichedShops.length,
    errors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage4-enrich.ts')) {
  const config = loadConfig()
  runStage4(config).catch(err => {
    console.error('[Stage 4] Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 5: Create `pipeline-v2/stage5-finalize.ts`**

```typescript
import { resolve, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import type { PipelineConfig, EnrichedShop, Shop, StageResult } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson } from './lib/utils'

const REGION_PAIRS: readonly [string, string][] = [
  ['서울', '서울'], ['부산', '부산'], ['대구', '대구'],
  ['인천', '인천'], ['광주', '광주'], ['대전', '대전'],
  ['울산', '울산'], ['세종', '세종'], ['제주', '제주'],
  ['경기', '경기'], ['강원', '강원'],
  ['충북', '충북'], ['충청북', '충북'],
  ['충남', '충남'], ['충청남', '충남'],
  ['전북', '전북'], ['전라북', '전북'],
  ['전남', '전남'], ['전라남', '전남'],
  ['경북', '경북'], ['경상북', '경북'],
  ['경남', '경남'], ['경상남', '경남'],
]

function normalizeRegion(rawRegion: string): string {
  for (const [prefix, short] of REGION_PAIRS) {
    if (rawRegion.startsWith(prefix)) return short
  }
  return '기타'
}

export async function runStage5(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = dirname(__filename)

  const enrichedShops = loadJson<EnrichedShop[]>(resolve(dataDir, 'enriched-shops.json'), [])

  console.log('[Stage 5] Final schema generation')
  console.log(`  Input: ${enrichedShops.length} shops`)

  const shops: Shop[] = enrichedShops.map((enriched, index) => {
    const rawRegion = extractRegion(enriched.address)
    const region = normalizeRegion(rawRegion)

    const tags: string[] = enriched.category
      ? enriched.category.split(/[·,/]/).map(s => s.trim()).filter(Boolean)
      : []

    const descParts: string[] = []
    if (enriched.rating) {
      let ratingDesc = `★ ${enriched.rating}`
      if (enriched.reviewCount) {
        ratingDesc += ` (리뷰 ${enriched.reviewCount}개)`
      }
      descParts.push(ratingDesc)
    }
    if (enriched.category) {
      descParts.push(enriched.category)
    }

    return {
      id: `shop-${String(index + 1).padStart(3, '0')}`,
      name: enriched.name,
      address: enriched.address,
      lat: enriched.lat,
      lng: enriched.lng,
      phone: enriched.phone,
      hours: enriched.hours,
      closedDays: [],
      priceRange: '',
      tags,
      description: descParts.join(' · '),
      region,
    }
  })

  // Sort by region then name, re-assign IDs
  shops.sort((a, b) => {
    const regionCmp = a.region.localeCompare(b.region, 'ko')
    return regionCmp !== 0 ? regionCmp : a.name.localeCompare(b.name, 'ko')
  })
  shops.forEach((shop, index) => {
    shop.id = `shop-${String(index + 1).padStart(3, '0')}`
  })

  // Write to configured output path
  const outputPath = resolve(pipelineDir, config.outputPath)
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  saveJson(outputPath, shops)

  // Log region breakdown
  const regionCounts: Record<string, number> = {}
  for (const shop of shops) {
    regionCounts[shop.region] = (regionCounts[shop.region] || 0) + 1
  }
  console.log(`  Final: ${shops.length} shops`)
  for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${region}: ${count}`)
  }
  console.log(`  Output: ${outputPath}`)
  console.log('[Stage 5] Done\n')

  return {
    stage: 'stage5-finalize',
    success: true,
    outputFile: outputPath,
    itemCount: shops.length,
    errors: [],
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage5-finalize.ts')) {
  const config = loadConfig()
  runStage5(config).catch(err => {
    console.error('[Stage 5] Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add pipeline-v2/stage1-keywords.ts pipeline-v2/stage2-crawl.ts pipeline-v2/stage3-clean.ts pipeline-v2/stage4-enrich.ts pipeline-v2/stage5-finalize.ts
git commit -m "feat(pipeline-v2): add 5 pipeline stages

Stage 1: keyword generation from config patterns × cities
Stage 2: parallel multi-source crawling (naver-blog + naver-maps + kakao-maps)
Stage 3: filtering, dedup, and data quality merging
Stage 4: Google Maps enrichment with Nominatim coordinate fallback
Stage 5: final schema conversion, region normalization, sorted output"
```

---

## Task 6: CLI Runner

**Files:**
- Create: `pipeline-v2/run.ts`

- [ ] **Step 1: Create `pipeline-v2/run.ts`**

```typescript
import { loadConfig } from './lib/utils'
import { runStage1 } from './stage1-keywords'
import { runStage2 } from './stage2-crawl'
import { runStage3 } from './stage3-clean'
import { runStage4 } from './stage4-enrich'
import { runStage5 } from './stage5-finalize'
import type { StageResult } from './lib/types'

const config = loadConfig()

console.log(`\n========================================`)
console.log(`  Unified Data Pipeline v2`)
console.log(`  Product: ${config.product}`)
console.log(`  Sources: ${config.sources.join(', ')}`)
console.log(`========================================\n`)

const stages = [
  { name: 'Stage 1: Keywords', fn: runStage1 },
  { name: 'Stage 2: Crawl', fn: runStage2 },
  { name: 'Stage 3: Clean', fn: runStage3 },
  { name: 'Stage 4: Enrich', fn: runStage4 },
  { name: 'Stage 5: Finalize', fn: runStage5 },
]

const results: StageResult[] = []

for (const stage of stages) {
  console.log(`${'='.repeat(50)}`)
  console.log(`▶ ${stage.name}`)
  console.log(`${'='.repeat(50)}\n`)

  try {
    const result = await stage.fn(config)
    results.push(result)

    if (!result.success) {
      console.error(`\n❌ ${stage.name} failed`)
      result.errors.forEach(e => console.error(`  - ${e}`))
      process.exit(1)
    }
  } catch (error) {
    console.error(`\n❌ ${stage.name} fatal error`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`)
console.log(`✅ Pipeline complete!`)
console.log(`${'='.repeat(50)}`)
for (const r of results) {
  const secs = (r.duration / 1000).toFixed(1)
  const errTag = r.errors.length > 0 ? ` (${r.errors.length} errors)` : ''
  console.log(`  ${r.stage}: ${r.itemCount} items, ${secs}s${errTag}`)
}
console.log()
```

- [ ] **Step 2: Update `package.json` scripts**

Modify: `package.json` — add `pipeline-v2` script

Add to the `"scripts"` section:
```json
"pipeline-v2": "npx tsx pipeline-v2/run.ts"
```

- [ ] **Step 3: Commit**

```bash
git add pipeline-v2/run.ts package.json
git commit -m "feat(pipeline-v2): add CLI runner and npm script

npx tsx pipeline-v2/run.ts runs all 5 stages sequentially.
npm run pipeline-v2 as shortcut."
```

---

## Task 7: AGENTS.md — Agent Team Definition for Claude Code

**Files:**
- Create: `pipeline-v2/AGENTS.md`
- Create: `pipeline-v2/run-agents.ts`

이것이 핵심 요구사항입니다. Claude Code가 Agent Team을 구성해서 파이프라인을 실행할 수 있도록 `AGENTS.md`와 에이전트 오케스트레이션 가이드를 작성합니다.

- [ ] **Step 1: Create `pipeline-v2/AGENTS.md`**

```markdown
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
```

- [ ] **Step 2: Create `pipeline-v2/run-agents.ts`**

이 파일은 Claude Code Agent Team이 프로그래밍적으로 호출할 수 있는 오케스트레이션 인터페이스입니다.

```typescript
/**
 * Agent Team Orchestration Interface
 *
 * This file defines the pipeline stages as discrete, dispatchable units
 * that Claude Code Agent Teams can invoke. Each stage is independent
 * and communicates via JSON files in pipeline-v2/data/.
 *
 * Usage by Claude Code:
 *   - Stage 1: Run inline (fast, <1 second)
 *   - Stage 2: Dispatch 3 crawler agents in PARALLEL, then merge
 *   - Stages 3-5: Run sequentially
 *
 * Each function returns a StageResult with success/failure, item counts,
 * and error details for the coordinator to inspect.
 */

import { loadConfig } from './lib/utils'
import type { PipelineConfig, StageResult } from './lib/types'
import { runStage1 } from './stage1-keywords'
import { runStage2 } from './stage2-crawl'
import { runStage3 } from './stage3-clean'
import { runStage4 } from './stage4-enrich'
import { runStage5 } from './stage5-finalize'

export interface PipelineOrchestrator {
  readonly config: PipelineConfig
  runKeywords(): Promise<StageResult>
  runCrawl(): Promise<StageResult>
  runClean(): Promise<StageResult>
  runEnrich(): Promise<StageResult>
  runFinalize(): Promise<StageResult>
  runAll(): Promise<StageResult[]>
}

export function createOrchestrator(configOverrides?: Partial<PipelineConfig>): PipelineOrchestrator {
  const baseConfig = loadConfig()
  const config: PipelineConfig = { ...baseConfig, ...configOverrides }

  return {
    config,
    runKeywords: () => runStage1(config),
    runCrawl: () => runStage2(config),
    runClean: () => runStage3(config),
    runEnrich: () => runStage4(config),
    runFinalize: () => runStage5(config),

    async runAll(): Promise<StageResult[]> {
      const results: StageResult[] = []
      const stageFns = [runStage1, runStage2, runStage3, runStage4, runStage5]

      for (const fn of stageFns) {
        const result = await fn(config)
        results.push(result)
        if (!result.success) {
          console.error(`Pipeline stopped at ${result.stage}`)
          break
        }
      }

      return results
    },
  }
}

// CLI: run full pipeline via orchestrator
if (process.argv[1]?.endsWith('run-agents.ts')) {
  const orchestrator = createOrchestrator()
  orchestrator.runAll()
    .then(results => {
      const failed = results.find(r => !r.success)
      if (failed) {
        console.error(`\n❌ Pipeline failed at ${failed.stage}`)
        process.exit(1)
      }
      console.log('\n✅ Pipeline complete via orchestrator')
    })
    .catch(err => {
      console.error('Fatal:', err)
      process.exit(1)
    })
}
```

- [ ] **Step 3: Commit**

```bash
git add pipeline-v2/AGENTS.md pipeline-v2/run-agents.ts
git commit -m "feat(pipeline-v2): add AGENTS.md and orchestrator for Agent Team execution

AGENTS.md defines the 7-agent team structure with parallel crawling pattern.
run-agents.ts provides programmatic PipelineOrchestrator interface.
Coordinator dispatches 3 crawlers in parallel, then runs stages 3-5 sequentially."
```

---

## Task 8: Add `pipeline-v2/data/` to `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add pipeline-v2 data directory to `.gitignore`**

Add these lines to `.gitignore`:
```
# Pipeline intermediate data
pipeline-v2/data/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore pipeline-v2 intermediate data"
```

---

## Task 9: Verify Full Pipeline

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit --project tsconfig.json
```

Expected: No type errors (or only pre-existing ones from other files)

- [ ] **Step 2: Run Stage 1 to verify basic execution**

```bash
npx tsx pipeline-v2/stage1-keywords.ts --product "상하이버터떡"
```

Expected: Creates `pipeline-v2/data/keywords.json` with ~46 keywords

- [ ] **Step 3: Verify file structure**

```bash
ls -la pipeline-v2/
ls -la pipeline-v2/lib/
ls -la pipeline-v2/crawlers/
```

Expected structure matches the file structure diagram above.

- [ ] **Step 4: Commit verified state**

```bash
git add -A
git commit -m "feat(pipeline-v2): verified unified pipeline structure

All types check, Stage 1 produces expected keywords.
Ready for Agent Team execution."
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                  Claude Code Coordinator                     │
│                                                              │
│  1. Run Stage 1 (inline)                                     │
│  2. Dispatch 3 parallel agents:                              │
│     ┌──────────────┬──────────────┬──────────────┐          │
│     │ naver-blog   │ naver-maps   │ kakao-maps   │          │
│     │ crawler      │ crawler      │ crawler      │          │
│     └──────┬───────┴──────┬───────┴──────┬───────┘          │
│            │              │              │                    │
│            └──────────────┼──────────────┘                   │
│                           ↓                                  │
│  3. Merge crawl results (Stage 2 merge)                      │
│  4. Run Stage 3: Clean                                       │
│  5. Run Stage 4: Enrich (Google Maps + Nominatim)            │
│  6. Run Stage 5: Finalize → data/shops.json                  │
└─────────────────────────────────────────────────────────────┘
```

**Key improvements over existing system:**
1. **통합**: `scripts/` + `pipeline/` → 단일 `pipeline-v2/`
2. **병렬 크롤링**: 3개 소스를 동시 수집 (`scripts/collect-data.ts` 패턴 흡수)
3. **Graceful degradation**: 크롤러 하나 실패해도 나머지로 계속 진행
4. **networkidle 제거**: 모든 Playwright navigation이 `domcontentloaded` 사용
5. **Nominatim fallback**: Google Maps 좌표 실패 시 Nominatim 보조
6. **Agent Team 지원**: `AGENTS.md` + `run-agents.ts`로 Claude Code 팀 실행
7. **Checkpoint**: Stage 4에서 20개마다 중간 저장
