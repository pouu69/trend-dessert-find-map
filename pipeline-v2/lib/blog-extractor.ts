import type { Page } from 'playwright'
// No external type imports needed for source

/**
 * Extracted shop candidate with confidence scoring.
 * Multiple extraction strategies produce candidates,
 * which are then merged and ranked by confidence.
 */
export interface ShopCandidate {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly lat: number | null
  readonly lng: number | null
  readonly confidence: number // 0.0 ~ 1.0
  readonly extractionMethod: string
}

/** Final output matching RawShop + optional pre-extracted coordinates */
export interface ExtractedShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly source: string
  readonly keyword: string
  readonly blogUrl: string
  readonly lat: number | null
  readonly lng: number | null
  readonly confidence: number
  readonly extractionMethod: string
}

// ─── Regex Patterns ─────────────────────────────────────────

/** 도로명주소: "서울특별시 강남구 테헤란로 123" or "울산광역시 남구 야음로 15 1층" */
const ROAD_ADDRESS = /([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)\s+[가-힣]+(?:시|군|구)(?:\s+[가-힣]+(?:구|동|면|읍))?\s+[가-힣0-9]+(?:로|길)\s*[0-9\-]+(?:[가-힣0-9\s,\-]*)?)/g

/** 간략 주소: "강남구 테헤란로 123" (시/도 없이 구부터 시작) */
const SHORT_ADDRESS = /([가-힣]+(?:시|군|구)\s+[가-힣0-9]+(?:로|길)\s*[0-9\-]+)/g

/** 전화번호 */
const PHONE = /(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g

/** 영업시간: "09:00~21:00", "8:30 ~ 21:00", "오전 9시 - 오후 9시" */
const HOURS_COLON = /(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})/g
const HOURS_KOREAN = /(오전|오후)?\s*(\d{1,2})시\s*[~\-–]\s*(오전|오후)?\s*(\d{1,2})시/g

/** Naver Static Map URL에서 좌표 추출: markers=pos%3A{lon}%20{lat} */
const NAVER_MAP_COORDS = /markers=pos%3A(-?\d+\.?\d*)%20(-?\d+\.?\d*)/

// ─── Strategy 1: SmartEditor Place Map Block ────────────────

async function extractFromPlaceMapBlocks(frame: Page): Promise<ShopCandidate[]> {
  const candidates: ShopCandidate[] = []

  const blocks = await frame.$$('div.se-placesMap, div.se-component.se-placesMap').catch(() => [])

  for (const block of blocks) {
    const name = await block.$eval(
      'strong.se-map-title, a.se-map-info strong',
      el => el.textContent?.trim() || '',
    ).catch(() => '')

    const address = await block.$eval(
      'p.se-map-address, a.se-map-info p',
      el => el.textContent?.trim() || '',
    ).catch(() => '')

    // Extract GPS coordinates from static map image URL
    let lat: number | null = null
    let lng: number | null = null
    const imgSrc = await block.$eval(
      'img.se-map-image, img[src*="navermaps"]',
      el => el.getAttribute('src') || '',
    ).catch(() => '')

    if (imgSrc) {
      const coordMatch = imgSrc.match(NAVER_MAP_COORDS)
      if (coordMatch) {
        lng = parseFloat(coordMatch[1])
        lat = parseFloat(coordMatch[2])
        // Validate South Korea bounds
        if (lat < 33 || lat > 39 || lng < 124.5 || lng > 132) {
          lat = null
          lng = null
        }
      }
    }

    if (name && name.length >= 2) {
      candidates.push({
        name,
        address,
        phone: '',
        hours: '',
        lat,
        lng,
        confidence: 0.95, // Structured data — highest confidence
        extractionMethod: 'smarteditor-place-map',
      })
    }
  }

  return candidates
}

// ─── Strategy 2: Naver Place Links ──────────────────────────

async function extractFromPlaceLinks(frame: Page): Promise<ShopCandidate[]> {
  const candidates: ShopCandidate[] = []

  const links = await frame.$$eval(
    'a[href*="place.naver.com"], a[href*="map.naver.com/entry/place"]',
    (anchors: HTMLAnchorElement[]) => anchors.map(a => ({
      text: a.textContent?.trim() || '',
      href: a.href,
    })),
  ).catch(() => [])

  for (const link of links) {
    const name = link.text
    if (name.length >= 2 && name.length < 50) {
      candidates.push({
        name,
        address: '',
        phone: '',
        hours: '',
        lat: null,
        lng: null,
        confidence: 0.85, // Place link — high confidence for name
        extractionMethod: 'naver-place-link',
      })
    }
  }

  return candidates
}

