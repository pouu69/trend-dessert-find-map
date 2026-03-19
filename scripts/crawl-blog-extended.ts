import { chromium, type Page, type Frame } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { geocodeAddress } from './geocode.js'

interface BlogShop {
  name: string
  address: string
  phone: string
  hours: string
  placeUrl: string
  blogUrl: string
  source: string
}

interface Shop {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  hours: string
  closedDays: string[]
  priceRange: string
  tags: string[]
  description: string
  region: string
}

const KEYWORDS = [
  '상하이버터떡 파는곳',
  '상하이버터떡 맛집',
  '상해버터떡',
  '상하이 버터떡 카페',
  '상하이버터떡 베이커리',
  '상하이버터떡 추천',
  '상하이버터라이스떡',
]

const PAGES_PER_KEYWORD = 5
const EXISTING_NAMES = [
  '달리당 수원본점',
  '연남허니밀크',
  '수아카롱 본점',
  '코드91',
  '모어커피랩',
  '브리나케오슈',
]
const EXISTING_NAME_PREFIXES = ['하츠베이커리', '미구제과']

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlogPostUrl(url: string): boolean {
  return /blog\.naver\.com\/[^/]+\/\d{5,}/.test(url)
}

function isExistingShop(name: string): boolean {
  const normalized = name.replace(/\s+/g, '')
  if (EXISTING_NAMES.some((n) => normalized === n.replace(/\s+/g, ''))) return true
  if (EXISTING_NAME_PREFIXES.some((p) => normalized.startsWith(p.replace(/\s+/g, '')))) return true
  return false
}

function extractPlaceId(url: string): string | null {
  const m = url.match(/place\/(\d+)/) || url.match(/place\.naver\.com\/restaurant\/(\d+)/)
  return m ? m[1] : null
}

async function collectBlogLinks(page: Page): Promise<string[]> {
  const allLinks = new Set<string>()

  for (const keyword of KEYWORDS) {
    console.log(`\n[search] Keyword: "${keyword}"`)
    for (let pageNo = 1; pageNo <= PAGES_PER_KEYWORD; pageNo++) {
      const encoded = encodeURIComponent(keyword)
      const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encoded}`

      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000)

        const links = await page.$$eval('a', (anchors) =>
          anchors
            .map((a) => a.href)
            .filter((href) => /blog\.naver\.com\/[^/]+\/\d{5,}/.test(href))
        )

        const beforeCount = allLinks.size
        for (const link of links) {
          allLinks.add(link)
        }
        const newCount = allLinks.size - beforeCount
        console.log(`  page ${pageNo}: ${links.length} posts found, ${newCount} new (total unique: ${allLinks.size})`)
      } catch (e) {
        console.warn(`  page ${pageNo}: FAILED - ${(e as Error).message}`)
      }

      await delay(1500)
    }
  }

  console.log(`\n[search] Total unique blog posts collected: ${allLinks.size}`)
  return [...allLinks]
}

async function fetchPlaceInfo(
  context: Awaited<ReturnType<typeof chromium.launch>>['contexts'][0],
  placeId: string
): Promise<{ name: string; address: string; phone: string; category: string } | null> {
  let placePage: Page | null = null
  try {
    placePage = await context.newPage()
    const url = `https://m.place.naver.com/place/${placeId}`
    await placePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await placePage.waitForTimeout(2000)

    const name = await placePage
      .$eval('span.GHAhO, span.Fc1rA, .place_section_content .name, h2.tit', (el) =>
        el.textContent?.trim() ?? ''
      )
      .catch(() => '')

    const address = await placePage
      .$eval('.LDgIH, .place_section_content .address, span.LDgIH', (el) =>
        el.textContent?.trim() ?? ''
      )
      .catch(() => '')

    const phone = await placePage
      .$eval('.xlx7Q, .place_section_content .phone, span.xlx7Q', (el) =>
        el.textContent?.trim() ?? ''
      )
      .catch(() => '')

    const category = await placePage
      .$eval('.lnJFt, span.DJJvD, .place_section_content .category', (el) =>
        el.textContent?.trim() ?? ''
      )
      .catch(() => '')

    if (name) {
      return { name, address, phone, category }
    }
    return null
  } catch {
    return null
  } finally {
    if (placePage) await placePage.close()
  }
}

