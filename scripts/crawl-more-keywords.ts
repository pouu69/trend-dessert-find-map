import { chromium, type Page, type Frame } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

interface ShopResult {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  keyword: string
  blogUrl: string
}

const KEYWORDS = [
  '상하이버터떡 택배',
  '버터라이스떡 파는곳',
  '상하이떡 카페',
  '상하이버터떡 오픈',
  '상하이버터떡 신상',
  '상하이버터떡 디저트',
  '상하이버터떡 매장',
  '상하이버터라이스케이크',
  '천안 상하이버터떡',
  '울산 상하이버터떡',
  '창원 상하이버터떡',
  '세종 상하이버터떡',
  '제주 상하이버터떡',
  '강릉 상하이버터떡',
  '청주 상하이버터떡',
]

const PAGES_PER_KEYWORD = 2
const MAX_POSTS_PER_KEYWORD = 10

const EXISTING_NAMES = [
  '달리당',
  '연남허니밀크',
  '수아카롱',
  '코드91',
  '모어커피랩',
  '브리나케오슈',
  '위치앙베이커리',
  '야탑버터떡카페',
  '스칼렛베이커리',
  '몰레디저트카페',
  '디저트릭',
  '휘도르베이커리카페',
  '겐츠베이커리',
  '김덕규베이커리',
]
const EXISTING_NAME_PREFIXES = ['하츠베이커리', '미구제과']

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isExistingShop(name: string): boolean {
  const normalized = name.replace(/\s+/g, '')
  if (EXISTING_NAMES.some((n) => normalized.includes(n.replace(/\s+/g, '')))) return true
  if (EXISTING_NAME_PREFIXES.some((p) => normalized.startsWith(p.replace(/\s+/g, '')))) return true
  return false
}

function extractPlaceId(url: string): string | null {
  const m = url.match(/place\/(\d+)/) || url.match(/place\.naver\.com\/restaurant\/(\d+)/)
  return m ? m[1] : null
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
  keyword: string,
  context: Awaited<ReturnType<typeof chromium.launch>>['contexts'][0]
): Promise<ShopResult[]> {
  const shops: ShopResult[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForTimeout(2000)

    let contentFrame: Page | Frame = page
    const mainFrame = page.frame('mainFrame')
    if (mainFrame) {
      contentFrame = mainFrame
      await mainFrame
        .waitForSelector('.se-main-container, #postViewArea, .post-view', { timeout: 5000 })
        .catch(() => null)
    }

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
      const title = titleEl ? ((await titleEl.textContent())?.trim() ?? '') : ''

      if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
        shops.push({
          name: title,
          address: '',
          phone: '',
          hours: '',
          category: '',
          keyword,
          blogUrl,
        })
      }
    }

    // Strategy 2: Direct place/map links
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
          category: '',
          keyword,
          blogUrl,
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

    // Fetch place info for discovered IDs
    for (const pid of placeIds) {
      const info = await fetchPlaceInfo(context, pid)
      if (info && info.name) {
        const existing = shops.find(
          (s) => s.name === info.name || (s.blogUrl === blogUrl && shops.length === 1 && !s.address)
        )
        if (existing) {
          if (!existing.address && info.address) existing.address = info.address
          if (!existing.phone && info.phone) existing.phone = info.phone
          if (!existing.category && info.category) existing.category = info.category
          if (!existing.name) existing.name = info.name
        } else {
          shops.push({
            name: info.name,
            address: info.address,
            phone: info.phone,
            hours: '',
            category: info.category,
            keyword,
            blogUrl,
          })
        }
      }
      await delay(1000)
    }

    // Strategy 4: Text extraction fallback
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

    // Shop name candidates
    const nameInTextPattern =
      /[가-힣]{2,10}(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|카페|디저트카페|공방|제과점|제과)/g
    const nameMatches = bodyText.match(nameInTextPattern) ?? []

    if (shops.length === 0 && uniqueAddresses.length > 0) {
      const name = nameMatches.length > 0 ? nameMatches[0].trim() : ''
      shops.push({
        name,
        address: uniqueAddresses[0],
        phone: phones[0] ?? '',
        hours: hoursMatches[0] ?? '',
        category: '',
        keyword,
        blogUrl,
      })
    }

    // Enrich existing shops with text-extracted data
    for (const shop of shops) {
      if (!shop.address && uniqueAddresses.length > 0) shop.address = uniqueAddresses[0]
      if (!shop.phone && phones.length > 0) shop.phone = phones[0]
      if (!shop.hours && hoursMatches.length > 0) shop.hours = hoursMatches[0]
    }
  } catch (e) {
    console.warn(`  WARNING: Failed to extract from ${blogUrl}: ${(e as Error).message}`)
  }

  return shops
}

