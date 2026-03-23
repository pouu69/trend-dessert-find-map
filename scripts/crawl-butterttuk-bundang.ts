import { chromium, type Page, type Frame } from 'playwright'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface PlaceResult {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  query: string
  source: string
}

// ─── Naver Place search ───

const PLACE_QUERIES: { query: string; x: number; y: number }[] = [
  { query: '선유도역 버터떡',  x: 126.894, y: 37.533 },
]

const BLOG_QUERIES = [
  '선유도역 버터떡',
]

function buildPlaceUrl(query: string, x: number, y: number): string {
  return `https://m.place.naver.com/place/list?query=${encodeURIComponent(query)}&x=${x}&y=${y}&level=top`
}

async function delay(ms: number) {
  return new Promise(function (r) { setTimeout(r, ms) })
}

const EXTRACT_LIST_JS = `
(() => {
  var results = [];
  var links = document.querySelectorAll('a[href*="/place/"]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var href = link.href;
    var pathPart = href.split('?')[0];
    if (!/\\/place\\/\\d+$/.test(pathPart)) continue;
    if (/\\/photo/.test(href)) continue;
    var nameEl = link.querySelector('span, strong, h3, h2');
    var name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : (link.textContent ? link.textContent.trim() : '');
    if (!name || name.length > 50 || name.length < 2) continue;
    if (/^이미지수/.test(name) || /^\\d+$/.test(name)) continue;
    var li = link.closest('li') || link.closest('[class*="item"]') || link.parentElement;
    var catEl = li ? li.querySelector('[class*="YzBgS"], [class*="subcategory"], [class*="category"]') : null;
    var category = (catEl && catEl.textContent) ? catEl.textContent.trim() : '';
    results.push({ name: name, href: href, category: category });
  }
  var seen = {};
  var deduped = [];
  for (var j = 0; j < results.length; j++) {
    if (!seen[results[j].href]) { seen[results[j].href] = true; deduped.push(results[j]); }
  }
  return deduped;
})()
`

const EXTRACT_DETAIL_JS = `
(() => {
  function getText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }
  var address = getText(['.LDgIH', '.IH7VR', '.O8qbU', '.Y31Sf', 'span[class*="addr"]']);
  if (!address) { var addrEl = document.querySelector('[aria-label*="주소"]'); if (addrEl && addrEl.textContent) address = addrEl.textContent.trim(); }
  if (address) { address = address.replace(/^주소/, '').replace(/지도.*$/, '').trim(); }
  var phone = getText(['.xlx7Q']);
  if (!phone) { var phoneEl = document.querySelector('a[href^="tel:"]'); if (phoneEl) phone = phoneEl.href.replace('tel:', ''); }
  var hours = getText(['.A_cdD .i8cJw', '.MkTHd']);
  var category = getText(['.lnJFt', '.YzBgS', '.KCMnt', 'span[class*="category"]']);
  return { address: address || '', phone: phone || '', hours: hours || '', category: category || '' };
})()
`

async function crawlNaverPlace(page: Page, allResults: PlaceResult[], seenNames: Set<string>) {
  console.log('\n' + '='.repeat(60))
  console.log('[PART 1] 네이버 플레이스 검색: 분당 상하이버터떡')
  console.log('='.repeat(60))

  for (const { query, x, y } of PLACE_QUERIES) {
    const url = buildPlaceUrl(query, x, y)
    console.log(`\n[place] Searching "${query}"...`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await delay(3000)
      for (let i = 0; i < 5; i++) { await page.evaluate('window.scrollBy(0, 1000)'); await delay(500) }

      const items = await page.evaluate(EXTRACT_LIST_JS) as { name: string; href: string; category: string }[]
      console.log(`  Found ${items.length} place items`)

      let visitedCount = 0
      for (const item of items) {
        if (visitedCount >= 20) break
        if (seenNames.has(item.name)) continue

        console.log(`  [${visitedCount + 1}] ${item.name}`)
        try {
          await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await delay(2000)
          const detail = await page.evaluate(EXTRACT_DETAIL_JS) as { address: string; phone: string; hours: string; category: string }
          const result: PlaceResult = {
            name: item.name, address: detail.address, phone: detail.phone,
            hours: detail.hours, category: detail.category || item.category,
            query, source: 'naver-place',
          }
          allResults.push(result)
          seenNames.add(item.name)
          visitedCount++
          console.log(`    -> ${result.address || '(no address)'} | ${result.phone || '(no phone)'}`)
        } catch (e: any) {
          console.warn(`    [error] ${e.message?.slice(0, 80)}`)
          visitedCount++
        }
        await delay(2000)
      }
    } catch (e: any) {
      console.warn(`  [error] ${e.message?.slice(0, 80)}`)
    }
  }
}

// ─── Blog search ───

