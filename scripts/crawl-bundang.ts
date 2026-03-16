import { chromium, type Page, type Frame } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ShopResult {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  blogUrl: string
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlogPostUrl(url: string): boolean {
  return /blog\.naver\.com\/[^/]+\/\d{5,}/.test(url)
}

async function collectBlogLinks(page: Page): Promise<string[]> {
  const links: string[] = []

  for (let pageNo = 1; pageNo <= 3; pageNo++) {
    const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=%EB%B6%84%EB%8B%B9%20%EC%83%81%ED%95%98%EC%9D%B4%20%EB%B2%84%ED%84%B0%EB%96%A1%20%ED%8C%8C%EB%8A%94%EA%B3%B3`

    console.log(`[bundang] Navigating to blog search page ${pageNo}...`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    const allLinks = await page.$$eval('a', (anchors) =>
      anchors.map((a) => a.href).filter((href) => /blog\.naver\.com\/[^/]+\/\d{5,}/.test(href))
    )

    for (const href of allLinks) {
      if (!links.includes(href)) {
        links.push(href)
      }
    }

    console.log(`[bundang] After page ${pageNo}: ${links.length} unique blog post links`)
    await delay(1500)
  }

  return links.slice(0, 20)
}

async function extractShopInfoFromPost(page: Page, blogUrl: string): Promise<ShopResult[]> {
  const shops: ShopResult[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)

    // Naver blog posts use an iframe for content
    let contentFrame: Page | Frame = page
    const mainFrame = page.frame('mainFrame')
    if (mainFrame) {
      contentFrame = mainFrame
      await mainFrame.waitForSelector('.se-main-container, #postViewArea, .post-view', { timeout: 5000 }).catch(() => null)
    }

    // Strategy 1: Naver Place OG link cards
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
          category: '',
          blogUrl,
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
          category: '',
          blogUrl,
        })
      }
    }

    // Strategy 3: Map iframes - try to visit Naver Place for details
    const mapIframes = await contentFrame.$$('iframe[src*="place.naver.com"], iframe[src*="map.naver.com"]').catch(() => [])
    for (const iframeEl of mapIframes) {
      const src = (await iframeEl.getAttribute('src')) ?? ''
      if (src) {
        const placeIdMatch = src.match(/place\/(\d+)/)
        if (placeIdMatch) {
          try {
            const placePage = await page.context().newPage()
            await placePage.goto(`https://m.place.naver.com/place/${placeIdMatch[1]}`, { timeout: 10000 })
            await placePage.waitForTimeout(2000)
            const placeName = await placePage.$eval('span.GHAhO, .place_section_content .name', (el) => el.textContent?.trim() ?? '').catch(() => '')
            const placeAddr = await placePage.$eval('.LDgIH, .place_section_content .address', (el) => el.textContent?.trim() ?? '').catch(() => '')
            const placePhone = await placePage.$eval('.xlx7Q, .place_section_content .phone', (el) => el.textContent?.trim() ?? '').catch(() => '')
            const placeCategory = await placePage.$eval('.lnJFt, .place_section_content .category', (el) => el.textContent?.trim() ?? '').catch(() => '')
            if (placeName && !shops.some((s) => s.name === placeName)) {
              shops.push({
                name: placeName,
                address: placeAddr,
                phone: placePhone,
                hours: '',
                category: placeCategory,
                blogUrl,
              })
            }
            await placePage.close()
          } catch {
            // ignore place fetch failures
          }
        }
      }
    }

    // Strategy 4: Text extraction
    const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '')

    // Korean road addresses
    const strictAddressPattern = /(?:서울특별시|서울시|서울|부산광역시|부산시|대구광역시|대구시|인천광역시|인천시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|경기|강원도|충청북도|충청남도|충북|충남|전라북도|전라남도|전북|전남|경상북도|경상남도|경북|경남|제주특별자치도|제주도|제주)\s*[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리가]\s*[0-9\-가-힣]*/g
    const addresses = bodyText.match(strictAddressPattern) ?? []
    const uniqueAddresses = [...new Set(addresses.map((a) => a.trim()))].filter((a) => a.length >= 10 && a.length <= 80)

    // Phone numbers
    const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
    const phones = bodyText.match(phonePattern) ?? []

    // Hours
    const hoursPattern = /(?:영업시간|운영시간)\s*[:：]?\s*([^\n]{5,50})/gi
    const hoursMatches = [...bodyText.matchAll(hoursPattern)].map((m) => m[0].trim())

    // Category detection
    const categoryPattern = /(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|떡카페|디저트|카페|제과|제과점|한과)/g
    const categoryMatches = bodyText.match(categoryPattern) ?? []
    const category = categoryMatches.length > 0 ? categoryMatches[0] : ''

    // Shop names from bold/heading text
    const shopNameCandidates: string[] = []
    const headingTexts = await contentFrame.$$eval(
      'strong, b, h2, h3, h4',
      (els) => els.map((el) => el.textContent?.trim().replace(/\n/g, ' ') ?? '').filter((t) => t.length >= 2 && t.length <= 30)
    ).catch(() => [] as string[])

    for (const ht of headingTexts) {
      if (/^[가-힣]{2,10}\s*(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|떡카페|카페|공방|제과|제과점|디저트)$/.test(ht)) {
        shopNameCandidates.push(ht)
      }
    }

    // Also try patterns in body text
    const nameInTextPattern = /[가-힣]{2,10}(?:떡집|떡방|떡가게|떡공방|베이커리|방앗간|떡방앗간|카페|디저트카페|공방|제과점|제과)/g
    const nameMatches = bodyText.match(nameInTextPattern) ?? []
    for (const nm of nameMatches) {
      const cleaned = nm.trim()
      if (
        cleaned.length >= 4 &&
        !cleaned.startsWith('파는곳') &&
        !cleaned.startsWith('하는') &&
        !cleaned.startsWith('맛집') &&
        !cleaned.startsWith('맛있는') &&
        !cleaned.startsWith('인생') &&
        !cleaned.startsWith('핫한') &&
        !cleaned.startsWith('새로운') &&
        !cleaned.startsWith('대세') &&
        !shopNameCandidates.includes(cleaned)
      ) {
        shopNameCandidates.push(cleaned)
      }
    }

    // Only create text-extraction entries if no OG/place links found
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
          category: category,
          blogUrl,
        })
      }
    } else if (shops.length === 0 && shopNameCandidates.length > 0 && phones.length > 0) {
      shops.push({
        name: shopNameCandidates[0],
        address: '',
        phone: phones[0],
        hours: hoursMatches[0] ?? '',
        category: category,
        blogUrl,
      })
    }

    // Enrich existing shops with missing data from text extraction
    for (const shop of shops) {
      if (!shop.address && uniqueAddresses.length > 0) shop.address = uniqueAddresses[0]
      if (!shop.phone && phones.length > 0) shop.phone = phones[0]
      if (!shop.hours && hoursMatches.length > 0) shop.hours = hoursMatches[0]
      if (!shop.name && shopNameCandidates.length > 0) shop.name = shopNameCandidates[0]
      if (!shop.category && category) shop.category = category
    }
  } catch (e) {
    console.warn(`[bundang] WARNING: Failed to extract from ${blogUrl}:`, (e as Error).message)
  }

  return shops
}