// ─── Strategy 3: Structured Text Analysis ───────────────────

interface TextBlock {
  readonly text: string
  readonly tag: string
  readonly index: number
}

async function extractFromTextAnalysis(
  frame: Page,
  keyword: string,
  knownAddresses: ReadonlySet<string> = new Set(),
): Promise<ShopCandidate[]> {
  const candidates: ShopCandidate[] = []

  // Get structured text blocks (headings, bold, paragraphs) with position info
  const textBlocks: TextBlock[] = await frame.evaluate(() => {
    const blocks: { text: string; tag: string; index: number }[] = []
    const container = document.querySelector('.se-main-container')
      || document.querySelector('.post-view')
      || document.querySelector('#content')
      || document.body

    if (!container) return blocks

    const fullText = container.textContent || ''
    const elements = container.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, strong, b, em, p, span.se-fs-, div.se-text-paragraph',
    )

    for (const el of elements) {
      const text = el.textContent?.trim() || ''
      if (text.length < 2 || text.length > 200) continue
      const tag = el.tagName.toLowerCase()
      const index = fullText.indexOf(text)
      blocks.push({ text, tag, index })
    }

    return blocks
  }).catch(() => [])

  // Get full text for pattern matching
  const fullText = await frame.evaluate(() => {
    const el = document.querySelector('.se-main-container')
      || document.querySelector('.post-view')
      || document.querySelector('#content')
      || document.body
    return el?.textContent || ''
  }).catch(() => '')

  if (!fullText) return candidates

  // Extract all addresses
  const addresses = findAllMatches(fullText, ROAD_ADDRESS)
  const shortAddresses = findAllMatches(fullText, SHORT_ADDRESS)

  // Extract all phones and hours
  const phones = findAllMatches(fullText, PHONE)
  const hoursColon = findAllMatches(fullText, HOURS_COLON)
  const hoursKorean = findAllMatches(fullText, HOURS_KOREAN)
  const allHours = [...hoursColon, ...hoursKorean]

  // For each address found, search nearby text for shop name
  for (const addr of [...addresses, ...shortAddresses]) {
    // Skip addresses already covered by higher-confidence strategies
    const cleanedAddr = cleanAddress(addr.text)
    const alreadyCovered = [...knownAddresses].some(
      known => known.includes(cleanedAddr) || cleanedAddr.includes(known),
    )
    if (alreadyCovered) continue

    const nearbyName = findShopNameNearAddress(textBlocks, fullText, addr, keyword)
    if (!nearbyName) continue

    // Find nearest phone and hours to this address
    const nearestPhone = findNearestMatch(phones, addr.index, fullText)
    const nearestHours = findNearestMatch(allHours, addr.index, fullText)

    candidates.push({
      name: nearbyName,
      address: addr.text.trim(),
      phone: nearestPhone?.text.replace(/[-.\s]/g, '').replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, '$1-$2-$3') || '',
      hours: nearestHours?.text || '',
      lat: null,
      lng: null,
      confidence: 0.6,
      extractionMethod: 'text-analysis-address-proximity',
    })
  }

  return candidates
}

// ─── Strategy 4: Title + Content Keyword Match ──────────────

async function extractFromTitleAndKeyword(
  frame: Page,
  keyword: string,
): Promise<ShopCandidate[]> {
  const candidates: ShopCandidate[] = []

  // Blog post titles often contain shop name: "OOO카페 버터떡 후기"
  const titleText = await frame.evaluate(() => {
    const titleEl = document.querySelector('.se-title-text, .pcol1, h3.se_textarea')
    return titleEl?.textContent?.trim() || ''
  }).catch(() => '')

  if (!titleText) return candidates

  // Extract potential shop names from title
  // Pattern: Korean name (2-15 chars) that's NOT the keyword itself
  const keywordNormalized = keyword.replace(/\s/g, '')
  const titleShopName = extractShopNameFromTitle(titleText, keywordNormalized)

  if (titleShopName) {
    candidates.push({
      name: titleShopName,
      address: '',
      phone: '',
      hours: '',
      lat: null,
      lng: null,
      confidence: 0.4, // Title-only — needs enrichment to confirm
      extractionMethod: 'title-keyword-extraction',
    })
  }

  return candidates
}

// ─── Helper Functions ───────────────────────────────────────

interface MatchResult {
  readonly text: string
  readonly index: number
}