async function crawlBlogs(page: Page, allResults: PlaceResult[], seenNames: Set<string>) {
  console.log('\n' + '='.repeat(60))
  console.log('[PART 2] 네이버 블로그 검색')
  console.log('='.repeat(60))

  for (const keyword of BLOG_QUERIES) {
    console.log(`\n[blog] Keyword: "${keyword}"`)
    const blogLinks: string[] = []

    for (let pageNo = 1; pageNo <= 3; pageNo++) {
      const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encodeURIComponent(keyword)}`
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(2500)
        const links = await page.$$eval('a[href*="blog.naver.com"]', (anchors: HTMLAnchorElement[]) =>
          anchors.map(a => a.href).filter(href => /blog\.naver\.com\/[^/]+\/\d{5,}/.test(href))
        ).catch(() => [] as string[])
        for (const link of links) {
          if (!blogLinks.includes(link) && blogLinks.length < 10) blogLinks.push(link)
        }
      } catch (e: any) {
        console.warn(`  [error] search page: ${e.message?.slice(0, 80)}`)
      }
    }

    console.log(`  Found ${blogLinks.length} blog posts`)

    for (let i = 0; i < blogLinks.length; i++) {
      const blogUrl = blogLinks[i]
      console.log(`  [${i + 1}/${blogLinks.length}] ${blogUrl}`)
      try {
        await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(2500)

        // Access iframe content
        let contentFrame: Page | Frame = page
        const mainFrame = page.frame('mainFrame')
        if (mainFrame) {
          contentFrame = mainFrame
          await mainFrame.waitForSelector('.se-main-container, #postViewArea', { timeout: 5000 }).catch(() => null)
        }

        // Extract Naver Place OG link cards
        const ogCards = await contentFrame.$$('.se-oglink-info, .se-module-oglink, .se-section-oglink').catch(() => [])
        for (const card of ogCards) {
          const titleEl = await card.$('.se-oglink-info-title, .se-oglink-title')
          const descEl = await card.$('.se-oglink-info-summary, .se-oglink-summary, .se-oglink-info-description')
          const linkEl = await card.$('a')
          const title = titleEl ? (await titleEl.textContent())?.trim() ?? '' : ''
          const desc = descEl ? (await descEl.textContent())?.trim() ?? '' : ''
          const href = linkEl ? (await linkEl.getAttribute('href')) ?? '' : ''

          if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
            if (!seenNames.has(title)) {
              seenNames.add(title)
              allResults.push({
                name: title, address: desc, phone: '', hours: '',
                category: '', query: keyword, source: 'blog-oglink',
              })
              console.log(`    >> ${title} | ${desc}`)
            }
          }
        }

        // Extract direct place links
        const placeLinks = await contentFrame.$$('a[href*="place.naver.com"], a[href*="map.naver.com/p/entry/place"]').catch(() => [])
        for (const link of placeLinks) {
          const text = (await link.textContent())?.trim() ?? ''
          if (text && text.length >= 2 && text.length <= 30 && !seenNames.has(text)) {
            seenNames.add(text)
            allResults.push({
              name: text, address: '', phone: '', hours: '',
              category: '', query: keyword, source: 'blog-placelink',
            })
            console.log(`    >> ${text} (place link)`)
          }
        }

        // Extract addresses from text
        const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '').catch(() => '')
        const addrPattern = /(?:서울|경기|부산|대구|인천|광주|대전|울산|충[북남]|전[북남]|경[북남]|제주|세종)\s*[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리]\s*[0-9\-가-힣]*/g
        const addresses = [...new Set((bodyText.match(addrPattern) ?? []).map((a: string) => a.trim()))].filter((a: string) => a.length >= 10 && a.length <= 80)
        const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
        const phones = bodyText.match(phonePattern) ?? []

        // Shop names from bold text
        const headingTexts = await contentFrame.$$eval('strong, b, h2, h3, h4', (els: Element[]) =>
          els.map(el => el.textContent?.trim().replace(/\n/g, ' ') ?? '').filter(t => t.length >= 2 && t.length <= 30)
        ).catch(() => [] as string[])

        const shopNames = headingTexts.filter((t: string) =>
          /[가-힣]{2,}(?:떡집|떡방|베이커리|방앗간|카페|공방|제과|디저트)/.test(t)
        )

        if (ogCards.length === 0 && placeLinks.length === 0 && addresses.length > 0) {
          for (let ai = 0; ai < Math.min(addresses.length, 3); ai++) {
            const name = shopNames[ai] ?? ''
            if (name && seenNames.has(name)) continue
            if (name) seenNames.add(name)
            allResults.push({
              name, address: addresses[ai], phone: phones[ai] ?? phones[0] ?? '',
              hours: '', category: '', query: keyword, source: 'blog-text',
            })
            console.log(`    >> ${name || '?'} | ${addresses[ai]}`)
          }
        }
      } catch (e: any) {
        console.warn(`    [error] ${e.message?.slice(0, 80)}`)
      }
      await delay(1500)
    }
  }
}

async function main() {
  console.log('[butterttuk] 버터떡 네이버 플레이스 + 블로그 크롤링 시작')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  })

  const page = await context.newPage()
  const allResults: PlaceResult[] = []
  const seenNames = new Set<string>()

  // Load previous results to avoid duplicates
  const prevPath = resolve(import.meta.dirname!, 'naver-place-butterttuk-results.json')
  if (existsSync(prevPath)) {
    const prev = JSON.parse(readFileSync(prevPath, 'utf-8')) as PlaceResult[]
    for (const p of prev) seenNames.add(p.name)
    console.log(`  (이전 결과 ${prev.length}개 매장 중복 제외)`)
  }

  await crawlNaverPlace(page, allResults, seenNames)

  // Switch to desktop UA for blog crawling
  await page.close()
  const blogContext = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const blogPage = await blogContext.newPage()
  await crawlBlogs(blogPage, allResults, seenNames)

  await browser.close()

  // Deduplicate
  const unique = allResults.filter((r, i, arr) => arr.findIndex(a => a.name === r.name) === i)

  const outPath = resolve(import.meta.dirname!, 'naver-butterttuk-bundang-results.json')
  writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log('[butterttuk-bundang] SUMMARY')
  console.log(`  신규 매장: ${unique.length}개`)
  console.log(`  Output: ${outPath}`)
  console.log('='.repeat(60))

  if (unique.length > 0) {
    console.log('\n신규 매장 목록:')
    for (const shop of unique) {
      console.log(`  - ${shop.name || '?'} | ${shop.address || '?'} | ${shop.source} | query: ${shop.query}`)
    }
  }
}

main().catch(console.error)