async function main() {
  console.log('[bundang] Starting Naver Blog crawl for 분당 상하이 버터떡 파는곳...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allShops: ShopResult[] = []

  try {
    // Step 1: Collect blog post links from pages 1-3
    const blogLinks = await collectBlogLinks(page)
    console.log(`[bundang] Will visit ${blogLinks.length} blog posts (max 20)\n`)

    // Step 2: Visit each blog post and extract shop info
    for (let i = 0; i < blogLinks.length; i++) {
      const link = blogLinks[i]
      console.log(`[bundang] (${i + 1}/${blogLinks.length}) ${link}`)

      const shops = await extractShopInfoFromPost(page, link)

      if (shops.length > 0) {
        for (const shop of shops) {
          console.log(`  >> ${shop.name || '?'} | ${shop.address || '?'} | ${shop.phone || '-'}`)
          allShops.push(shop)
        }
      } else {
        console.log('  >> (nothing extracted)')
      }

      await delay(1500)
    }
  } catch (e) {
    console.error('[bundang] Fatal error:', e)
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

  // Write results
  const outputPath = resolve(__dirname, 'bundang-results.json')
  writeFileSync(outputPath, JSON.stringify(unique, null, 2), 'utf-8')

  console.log(`\n========================================`)
  console.log(`[bundang] RESULTS: ${allShops.length} total, ${unique.length} unique`)
  console.log(`[bundang] Written to: ${outputPath}`)
  console.log(`========================================`)
  console.log(JSON.stringify(unique, null, 2))
}

main()
