import { chromium, type Page, type Frame } from 'playwright'

interface BlogShop {
  name: string
  address: string
  phone: string
  hours: string
  blogUrl: string
  source: string
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Check if a URL is an actual blog post (contains numeric post ID) */
function isBlogPostUrl(url: string): boolean {
  // Blog post URLs look like: https://blog.naver.com/{userId}/{postId}
  // where postId is a long numeric string
  return /blog\.naver\.com\/[^/]+\/\d{5,}/.test(url)
}

async function collectBlogLinks(page: Page): Promise<string[]> {
  const links: string[] = []

  for (let pageNo = 1; pageNo <= 3; pageNo++) {
    const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=%EC%83%81%ED%95%98%EC%9D%B4%20%EB%B2%84%ED%84%B0%EB%96%A1%20%ED%8C%8C%EB%8A%94%EA%B3%B3`

    console.log(`[blog] Navigating to blog search page ${pageNo}...`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Grab all links and filter to actual blog post URLs
    const allLinks = await page.$$eval('a', (anchors) =>
      anchors.map((a) => a.href).filter((href) => /blog\.naver\.com\/[^/]+\/\d{5,}/.test(href))
    )

    for (const href of allLinks) {
      if (!links.includes(href)) {
        links.push(href)
      }
    }

    console.log(`[blog] After page ${pageNo}: ${links.length} unique blog post links`)
    if (links.length >= 30) break
    await delay(1000)
  }

  return links.slice(0, 30)
}

async function extractShopInfoFromPost(page: Page, blogUrl: string): Promise<BlogShop[]> {
  const shops: BlogShop[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)

    // Naver blog posts use an iframe for content
    let contentFrame: Page | Frame = page
    const mainFrame = page.frame('mainFrame')
    if (mainFrame) {
      contentFrame = mainFrame
      // Wait for post content to load inside iframe
      await mainFrame.waitForSelector('.se-main-container, #postViewArea, .post-view', { timeout: 5000 }).catch(() => null)
    }

    // Strategy 1: Naver Place OG link cards
    // These are structured widgets bloggers embed that link to Naver Place/Map
    const ogLinks = await contentFrame.$$('.se-oglink-info, .se-module-oglink, .se-section-oglink').catch(() => [])
    for (const card of ogLinks) {
      const titleEl = await card.$('.se-oglink-info-title, .se-oglink-title')
      const descEl = await card.$('.se-oglink-info-summary, .se-oglink-summary, .se-oglink-info-description')
      const linkEl = await card.$('a')

      const title = titleEl ? (await titleEl.textContent())?.trim() ?? '' : ''
      const desc = descEl ? (await descEl.textContent())?.trim() ?? '' : ''
      const href = linkEl ? (await linkEl.getAttribute('href')) ?? '' : ''

      if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
        shops.push({
          name: title,
          address: desc,
          phone: '',
          hours: '',
          blogUrl,
          source: 'blog-oglink',
        })
      }
    }

    // Strategy 2: Direct Naver Place / Map links
    const placeLinks = await contentFrame.$$('a[href*="place.naver.com"], a[href*="map.naver.com/p/entry/place"]').catch(() => [])
    for (const link of placeLinks) {
      const href = (await link.getAttribute('href')) ?? ''
      const text = (await link.textContent())?.trim() ?? ''
      if (href && text && !shops.some((s) => s.name === text)) {
        shops.push({
          name: text,
          address: '',
          phone: '',
          hours: '',
          blogUrl,
          source: `blog-placelink:${href}`,
        })
      }
    }

    // Strategy 3: Map iframes
    const mapIframes = await contentFrame.$$('iframe[src*="place.naver.com"], iframe[src*="map.naver.com"]').catch(() => [])
    for (const iframeEl of mapIframes) {
      const src = (await iframeEl.getAttribute('src')) ?? ''
      if (src) {
        // Try to extract place ID from iframe src
        const placeIdMatch = src.match(/place\/(\d+)/)
        shops.push({
          name: '',
          address: '',
          phone: '',
          hours: '',
          blogUrl,
          source: `blog-map-iframe:${src}`,
        })

        // If we got a place ID, try to visit it directly
        if (placeIdMatch) {
          try {
            const placePage = await page.context().newPage()
            await placePage.goto(`https://m.place.naver.com/place/${placeIdMatch[1]}`, { timeout: 10000 })
            await placePage.waitForTimeout(2000)
            const placeName = await placePage.$eval('span.GHAhO, .place_section_content .name', (el) => el.textContent?.trim() ?? '').catch(() => '')
            const placeAddr = await placePage.$eval('.LDgIH, .place_section_content .address', (el) => el.textContent?.trim() ?? '').catch(() => '')
            const placePhone = await placePage.$eval('.xlx7Q, .place_section_content .phone', (el) => el.textContent?.trim() ?? '').catch(() => '')
            if (placeName) {
              shops[shops.length - 1].name = placeName
              shops[shops.length - 1].address = placeAddr
              shops[shops.length - 1].phone = placePhone
            }
            await placePage.close()
          } catch {
            // ignore place fetch failures
          }
        }
      }
    }

    // Strategy 4: Text extraction - but much stricter
    const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '')

    // Only match proper Korean addresses (must have 시/도 + 구/군 + 로/길/동 pattern)
    const strictAddressPattern = /(?:서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|대전광역시|대전시|울산광역시|울산시|세종특별자치시|세종시|경기도|강원도|충청북도|충청남도|충북|충남|전라북도|전라남도|전북|전남|경상북도|경상남도|경북|경남|제주특별자치도|제주도|제주)\s*[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리가]\s*[0-9\-가-힣]*/g
    const addresses = bodyText.match(strictAddressPattern) ?? []
    // Deduplicate and clean
    const uniqueAddresses = [...new Set(addresses.map((a) => a.trim()))].filter((a) => a.length >= 10 && a.length <= 80)

    // Phone numbers
    const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
    const phones = bodyText.match(phonePattern) ?? []

    // Hours
    const hoursPattern = /(?:영업시간|운영시간)\s*[:：]?\s*([^\n]{5,50})/gi
    const hoursMatches = [...bodyText.matchAll(hoursPattern)].map((m) => m[0].trim())

    // Shop names: look for actual store names
    const shopNameCandidates: string[] = []

    // Look at bold/heading text for store names
    const headingTexts = await contentFrame.$$eval(
      'strong, b, h2, h3, h4',
      (els) => els.map((el) => el.textContent?.trim().replace(/\n/g, ' ') ?? '').filter((t) => t.length >= 2 && t.length <= 30)
    ).catch(() => [] as string[])

    for (const ht of headingTexts) {
      // Must look like a proper store name: starts with Korean, ends with shop-type suffix
      if (/^[가-힣]{2,10}\s*(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|떡카페|카페|공방|제과|제과점|디저트)$/.test(ht)) {
        shopNameCandidates.push(ht)
      }
    }

    // Also try patterns in body text - require 2+ Korean chars before suffix
    const nameInTextPattern = /[가-힣]{2,10}(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|카페|디저트카페|공방|제과점|제과)/g
    const nameMatches = bodyText.match(nameInTextPattern) ?? []
    for (const nm of nameMatches) {
      const cleaned = nm.trim()
      // Filter out generic/noisy matches
      if (
        cleaned.length >= 4 &&
        !cleaned.startsWith('파는곳') &&
        !cleaned.startsWith('하는') &&
        !cleaned.startsWith('보내기') &&
        !cleaned.startsWith('맛집') &&
        !cleaned.startsWith('맛있는') &&
        !cleaned.startsWith('알아보') &&
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

    // Only create text-extraction entries if we have a real address AND no OG/place links found
    if (shops.length === 0 && uniqueAddresses.length > 0) {
      // Try to pair addresses with the closest shop name candidate
      const usedNames = new Set<string>()
      for (let i = 0; i < uniqueAddresses.length; i++) {
        const name = shopNameCandidates.find((n) => !usedNames.has(n)) ?? ''
        if (name) usedNames.add(name)
        shops.push({
          name,
          address: uniqueAddresses[i],
          phone: phones[i] ?? phones[0] ?? '',
          hours: hoursMatches[0] ?? '',
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
        blogUrl,
        source: 'blog-text-extraction',
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
    console.warn(`[blog] Failed to extract from ${blogUrl}:`, (e as Error).message)
  }

  return shops
}

async function main() {
  console.log('[blog] Starting Naver Blog crawl for 상하이 버터떡 파는곳...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allShops: BlogShop[] = []

  try {
    // Step 1: Collect blog post links
    const blogLinks = await collectBlogLinks(page)
    console.log(`[blog] Will visit ${blogLinks.length} blog posts\n`)

    // Step 2: Visit each blog post and extract shop info
    for (let i = 0; i < blogLinks.length; i++) {
      const link = blogLinks[i]
      console.log(`[blog] (${i + 1}/${blogLinks.length}) ${link}`)

      const shops = await extractShopInfoFromPost(page, link)

      if (shops.length > 0) {
        for (const shop of shops) {
          console.log(`  >> ${shop.name || '?'} | ${shop.address || '?'} | ${shop.phone || '-'} [${shop.source}]`)
          allShops.push(shop)
        }
      } else {
        console.log('  >> (nothing extracted)')
      }

      await delay(1500)
    }
  } catch (e) {
    console.error('[blog] Fatal error:', e)
  } finally {
    await browser.close()
  }

  // Deduplicate by name+address
  const seen = new Set<string>()
  const unique = allShops.filter((s) => {
    const key = `${s.name}|${s.address}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n========================================`)
  console.log(`[blog] RESULTS: ${allShops.length} total, ${unique.length} unique`)
  console.log(`========================================`)
  console.log(JSON.stringify(unique, null, 2))
}

main()