async function extractShopInfoFromPost(
  page: Page,
  blogUrl: string,
  context: Awaited<ReturnType<typeof chromium.launch>>['contexts'][0]
): Promise<BlogShop[]> {
  const shops: BlogShop[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForTimeout(2000)

    // Naver blog posts use an iframe for content
    let contentFrame: Page | Frame = page
    const mainFrame = page.frame('mainFrame')
    if (mainFrame) {
      contentFrame = mainFrame
      await mainFrame
        .waitForSelector('.se-main-container, #postViewArea, .post-view', { timeout: 5000 })
        .catch(() => null)
    }

    // Collect all place URLs found in this post
    const placeIds = new Set<string>()

    // Strategy 1: OG link cards
    const ogLinks = await contentFrame
      .$$('.se-oglink-info, .se-module-oglink, .se-section-oglink')
      .catch(() => [])
    for (const card of ogLinks) {
      const linkEl = await card.$('a')
      const href = linkEl ? ((await linkEl.getAttribute('href')) ?? '') : ''
      const pid = extractPlaceId(href)
      if (pid) placeIds.add(pid)

      const titleEl = await card.$('.se-oglink-info-title, .se-oglink-title')
      const descEl = await card.$('.se-oglink-info-summary, .se-oglink-summary, .se-oglink-info-description')
      const title = titleEl ? ((await titleEl.textContent())?.trim() ?? '') : ''
      const desc = descEl ? ((await descEl.textContent())?.trim() ?? '') : ''

      if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
        shops.push({
          name: title,
          address: desc,
          phone: '',
          hours: '',
          placeUrl: href,
          blogUrl,
          source: 'blog-oglink',
        })
      }
    }

    // Strategy 2: Direct place/map links in content
    const placeLinks = await contentFrame
      .$$('a[href*="place.naver.com"], a[href*="map.naver.com/p/entry/place"]')
      .catch(() => [])
    for (const link of placeLinks) {
      const href = (await link.getAttribute('href')) ?? ''
      const text = (await link.textContent())?.trim() ?? ''
      const pid = extractPlaceId(href)
      if (pid) placeIds.add(pid)

      if (href && text && !shops.some((s) => s.name === text)) {
        shops.push({
          name: text,
          address: '',
          phone: '',
          hours: '',
          placeUrl: href,
          blogUrl,
          source: 'blog-placelink',
        })
      }
    }

    // Strategy 3: Map iframes
    const mapIframes = await contentFrame
      .$$('iframe[src*="place.naver.com"], iframe[src*="map.naver.com"]')
      .catch(() => [])
    for (const iframeEl of mapIframes) {
      const src = (await iframeEl.getAttribute('src')) ?? ''
      const pid = extractPlaceId(src)
      if (pid) placeIds.add(pid)
    }

    // For any place IDs we found, fetch structured data
    for (const pid of placeIds) {
      const info = await fetchPlaceInfo(context, pid)
      if (info && info.name) {
        // Check if we already have this shop from OG/link extraction
        const existing = shops.find(
          (s) => s.name === info.name || s.placeUrl.includes(pid)
        )
        if (existing) {
          // Enrich existing entry
          if (!existing.address && info.address) existing.address = info.address
          if (!existing.phone && info.phone) existing.phone = info.phone
          if (!existing.name) existing.name = info.name
        } else {
          shops.push({
            name: info.name,
            address: info.address,
            phone: info.phone,
            hours: '',
            placeUrl: `https://m.place.naver.com/place/${pid}`,
            blogUrl,
            source: 'blog-place-page',
          })
        }
      }
      await delay(1000)
    }

    // Strategy 4: Text extraction (only if no place links found)
    const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '')

    const strictAddressPattern =
      /(?:서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|대전광역시|대전시|울산광역시|울산시|세종특별자치시|세종시|경기도|경기|강원도|강원|충청북도|충청남도|충북|충남|전라북도|전라남도|전북특별자치도|전북|전남|경상북도|경상남도|경북|경남|제주특별자치도|제주도|제주)\s*[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리가]\s*[0-9\-가-힣]*/g
    const addresses = bodyText.match(strictAddressPattern) ?? []
    const uniqueAddresses = [...new Set(addresses.map((a) => a.trim()))].filter(
      (a) => a.length >= 10 && a.length <= 80
    )

    const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
    const phones = bodyText.match(phonePattern) ?? []

    const hoursPattern = /(?:영업시간|운영시간)\s*[:：]?\s*([^\n]{5,50})/gi
    const hoursMatches = [...bodyText.matchAll(hoursPattern)].map((m) => m[0].trim())

    // Shop name candidates from headings/bold text
    const shopNameCandidates: string[] = []
    const headingTexts = await contentFrame
      .$$eval('strong, b, h2, h3, h4', (els) =>
        els
          .map((el) => el.textContent?.trim().replace(/\n/g, ' ') ?? '')
          .filter((t) => t.length >= 2 && t.length <= 30)
      )
      .catch(() => [] as string[])

    for (const ht of headingTexts) {
      if (
        /^[가-힣]{2,10}\s*(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|떡카페|카페|공방|제과|제과점|디저트)$/.test(
          ht
        )
      ) {
        shopNameCandidates.push(ht)
      }
    }

    const nameInTextPattern =
      /[가-힣]{2,10}(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|카페|디저트카페|공방|제과점|제과)/g
    const nameMatches = bodyText.match(nameInTextPattern) ?? []
    for (const nm of nameMatches) {
      const cleaned = nm.trim()
      if (
        cleaned.length >= 4 &&
        !cleaned.startsWith('파는곳') &&
        !cleaned.startsWith('하는') &&
        !cleaned.startsWith('맛집') &&
        !cleaned.startsWith('맛있는') &&
        !cleaned.startsWith('최강') &&
        !cleaned.startsWith('인생') &&
        !cleaned.startsWith('핫한') &&
        !cleaned.startsWith('새로운') &&
        !cleaned.startsWith('대세') &&
        !cleaned.startsWith('서울') &&
        !cleaned.startsWith('대구') &&
        !shopNameCandidates.includes(cleaned)
      ) {
        shopNameCandidates.push(cleaned)
      }
    }

    // Only create text-based entries if no structured data found
    if (shops.length === 0 && uniqueAddresses.length > 0) {
      const usedNames = new Set<string>()
      for (let i = 0; i < uniqueAddresses.length; i++) {
        const name = shopNameCandidates.find((n) => !usedNames.has(n)) ?? ''
        if (name) usedNames.add(name)
        shops.push({
          name,
          address: uniqueAddresses[i],
          phone: phones[i] ?? phones[0] ?? '',
          hours: hoursMatches[0] ?? '',
          placeUrl: '',
          blogUrl,
          source: 'blog-text-extraction',
        })
      }
    } else if (shops.length === 0 && shopNameCandidates.length > 0 && phones.length > 0) {
      shops.push({
        name: shopNameCandidates[0],
        address: '',
        phone: phones[0],
        hours: hoursMatches[0] ?? '',
        placeUrl: '',
        blogUrl,
        source: 'blog-text-extraction',
      })
    }

    // Enrich existing shops with missing data from text
    for (const shop of shops) {
      if (!shop.address && uniqueAddresses.length > 0) shop.address = uniqueAddresses[0]
      if (!shop.phone && phones.length > 0) shop.phone = phones[0]
      if (!shop.hours && hoursMatches.length > 0) shop.hours = hoursMatches[0]
      if (!shop.name && shopNameCandidates.length > 0) shop.name = shopNameCandidates[0]
    }
  } catch (e) {
    console.warn(`  FAILED: ${(e as Error).message}`)
  }

  return shops
}