function findAllMatches(text: string, pattern: RegExp): MatchResult[] {
  const results: MatchResult[] = []
  const regex = new RegExp(pattern.source, pattern.flags)
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    results.push({ text: match[0], index: match.index })
  }

  return results
}

function findNearestMatch(
  matches: readonly MatchResult[],
  targetIndex: number,
  _fullText: string,
): MatchResult | null {
  if (matches.length === 0) return null

  let nearest: MatchResult | null = null
  let minDistance = Infinity

  for (const m of matches) {
    const dist = Math.abs(m.index - targetIndex)
    if (dist < minDistance && dist < 500) { // Within 500 chars
      minDistance = dist
      nearest = m
    }
  }

  return nearest
}

/**
 * Find shop name near an address by analyzing nearby text blocks.
 * Uses proximity + structural weight (headings/bold score higher).
 */
function findShopNameNearAddress(
  blocks: readonly TextBlock[],
  fullText: string,
  address: MatchResult,
  keyword: string,
): string | null {
  const keywordNorm = keyword.replace(/\s/g, '').toLowerCase()

  // Score each text block by proximity to address and structural importance
  const scored: { text: string; score: number }[] = []

  for (const block of blocks) {
    const distance = Math.abs(block.index - address.index)
    if (distance > 800) continue // Too far

    const text = block.text.trim()

    // Skip if it's the address itself or too short/long
    if (text === address.text) continue
    if (text.length < 2 || text.length > 30) continue

    // Skip if it contains the search keyword (not a shop name)
    if (text.replace(/\s/g, '').toLowerCase().includes(keywordNorm)) continue

    // Skip generic words
    if (isGenericText(text)) continue

    let score = 0

    // Structural weight
    if (['h1', 'h2', 'h3', 'h4'].includes(block.tag)) score += 3
    if (['strong', 'b'].includes(block.tag)) score += 2
    if (block.tag === 'em') score += 1

    // Proximity score (closer = higher)
    score += Math.max(0, 5 - distance / 200)

    // Shop name patterns boost
    if (looksLikeShopName(text)) score += 4

    if (score > 2) {
      scored.push({ text, score })
    }
  }

  if (scored.length === 0) return null

  // Return highest scoring candidate
  scored.sort((a, b) => b.score - a.score)
  return scored[0].text
}

/** Extract shop name from blog post title */
function extractShopNameFromTitle(title: string, keywordNorm: string): string | null {
  // Remove keyword from title
  const cleaned = title.replace(new RegExp(keywordNorm.split('').join('\\s*'), 'gi'), '')

  // Common title patterns: "OOO카페 방문후기", "서울 OOO 베이커리"
  // Remove common suffixes
  const withoutSuffix = cleaned
    .replace(/\s*(방문|후기|리뷰|추천|맛집|파는곳|판매|매장|먹방|빵지순례|디저트투어).*$/g, '')
    .replace(/\s*(서울|부산|대구|인천|광주|대전|울산|경기|강원|충북|충남|전북|전남|경북|경남|제주|수원|성남|분당|용인)\s*/g, ' ')
    .trim()

  // Find the longest Korean word group that looks like a shop name
  const nameMatch = withoutSuffix.match(/([가-힣A-Za-z0-9]{2,20})/g)
  if (!nameMatch) return null

  // Filter and pick the best candidate
  const candidates = nameMatch
    .filter(n => n.length >= 2 && n.length <= 20)
    .filter(n => !isGenericText(n))
    .filter(n => looksLikeShopName(n) || n.length >= 3)

  return candidates.length > 0 ? candidates[0] : null
}

/** Check if text looks like a Korean shop name */
function looksLikeShopName(text: string): boolean {
  const shopSuffixes = [
    '카페', '빵집', '베이커리', '제과', '당', '점', '관', '집', '방',
    '파티세리', '아뜰리에', '스토어', '마켓', '공방', '하우스',
    '키친', '플레이스', '테이블', '브레드', '케이크',
  ]
  return shopSuffixes.some(suffix => text.endsWith(suffix))
}

