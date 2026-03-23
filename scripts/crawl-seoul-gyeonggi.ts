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

// ─── 서울/경기 주요 지역 + 버터떡 키워드 조합 ───
const PLACE_QUERIES: { query: string; x: number; y: number }[] = [
  // 서울 주요 지역
  { query: '강남 버터떡', x: 127.0276, y: 37.4979 },
  { query: '홍대 버터떡', x: 126.9246, y: 37.5563 },
  { query: '신촌 버터떡', x: 126.9368, y: 37.5596 },
  { query: '건대 버터떡', x: 127.0688, y: 37.5407 },
  { query: '잠실 버터떡', x: 127.1004, y: 37.5133 },
  { query: '성수 버터떡', x: 127.0568, y: 37.5445 },
  { query: '이태원 버터떡', x: 126.9945, y: 37.5345 },
  { query: '여의도 버터떡', x: 126.9249, y: 37.5219 },
  { query: '명동 버터떡', x: 126.9858, y: 37.5636 },
  { query: '종로 버터떡', x: 126.9895, y: 37.5704 },
  { query: '신림 버터떡', x: 126.9295, y: 37.4844 },
  { query: '영등포 버터떡', x: 126.9059, y: 37.5159 },
  { query: '마포 버터떡', x: 126.9082, y: 37.5538 },
  { query: '용산 버터떡', x: 126.9648, y: 37.5326 },
  { query: '송파 버터떡', x: 127.1058, y: 37.5048 },
  { query: '강서 버터떡', x: 126.8498, y: 37.5509 },
  { query: '노원 버터떡', x: 127.0583, y: 37.6543 },
  { query: '서초 버터떡', x: 127.0089, y: 37.4837 },
  { query: '관악 버터떡', x: 126.9516, y: 37.4784 },
  { query: '동대문 버터떡', x: 127.0094, y: 37.5714 },
  { query: '광진 버터떡', x: 127.0822, y: 37.5384 },
  { query: '서대문 버터떡', x: 126.9388, y: 37.5791 },
  { query: '은평 버터떡', x: 126.9293, y: 37.6176 },
  { query: '강동 버터떡', x: 127.1378, y: 37.5303 },
  { query: '중랑 버터떡', x: 127.0928, y: 37.6063 },
  { query: '도봉 버터떡', x: 127.0472, y: 37.6688 },
  { query: '강북 버터떡', x: 127.0115, y: 37.6397 },
  { query: '동작 버터떡', x: 126.9517, y: 37.5121 },
  { query: '금천 버터떡', x: 126.8954, y: 37.4568 },
  { query: '양천 버터떡', x: 126.8665, y: 37.5172 },
  { query: '구로 버터떡', x: 126.8876, y: 37.4954 },
  { query: '성북 버터떡', x: 127.0172, y: 37.5894 },

  // 경기도 주요 도시
  { query: '분당 버터떡', x: 127.1190, y: 37.3828 },
  { query: '수원 버터떡', x: 127.0286, y: 37.2636 },
  { query: '성남 버터떡', x: 127.1268, y: 37.4201 },
  { query: '용인 버터떡', x: 127.1771, y: 37.2411 },
  { query: '고양 버터떡', x: 126.8320, y: 37.6583 },
  { query: '일산 버터떡', x: 126.7745, y: 37.6580 },
  { query: '화성 버터떡', x: 126.8311, y: 37.1994 },
  { query: '동탄 버터떡', x: 127.0593, y: 37.2001 },
  { query: '안양 버터떡', x: 126.9515, y: 37.3943 },
  { query: '파주 버터떡', x: 126.7792, y: 37.7589 },
  { query: '김포 버터떡', x: 126.7156, y: 37.6154 },
  { query: '광명 버터떡', x: 126.8665, y: 37.4785 },
  { query: '하남 버터떡', x: 127.2149, y: 37.5392 },
  { query: '구리 버터떡', x: 127.1297, y: 37.5943 },
  { query: '남양주 버터떡', x: 127.2163, y: 37.6358 },
  { query: '의정부 버터떡', x: 127.0478, y: 37.7381 },
  { query: '안산 버터떡', x: 126.8309, y: 37.3219 },
  { query: '시흥 버터떡', x: 126.8029, y: 37.3799 },
  { query: '부천 버터떡', x: 126.7660, y: 37.5036 },
  { query: '광주시 버터떡', x: 127.2551, y: 37.4295 },
  { query: '평택 버터떡', x: 127.1120, y: 36.9924 },
  { query: '오산 버터떡', x: 127.0773, y: 37.1500 },
  { query: '군포 버터떡', x: 126.9351, y: 37.3614 },
  { query: '의왕 버터떡', x: 126.9681, y: 37.3449 },
  { query: '판교 버터떡', x: 127.1110, y: 37.3947 },
  { query: '위례 버터떡', x: 127.1430, y: 37.4780 },
  { query: '광교 버터떡', x: 127.0475, y: 37.2854 },

  // 변형 키워드 (서울/경기 넓은범위)
  { query: '서울 버터모찌', x: 126.9780, y: 37.5665 },
  { query: '서울 상하이버터떡', x: 126.9780, y: 37.5665 },
  { query: '서울 버터라이스떡', x: 126.9780, y: 37.5665 },
  { query: '경기 버터모찌', x: 127.0286, y: 37.2636 },
  { query: '경기 상하이버터떡', x: 127.0286, y: 37.2636 },
]