function normalizeForDedup(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/[점호층]/g, '')
    .toLowerCase()
}

function extractDistrict(address: string): string {
  // Extract up to the 구/군/시 level
  const m = address.match(
    /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣]*\s*[가-힣]+[시구군]/
  )
  return m ? m[0].replace(/\s+/g, '') : ''
}

function extractRegion(address: string): string {
  if (/서울/.test(address)) return '서울'
  if (/부산/.test(address)) return '부산'
  if (/대구/.test(address)) return '대구'
  if (/인천/.test(address)) return '인천'
  if (/광주/.test(address)) return '광주'
  if (/대전/.test(address)) return '대전'
  if (/울산/.test(address)) return '울산'
  if (/세종/.test(address)) return '세종'
  if (/경기/.test(address)) return '경기'
  if (/강원/.test(address)) return '강원'
  if (/충북|충청북/.test(address)) return '충북'
  if (/충남|충청남/.test(address)) return '충남'
  if (/전북|전라북/.test(address)) return '전북'
  if (/전남|전라남/.test(address)) return '전남'
  if (/경북|경상북/.test(address)) return '경북'
  if (/경남|경상남/.test(address)) return '경남'
  if (/제주/.test(address)) return '제주'
  return ''
}

function simplifyAddress(address: string): string {
  // Remove floor numbers, building names for better geocoding
  return address
    .replace(/\s*\d+층.*$/, '')
    .replace(/\s*지하\d+층.*$/, '')
    .replace(/\s+[가-힣]+빌딩.*$/, '')
    .replace(/\s+[가-힣]+상가.*$/, '')
    .replace(/\s+[가-힣]+타워.*$/, '')
    .replace(/\s+[가-힣]+센터.*$/, '')
    .replace(/\s+\(.*\)$/, '')
    .trim()
}