/** Check if text is generic (not a shop name) */
function isGenericText(text: string): boolean {
  const genericPatterns = [
    /^(맛있|예쁜|좋은|추천|인기|유명|핫한|새로운)/, // Adjectives
    /^(오늘|어제|지난|이번|매주|항상)/, // Time words
    /^(그런데|그래서|하지만|그리고|또한)/, // Conjunctions
    /^\d+[원만천]/, // Prices
    /^(주소|전화|번호|영업|시간|위치|가격|메뉴|주차)$/, // Label words
    /^(네이버|카카오|인스타|블로그)/, // Platform names
    /지도\s*(컨트롤러|데이터|로딩)/, // Naver map UI elements
    /범례/, // Map legend
    /^[📍📞🏠🕐☎️📱]/, // Emoji prefixed text (not a name)
    /^0\d{1,2}[-.\s]?\d{3,4}/, // Phone number as name
    /로딩중/, // Loading text
    /확대|축소|현재\s*위치/, // Map control labels
    /^(지도|약도|위치|길찾기|내비)$/, // Map-related single words
    /^(더보기|접기|펼치기|공유|저장)$/, // UI action words
    /^(출처|사진|이미지|영상|동영상)$/, // Media labels
    /읽어주셔서|감사합니다|팔로우|구독/, // Blog closing phrases
  ]
  return genericPatterns.some(p => p.test(text.trim()))
}

/** Clean address string by removing HTML artifacts and normalizing whitespace */
function cleanAddress(address: string): string {
  return address
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ─── Main Extraction Orchestrator ───────────────────────────

/**
 * Extract shop information from a Naver blog post using multiple strategies.
 *
 * Strategy priority (by confidence):
 * 1. SmartEditor Place Map blocks (0.95) — structured name + address + GPS
 * 2. Naver Place links (0.85) — reliable name
 * 3. Text analysis with address proximity (0.6) — name inferred from context
 * 4. Title keyword extraction (0.4) — last resort
 *
 * Results are deduplicated and merged by name similarity.
 */
export async function extractShopsFromBlogPost(
  page: Page,
  keyword: string,
  blogUrl: string,
): Promise<ExtractedShop[]> {
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

  // Run high-confidence strategies first
  const [placeMapResults, placeLinkResults] = await Promise.all([
    extractFromPlaceMapBlocks(contentFrame).catch(() => []),
    extractFromPlaceLinks(contentFrame).catch(() => []),
  ])

  // Collect addresses already found by high-confidence strategies
  const knownAddresses = new Set(
    [...placeMapResults, ...placeLinkResults]
      .map(c => cleanAddress(c.address))
      .filter(a => a.length > 0),
  )

  // Run lower-confidence strategies, skipping already-covered addresses
  const [textResults, titleResults] = await Promise.all([
    extractFromTextAnalysis(contentFrame, keyword, knownAddresses).catch(() => []),
    extractFromTitleAndKeyword(contentFrame, keyword).catch(() => []),
  ])

  const allCandidates = [
    ...placeMapResults,
    ...placeLinkResults,
    ...textResults,
    ...titleResults,
  ]

  if (allCandidates.length === 0) return []

  // Merge candidates by name similarity
  const merged = mergeCandidates(allCandidates)

  // Convert to ExtractedShop format, filter out junk
  const source = 'naver-blog'
  return merged
    .filter(c => !isGenericText(c.name))
    .map(c => ({
      name: c.name,
      address: cleanAddress(c.address),
      phone: c.phone,
      hours: c.hours,
      category: '',
      source,
      keyword,
      blogUrl,
      lat: c.lat,
      lng: c.lng,
      confidence: c.confidence,
      extractionMethod: c.extractionMethod,
    }))
}

/**
 * Merge candidates with similar names, keeping highest confidence data.
 * If two candidates have similar names, merge their fields
 * (prefer non-empty values from higher confidence source).
 */
function mergeCandidates(candidates: readonly ShopCandidate[]): ShopCandidate[] {
  // Sort by confidence descending
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence)
  const merged: ShopCandidate[] = []

  for (const candidate of sorted) {
    const existingIndex = merged.findIndex(
      m => normalizeForCompare(m.name) === normalizeForCompare(candidate.name),
    )

    if (existingIndex >= 0) {
      const existing = merged[existingIndex]
      // Merge: keep higher confidence values, fill missing fields
      merged[existingIndex] = {
        name: existing.name, // Keep higher confidence name
        address: existing.address || candidate.address,
        phone: existing.phone || candidate.phone,
        hours: existing.hours || candidate.hours,
        lat: existing.lat ?? candidate.lat,
        lng: existing.lng ?? candidate.lng,
        confidence: Math.max(existing.confidence, candidate.confidence),
        extractionMethod: existing.extractionMethod,
      }
    } else {
      merged.push({ ...candidate })
    }
  }

  return merged
}

function normalizeForCompare(name: string): string {
  return name.replace(/[\s\-·.,():/]/g, '').toLowerCase()
}