const BLOG_QUERIES = [
  '서울 버터떡 파는곳',
  '강남 버터떡',
  '홍대 버터떡',
  '성수 버터떡',
  '잠실 버터떡',
  '분당 버터떡',
  '수원 버터떡',
  '용인 버터떡',
  '일산 버터떡',
  '동탄 버터떡',
  '경기 버터떡 파는곳',
  '버터떡 맛집 서울',
  '버터떡 맛집 경기',
  '상하이버터떡 서울',
  '상하이버터떡 경기',
  '버터모찌 서울',
  '버터모찌 경기',
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

// ─── Non-dessert business filter ───
const NON_DESSERT_KEYWORDS = [
  '이마트', '롯데백화점', '현대백화점', '신세계백화점', 'GS더프레시', '배스킨라빈스',
  '횟집', '해장국', '칼국수', '감자탕', '갈비', '순대', '족발', '닭발', '마라탕',
  '양꼬치', '훠궈', '스시', '마트', '전자랜드', '도서관', '초등학교', '네일', '스파',
  '맥도날드', '버거킹', '서브웨이', '스타벅스', '투썸플레이스', '편의점', 'CU', 'GS25',
  '세븐일레븐', '롯데리아', '약국', '병원', '치과', '한의원', '피부과', '안과', '동물병원',
  '주유소', '세탁', '철물', '정육', '미용실', '헬스', '필라테스', '요가', '학원',
  '부동산', '세무사', '법무사', '보험', '은행', '증권', '노래방', '당구장', 'PC방',
  '고깃집', '삼겹살', '소고기', '돼지', '치킨', '피자', '중국집', '짜장', '짬뽕',
  '냉면', '밀면', '국밥', '설렁탕', '곱창', '대창', '막창', '보쌈', '수산',
  '회센터', '초밥', '라멘', '우동', '돈까스', '커피숍', '로스터', '아파트', '오피스텔',
  '백화점', '쇼핑몰', '아웃렛', '슈퍼마켓', '하이마트', '다이소', '올리브영',
  '지하철역', '버스', '정류장', '공원', '미술관', '박물관', '영화관', '극장',
  '노브랜드', '트레이더스', '이케아', '코스트코',
]

function isLikelyDessertShop(name: string, category: string): boolean {
  const combined = `${name} ${category}`.toLowerCase()
  for (const kw of NON_DESSERT_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return false
  }
  // Also reject if name is just a location name
  if (/^(서울|경기|인천|부산|대구|대전|광주|울산|세종|강남|홍대|잠실|성수|분당|수원|용인)$/.test(name.trim())) return false
  if (name.trim().length < 2) return false
  return true
}

async function crawlNaverPlace(page: Page, allResults: PlaceResult[], seenNames: Set<string>) {
  console.log('\n' + '='.repeat(60))
  console.log('[PART 1] 네이버 플레이스 검색: 서울/경기 버터떡')
  console.log(`  총 ${PLACE_QUERIES.length}개 검색어`)
  console.log('='.repeat(60))

  for (let qi = 0; qi < PLACE_QUERIES.length; qi++) {
    const { query, x, y } = PLACE_QUERIES[qi]
    const url = buildPlaceUrl(query, x, y)
    console.log(`\n[${qi + 1}/${PLACE_QUERIES.length}] "${query}"`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await delay(3000)
      for (let i = 0; i < 5; i++) { await page.evaluate('window.scrollBy(0, 1000)'); await delay(500) }

      const items = await page.evaluate(EXTRACT_LIST_JS) as { name: string; href: string; category: string }[]
      console.log(`  Found ${items.length} items`)

      let visitedCount = 0
      for (const item of items) {
        if (visitedCount >= 15) break
        const normalizedName = item.name.trim().toLowerCase()
        if (seenNames.has(normalizedName)) {
          console.log(`  [skip] ${item.name} (duplicate)`)
          continue
        }

        // Pre-filter by category from list
        if (!isLikelyDessertShop(item.name, item.category)) {
          console.log(`  [skip] ${item.name} (non-dessert: ${item.category})`)
          continue
        }

        console.log(`  [${visitedCount + 1}] ${item.name} (${item.category})`)
        try {
          await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await delay(2000)
          const detail = await page.evaluate(EXTRACT_DETAIL_JS) as { address: string; phone: string; hours: string; category: string }

          // Post-filter with detail category
          const finalCategory = detail.category || item.category
          if (!isLikelyDessertShop(item.name, finalCategory)) {
            console.log(`    [skip] non-dessert: ${finalCategory}`)
            visitedCount++
            continue
          }

          const result: PlaceResult = {
            name: item.name, address: detail.address, phone: detail.phone,
            hours: detail.hours, category: finalCategory,
            query, source: 'naver-place',
          }
          allResults.push(result)
          seenNames.add(normalizedName)
          visitedCount++
          console.log(`    -> ${result.address || '(no address)'} | ${result.category}`)
        } catch (e: any) {
          console.warn(`    [error] ${e.message?.slice(0, 80)}`)
          visitedCount++
        }
        await delay(1500)
      }
    } catch (e: any) {
      console.warn(`  [error] ${e.message?.slice(0, 80)}`)
    }

    // Save progress every 10 queries
    if ((qi + 1) % 10 === 0) {
      const progressPath = resolve(import.meta.dirname!, 'crawl-seoul-gyeonggi-progress.json')
      writeFileSync(progressPath, JSON.stringify(allResults, null, 2), 'utf-8')
      console.log(`  [saved progress: ${allResults.length} shops]`)
    }
  }
}

async function crawlBlogs(page: Page, allResults: PlaceResult[], seenNames: Set<string>) {
  console.log('\n' + '='.repeat(60))
  console.log('[PART 2] 네이버 블로그 검색')
  console.log(`  총 ${BLOG_QUERIES.length}개 키워드`)
  console.log('='.repeat(60))

  for (const keyword of BLOG_QUERIES) {
    console.log(`\n[blog] "${keyword}"`)
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
        console.warn(`  [error] search: ${e.message?.slice(0, 80)}`)
      }
    }

    console.log(`  Found ${blogLinks.length} blog posts`)

    for (let i = 0; i < blogLinks.length; i++) {
      const blogUrl = blogLinks[i]
      console.log(`  [${i + 1}/${blogLinks.length}] ${blogUrl.slice(0, 60)}...`)
      try {
        await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(2500)

        let contentFrame: Page | Frame = page
        const mainFrame = page.frame('mainFrame')
        if (mainFrame) {
          contentFrame = mainFrame
          await mainFrame.waitForSelector('.se-main-container, #postViewArea', { timeout: 5000 }).catch(() => null)
        }

        // Extract OG link cards (most accurate)
        const ogCards = await contentFrame.$$('.se-oglink-info, .se-module-oglink, .se-section-oglink').catch(() => [])
        for (const card of ogCards) {
          const titleEl = await card.$('.se-oglink-info-title, .se-oglink-title')
          const descEl = await card.$('.se-oglink-info-summary, .se-oglink-summary, .se-oglink-info-description')
          const linkEl = await card.$('a')
          const title = titleEl ? (await titleEl.textContent())?.trim() ?? '' : ''
          const desc = descEl ? (await descEl.textContent())?.trim() ?? '' : ''
          const href = linkEl ? (await linkEl.getAttribute('href')) ?? '' : ''

          if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
            const normalizedName = title.trim().toLowerCase()
            if (!seenNames.has(normalizedName) && isLikelyDessertShop(title, '')) {
              seenNames.add(normalizedName)
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
          const normalizedName = text.trim().toLowerCase()
          if (text && text.length >= 2 && text.length <= 30 && !seenNames.has(normalizedName) && isLikelyDessertShop(text, '')) {
            seenNames.add(normalizedName)
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

        const headingTexts = await contentFrame.$$eval('strong, b, h2, h3, h4', (els: Element[]) =>
          els.map(el => el.textContent?.trim().replace(/\n/g, ' ') ?? '').filter(t => t.length >= 2 && t.length <= 30)
        ).catch(() => [] as string[])

        const shopNames = headingTexts.filter((t: string) =>
          /[가-힣]{2,}(?:떡집|떡방|베이커리|방앗간|카페|공방|제과|디저트|떡|빵집)/.test(t)
        )

        if (ogCards.length === 0 && placeLinks.length === 0 && addresses.length > 0) {
          for (let ai = 0; ai < Math.min(addresses.length, 3); ai++) {
            const name = shopNames[ai] ?? ''
            const normalizedName = name.trim().toLowerCase()
            if (name && seenNames.has(normalizedName)) continue
            if (name && !isLikelyDessertShop(name, '')) continue
            if (name) seenNames.add(normalizedName)
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
  console.log('[crawl-seoul-gyeonggi] 서울/경기 버터떡 크롤링 시작')
  console.log(`  Place queries: ${PLACE_QUERIES.length}개`)
  console.log(`  Blog queries: ${BLOG_QUERIES.length}개`)

  const browser = await chromium.launch({ headless: true })

  // Load existing enriched data to avoid duplicates
  const enrichedPath = resolve(import.meta.dirname!, '../pipeline/data/enriched-shops.json')
  const seenNames = new Set<string>()
  if (existsSync(enrichedPath)) {
    const existing = JSON.parse(readFileSync(enrichedPath, 'utf-8')) as { name: string }[]
    for (const s of existing) seenNames.add(s.name.trim().toLowerCase())
    console.log(`  기존 ${existing.length}개 매장 중복 제외`)
  }

  // Load previous crawl results too
  const prevPath = resolve(import.meta.dirname!, 'crawl-seoul-gyeonggi-results.json')
  const previousResults: PlaceResult[] = []
  if (existsSync(prevPath)) {
    const prev = JSON.parse(readFileSync(prevPath, 'utf-8')) as PlaceResult[]
    for (const p of prev) {
      seenNames.add(p.name.trim().toLowerCase())
      previousResults.push(p)
    }
    console.log(`  이전 크롤링 ${prev.length}개 매장 중복 제외`)
  }

  const allResults: PlaceResult[] = []

  // Part 1: Naver Place (mobile)
  const mobilePage = await (await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  })).newPage()

  await crawlNaverPlace(mobilePage, allResults, seenNames)
  await mobilePage.close()

  // Part 2: Naver Blog (desktop)
  const blogPage = await (await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })).newPage()

  await crawlBlogs(blogPage, allResults, seenNames)
  await browser.close()

  // Merge with previous results
  const merged = [...previousResults, ...allResults]

  // Deduplicate by normalized name
  const seen = new Set<string>()
  const unique = merged.filter(r => {
    const key = r.name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const outPath = resolve(import.meta.dirname!, 'crawl-seoul-gyeonggi-results.json')
  writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log('[crawl-seoul-gyeonggi] SUMMARY')
  console.log(`  이번 크롤링 신규: ${allResults.length}개`)
  console.log(`  이전 결과 포함 총: ${unique.length}개`)
  console.log(`  Output: ${outPath}`)
  console.log('='.repeat(60))

  if (unique.length > 0) {
    console.log('\n전체 매장 목록:')
    for (const shop of unique) {
      console.log(`  - ${shop.name} | ${shop.address || '?'} | ${shop.source} | q: ${shop.query}`)
    }
  }
}

main().catch(console.error)