async function main() {
  console.log('=== Shanghai Butter Rice Cake - Extended Blog Crawl ===\n')

  const shopsJsonPath = resolve(
    path.join(__dirname, '../data/shops.json')
  )
  const existingShops: Shop[] = JSON.parse(readFileSync(shopsJsonPath, 'utf-8'))
  console.log(`[init] Loaded ${existingShops.length} existing shops\n`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allRawShops: BlogShop[] = []

  try {
    // Step 1: Collect blog links across all keywords
    const blogLinks = await collectBlogLinks(page)
    console.log(`\n[crawl] Will visit ${blogLinks.length} unique blog posts\n`)

    // Step 2: Visit each blog post
    for (let i = 0; i < blogLinks.length; i++) {
      const link = blogLinks[i]
      console.log(`[post ${i + 1}/${blogLinks.length}] ${link}`)

      const shops = await extractShopInfoFromPost(page, link, context)

      if (shops.length > 0) {
        for (const shop of shops) {
          console.log(
            `  >> ${shop.name || '?'} | ${shop.address || '?'} | ${shop.phone || '-'} [${shop.source}]`
          )
          allRawShops.push(shop)
        }
      } else {
        console.log('  >> (nothing extracted)')
      }

      await delay(1500)
    }
  } catch (e) {
    console.error('[fatal]', e)
  } finally {
    await browser.close()
  }

  // Step 3: Deduplicate raw shops
  console.log(`\n[dedup] Raw shops collected: ${allRawShops.length}`)

  // First pass: remove entries with no name and no address
  const validShops = allRawShops.filter((s) => s.name || s.address)
  console.log(`[dedup] After removing empty: ${validShops.length}`)

  // Second pass: deduplicate by normalized name + district
  const dedupMap = new Map<string, BlogShop>()
  for (const shop of validShops) {
    const normName = normalizeForDedup(shop.name)
    const district = extractDistrict(shop.address)
    const key = `${normName}|${district}`

    if (!dedupMap.has(key)) {
      dedupMap.set(key, shop)
    } else {
      // Merge: prefer entries with more data
      const existing = dedupMap.get(key)!
      if (!existing.address && shop.address) existing.address = shop.address
      if (!existing.phone && shop.phone) existing.phone = shop.phone
      if (!existing.hours && shop.hours) existing.hours = shop.hours
      if (!existing.name && shop.name) existing.name = shop.name
      if (!existing.placeUrl && shop.placeUrl) existing.placeUrl = shop.placeUrl
    }
  }

  const uniqueShops = [...dedupMap.values()]
  console.log(`[dedup] After deduplication: ${uniqueShops.length}`)

  // Step 4: Filter out already-existing shops
  const newShops = uniqueShops.filter((s) => {
    if (!s.name) return false
    if (isExistingShop(s.name)) {
      console.log(`[skip] Already exists: ${s.name}`)
      return false
    }
    // Also check by address match against existing
    if (
      s.address &&
      existingShops.some((es) => {
        const norm1 = es.address.replace(/\s+/g, '')
        const norm2 = s.address.replace(/\s+/g, '')
        return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)
      })
    ) {
      console.log(`[skip] Address match: ${s.name} - ${s.address}`)
      return false
    }
    return true
  })

  console.log(`\n[new] New shops to add: ${newShops.length}`)
  for (const s of newShops) {
    console.log(`  - ${s.name} | ${s.address} | ${s.phone}`)
  }

  // Step 5: Geocode new addresses
  console.log(`\n[geocode] Geocoding ${newShops.length} new shop addresses...`)
  const geocodedData: Array<{ lat: number | null; lng: number | null }> = []

  for (const shop of newShops) {
    if (!shop.address) {
      geocodedData.push({ lat: null, lng: null })
      continue
    }

    // Try full address first
    let result = await geocodeAddress(shop.address)
    if (!result) {
      // Try simplified address
      const simplified = simplifyAddress(shop.address)
      if (simplified !== shop.address) {
        console.log(`  [retry] Trying simplified: ${simplified}`)
        await delay(1100)
        result = await geocodeAddress(simplified)
      }
    }

    if (result) {
      console.log(`  [ok] ${shop.name}: ${result.lat}, ${result.lng}`)
    } else {
      console.log(`  [fail] ${shop.name}: could not geocode`)
    }

    geocodedData.push(result ?? { lat: null, lng: null })
    await delay(1100)
  }

  // Step 6: Build new Shop entries
  const nextId = existingShops.length + 1
  const newShopEntries: Shop[] = newShops.map((s, i) => {
    const id = `shop-${String(nextId + i).padStart(3, '0')}`
    const region = extractRegion(s.address)

    // Determine tags from source or name
    const tags: string[] = []
    const nameLower = s.name.toLowerCase()
    if (/베이커리|제과/.test(nameLower)) {
      tags.push('제과', '베이커리')
    } else if (/카페|커피/.test(nameLower)) {
      tags.push('카페')
    } else if (/디저트/.test(nameLower)) {
      tags.push('디저트카페')
    } else {
      tags.push('제과', '베이커리')
    }

    // Build description
    const categoryText = tags[0] || '매장'
    const desc = `상하이버터떡 판매 ${categoryText}`

    return {
      id,
      name: s.name,
      address: s.address,
      lat: geocodedData[i].lat,
      lng: geocodedData[i].lng,
      phone: s.phone,
      hours: s.hours,
      closedDays: [],
      priceRange: '',
      tags,
      description: desc,
      region,
    }
  })

  // Step 7: Merge and write
  const mergedShops = [...existingShops, ...newShopEntries]
  writeFileSync(shopsJsonPath, JSON.stringify(mergedShops, null, 2) + '\n', 'utf-8')

  console.log(`\n========================================`)
  console.log(`SUMMARY`)
  console.log(`========================================`)
  console.log(`Existing shops: ${existingShops.length}`)
  console.log(`New shops added: ${newShopEntries.length}`)
  console.log(`Total shops now: ${mergedShops.length}`)
  console.log(`\nNew shops:`)
  for (const s of newShopEntries) {
    console.log(
      `  ${s.id} | ${s.name} | ${s.address} | ${s.lat ?? '?'},${s.lng ?? '?'} | ${s.phone || '-'}`
    )
  }
  console.log(`\nWritten to: ${shopsJsonPath}`)
}

main()
