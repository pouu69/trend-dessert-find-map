import { chromium, type Page, type Frame } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

interface CityShop {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  keyword: string
  blogUrl: string
}

const KEYWORDS = [
  '부산 상하이버터떡 파는곳',
  '대전 상하이버터떡 파는곳',
  '광주 상하이버터떡 파는곳',
  '수원 상하이버터떡 파는곳',
  '인천 상하이버터떡 파는곳',
  '성남 상하이버터떡 파는곳',
  '용인 상하이버터떡',
]

const PAGES_PER_KEYWORD = 3
const MAX_POSTS_PER_KEYWORD = 10

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlogPostUrl(url: string): boolean {
  return /blog\.naver\.com\/[^/]+\/\d{5,}/.test(url)
}

function extractPlaceId(url: string): string | null {
  const m = url.match(/place\/(\d+)/) || url.match(/place\.naver\.com\/restaurant\/(\d+)/)
  return m ? m[1] : null
}

function extractCityFromKeyword(keyword: string): string {
  const m = keyword.match(/^([가-힣]+)\s/)
  return m ? m[1] : ''
}

async function collectBlogLinksForKeyword(
  page: Page,
  keyword: string
): Promise<string[]> {
  const links = new Set<string>()

  for (let pageNo = 1; pageNo <= PAGES_PER_KEYWORD; pageNo++) {
    const encoded = encodeURIComponent(keyword)
    const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encoded}`

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(2000)

      const foundLinks = await page.$$eval('a', (anchors) =>
        anchors
          .map((a) => a.href)
          .filter((href) => /blog\.naver\.com\/[^/]+\/\d{5,}/.test(href))
      )

      const beforeCount = links.size
      for (const link of foundLinks) {
        links.add(link)
      }
      const newCount = links.size - beforeCount
      console.log(`    page ${pageNo}: ${foundLinks.length} posts found, ${newCount} new (total: ${links.size})`)
    } catch (e) {
      console.warn(`    page ${pageNo}: FAILED - ${(e as Error).message}`)
    }

    await delay(1500)
  }

  // Return up to MAX_POSTS_PER_KEYWORD
  return [...links].slice(0, MAX_POSTS_PER_KEYWORD)
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
): Promise<CityShop[]> {
  const shops: CityShop[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
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

    // Collect place IDs found in this post
    const placeIds = new Set<string>()

    // Strategy 1: OG link cards (Naver Place embeds)
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
          category: '',
          keyword,
          blogUrl,
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

    // Fetch structured data for any place IDs we found
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

    // Strategy 4: Text extraction (only if no structured data found)
    const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '')

    // Korean road addresses
    const strictAddressPattern =
      /(?:서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|대전광역시|대전시|울산광역시|울산시|세종특별자치시|세종시|경기도|경기|강원도|강원|충청북도|충청남도|충북|충남|전라북도|전라남도|전북특별자치도|전북|전남|경상북도|경상남도|경북|경남|제주특별자치도|제주도|제주)\s*[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리가]\s*[0-9\-가-힣]*/g
    const addresses = bodyText.match(strictAddressPattern) ?? []
    const uniqueAddresses = [...new Set(addresses.map((a) => a.trim()))].filter(
      (a) => a.length >= 10 && a.length <= 80
    )

    // Phone numbers
    const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
    const phones = bodyText.match(phonePattern) ?? []

    // Hours
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
        /^[가-힣]{2,10}\s*(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|떡카페|카페|공방|제과|제과점|디저트)$/.test(ht)
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
          category: '',
          keyword,
          blogUrl,
        })
      }
    } else if (shops.length === 0 && shopNameCandidates.length > 0 && phones.length > 0) {
      shops.push({
        name: shopNameCandidates[0],
        address: '',
        phone: phones[0],
        hours: hoursMatches[0] ?? '',
        category: '',
        keyword,
        blogUrl,
      })
    }

    // Enrich existing shops with missing data from text extraction
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

async function main() {
  console.log('=== Shanghai Butter Rice Cake - City Crawl ===\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allRawShops: CityShop[] = []
  const perCityCount: Record<string, number> = {}

  try {
    for (const keyword of KEYWORDS) {
      const city = extractCityFromKeyword(keyword)
      console.log(`\n========================================`)
      console.log(`[search] Keyword: "${keyword}" (city: ${city})`)
      console.log(`========================================`)

      // Step 1: Collect blog links for this keyword
      const blogLinks = await collectBlogLinksForKeyword(page, keyword)
      console.log(`  => Will visit ${blogLinks.length} blog posts\n`)

      // Step 2: Visit each blog post and extract shop info
      let shopCountForKeyword = 0

      for (let i = 0; i < blogLinks.length; i++) {
        const link = blogLinks[i]
        console.log(`  [post ${i + 1}/${blogLinks.length}] ${link}`)

        const shops = await extractShopInfoFromPost(page, link, keyword, context)

        if (shops.length > 0) {
          for (const shop of shops) {
            console.log(
              `    >> ${shop.name || '?'} | ${shop.address || '?'} | ${shop.phone || '-'} | ${shop.category || '-'}`
            )
            allRawShops.push(shop)
            shopCountForKeyword++
          }
        } else {
          console.log('    >> (nothing extracted)')
        }

        await delay(1500)
      }

      perCityCount[city] = (perCityCount[city] ?? 0) + shopCountForKeyword
      console.log(`\n  [${city}] Found ${shopCountForKeyword} raw shop entries for this keyword`)
    }
  } catch (e) {
    console.error('[fatal]', e)
  } finally {
    await browser.close()
  }

  // Step 3: Deduplicate by name + address
  console.log(`\n========================================`)
  console.log(`[dedup] Raw shops collected: ${allRawShops.length}`)

  // Remove entries with no name and no address
  const validShops = allRawShops.filter((s) => s.name || s.address)
  console.log(`[dedup] After removing empty: ${validShops.length}`)

  // Deduplicate by normalized name + address
  const dedupMap = new Map<string, CityShop>()
  for (const shop of validShops) {
    const normName = normalizeForDedup(shop.name)
    const normAddr = shop.address.replace(/\s+/g, '').slice(0, 30)
    const key = `${normName}|${normAddr}`

    if (!dedupMap.has(key)) {
      dedupMap.set(key, shop)
    } else {
      // Merge: prefer entries with more data
      const existing = dedupMap.get(key)!
      if (!existing.address && shop.address) existing.address = shop.address
      if (!existing.phone && shop.phone) existing.phone = shop.phone
      if (!existing.hours && shop.hours) existing.hours = shop.hours
      if (!existing.category && shop.category) existing.category = shop.category
      if (!existing.name && shop.name) existing.name = shop.name
    }
  }

  const uniqueShops = [...dedupMap.values()]
  console.log(`[dedup] After deduplication: ${uniqueShops.length}`)

  // Step 4: Write results
  const outputPath = resolve('/Users/kwanung/development/experiments/shanghai-butter-rice/scripts/cities-results.json')
  writeFileSync(outputPath, JSON.stringify(uniqueShops, null, 2) + '\n', 'utf-8')
  console.log(`\n[output] Written to: ${outputPath}`)

  // Step 5: Summary
  // Recount per-city from deduplicated results
  const finalCityCount: Record<string, number> = {}
  for (const shop of uniqueShops) {
    const city = extractCityFromKeyword(shop.keyword)
    finalCityCount[city] = (finalCityCount[city] ?? 0) + 1
  }

  console.log(`\n========================================`)
  console.log(`SUMMARY`)
  console.log(`========================================`)
  console.log(`Total raw shops: ${allRawShops.length}`)
  console.log(`Total unique shops: ${uniqueShops.length}`)
  console.log(``)
  console.log(`Shops per city (deduplicated):`)
  for (const city of Object.keys(finalCityCount).sort()) {
    console.log(`  ${city}: ${finalCityCount[city]}`)
  }
  console.log(``)
  console.log(`All shops:`)
  for (const s of uniqueShops) {
    const city = extractCityFromKeyword(s.keyword)
    console.log(`  [${city}] ${s.name || '(no name)'} | ${s.address || '(no address)'} | ${s.phone || '-'}`)
  }
}

main()