function normalizeForDedup(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/[점호층]/g, '')
    .toLowerCase()
}

async function main() {
  console.log('=== Shanghai Butter Rice Cake - More Keywords Blog Crawl ===\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allRawShops: ShopResult[] = []

  try {
    for (const keyword of KEYWORDS) {
      console.log(`\n[keyword] "${keyword}"`)

      // Collect blog post links for this keyword (pages 1-2)
      const blogLinks: string[] = []
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

          for (const link of links) {
            if (!blogLinks.includes(link)) {
              blogLinks.push(link)
            }
          }
          console.log(`  page ${pageNo}: ${links.length} posts found (unique so far: ${blogLinks.length})`)
        } catch (e) {
          console.warn(`  page ${pageNo}: FAILED - ${(e as Error).message}`)
        }

        await delay(1500)
      }

      // Visit up to MAX_POSTS_PER_KEYWORD blog posts
      const postsToVisit = blogLinks.slice(0, MAX_POSTS_PER_KEYWORD)
      console.log(`  Visiting ${postsToVisit.length} posts...`)

      for (let i = 0; i < postsToVisit.length; i++) {
        const link = postsToVisit[i]
        console.log(`  [post ${i + 1}/${postsToVisit.length}] ${link}`)

        try {
          const shops = await extractShopInfoFromPost(page, link, keyword, context)

          if (shops.length > 0) {
            for (const shop of shops) {
              console.log(
                `    >> ${shop.name || '?'} | ${shop.address || '?'} | ${shop.phone || '-'} | ${shop.category || '-'}`
              )
              allRawShops.push(shop)
            }
          } else {
            console.log('    >> (nothing extracted)')
          }
        } catch (e) {
          console.warn(`    WARNING: Skipping post - ${(e as Error).message}`)
        }

        await delay(1500)
      }
    }
  } catch (e) {
    console.error('[fatal]', e)
  } finally {
    await browser.close()
  }

  // Deduplicate
  console.log(`\n[dedup] Raw shops collected: ${allRawShops.length}`)

  const validShops = allRawShops.filter((s) => s.name)
  console.log(`[dedup] With names: ${validShops.length}`)

  // Remove existing shops
  const nonExisting = validShops.filter((s) => {
    if (isExistingShop(s.name)) {
      console.log(`[skip] Already known: ${s.name}`)
      return false
    }
    return true
  })
  console.log(`[dedup] After removing known shops: ${nonExisting.length}`)

  // Deduplicate by normalized name
  const dedupMap = new Map<string, ShopResult>()
  for (const shop of nonExisting) {
    const key = normalizeForDedup(shop.name)
    if (!dedupMap.has(key)) {
      dedupMap.set(key, shop)
    } else {
      const existing = dedupMap.get(key)!
      if (!existing.address && shop.address) existing.address = shop.address
      if (!existing.phone && shop.phone) existing.phone = shop.phone
      if (!existing.hours && shop.hours) existing.hours = shop.hours
      if (!existing.category && shop.category) existing.category = shop.category
    }
  }

  const uniqueShops = [...dedupMap.values()]
  console.log(`[dedup] Unique new shops: ${uniqueShops.length}`)

  // Write results
  const outputPath = resolve(
    '/Users/kwanung/development/experiments/shanghai-butter-rice/scripts/more-keywords-results.json'
  )
  writeFileSync(outputPath, JSON.stringify(uniqueShops, null, 2) + '\n', 'utf-8')

  console.log(`\n========================================`)
  console.log(`SUMMARY`)
  console.log(`========================================`)
  console.log(`Keywords searched: ${KEYWORDS.length}`)
  console.log(`Raw shops extracted: ${allRawShops.length}`)
  console.log(`NEW unique shops found: ${uniqueShops.length}`)
  console.log(`\nNew shops:`)
  for (const s of uniqueShops) {
    console.log(`  - ${s.name} | ${s.address || '?'} | ${s.phone || '-'} | keyword: "${s.keyword}"`)
  }
  console.log(`\nResults written to: ${outputPath}`)
}

main()
