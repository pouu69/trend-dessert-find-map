import { chromium, type Page, type Frame } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ShopCandidate {
  name: string
  address: string
  phone: string
  category: string
  placeId: string
  blogUrl: string
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Step 1: Crawl Blog Search ───────────────────────────────────────────────

async function collectBlogLinks(page: Page): Promise<string[]> {
  const links: string[] = []

  for (let pageNo = 1; pageNo <= 3; pageNo++) {
    const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=%EC%8B%9C%ED%9D%A5%20%EC%83%81%ED%95%98%EC%9D%B4%EB%B2%84%ED%84%B0%EB%96%A1`

    console.log(`[siheung] Navigating to blog search page ${pageNo}...`)
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

    console.log(`[siheung] After page ${pageNo}: ${links.length} unique blog post links`)
    await delay(1500)
  }

  return links.slice(0, 15)
}

async function extractShopInfoFromPost(page: Page, blogUrl: string): Promise<ShopCandidate[]> {
  const shops: ShopCandidate[] = []

  try {
    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(2500)

    let contentFrame: Page | Frame = page
    const mainFrame = page.frame('mainFrame')
    if (mainFrame) {
      contentFrame = mainFrame
      await mainFrame.waitForSelector('.se-main-container, #postViewArea, .post-view', { timeout: 5000 }).catch(() => null)
    }

    // Collect all hrefs from the content for place ID extraction
    const allHrefs = await contentFrame.$$eval('a', (anchors) =>
      anchors.map((a) => ({ href: a.href, text: a.textContent?.trim() ?? '' }))
    ).catch(() => [] as { href: string; text: string }[])

    // Extract place IDs from any Naver Place / Map links
    const placeIds = new Set<string>()
    for (const { href, text } of allHrefs) {
      // m.place.naver.com/place/12345 or naver.me redirects
      const placeMatch = href.match(/place\.naver\.com\/(?:restaurant|place)\/(\d+)/)
      if (placeMatch) {
        placeIds.add(placeMatch[1])
        // Also record the link text as potential name
        if (text && text.length >= 2 && text.length <= 30) {
          shops.push({
            name: text,
            address: '',
            phone: '',
            category: '',
            placeId: placeMatch[1],
            blogUrl,
          })
        }
      }
      const mapMatch = href.match(/map\.naver\.com.*?place\/(\d+)/)
      if (mapMatch) {
        placeIds.add(mapMatch[1])
      }
    }

    // OG link cards (Naver blog embeds)
    const ogLinks = await contentFrame.$$('.se-oglink-info, .se-module-oglink, .se-section-oglink').catch(() => [])
    for (const card of ogLinks) {
      const titleEl = await card.$('.se-oglink-info-title, .se-oglink-title')
      const descEl = await card.$('.se-oglink-info-summary, .se-oglink-summary, .se-oglink-info-description')
      const linkEl = await card.$('a')

      const title = titleEl ? (await titleEl.textContent())?.trim() ?? '' : ''
      const desc = descEl ? (await descEl.textContent())?.trim() ?? '' : ''
      const href = linkEl ? (await linkEl.getAttribute('href')) ?? '' : ''

      const placeMatch = href.match(/place\.naver\.com\/(?:restaurant|place)\/(\d+)/) || href.match(/map\.naver\.com.*?place\/(\d+)/)

      if (title && (href.includes('place.naver.com') || href.includes('map.naver.com'))) {
        const pid = placeMatch ? placeMatch[1] : ''
        if (pid) placeIds.add(pid)
        if (!shops.some((s) => s.name === title)) {
          shops.push({
            name: title,
            address: desc,
            phone: '',
            category: '',
            placeId: pid,
            blogUrl,
          })
        }
      }
    }

    // Map iframes
    const mapIframes = await contentFrame.$$('iframe[src*="place.naver.com"], iframe[src*="map.naver.com"]').catch(() => [])
    for (const iframeEl of mapIframes) {
      const src = (await iframeEl.getAttribute('src')) ?? ''
      const placeMatch = src.match(/place\/(\d+)/)
      if (placeMatch) {
        placeIds.add(placeMatch[1])
      }
    }

    // For place IDs that don't have a shop entry yet, fetch details
    for (const pid of placeIds) {
      if (shops.some((s) => s.placeId === pid)) continue
      try {
        const placePage = await page.context().newPage()
        await placePage.goto(`https://m.place.naver.com/place/${pid}`, { timeout: 10000 })
        await placePage.waitForTimeout(2000)
        const placeName = await placePage.$eval('span.GHAhO, .Fc1rA', (el) => el.textContent?.trim() ?? '').catch(() => '')
        const placeAddr = await placePage.$eval('.LDgIH, .jO09N', (el) => el.textContent?.trim() ?? '').catch(() => '')
        const placePhone = await placePage.$eval('.xlx7Q', (el) => el.textContent?.trim() ?? '').catch(() => '')
        const placeCat = await placePage.$eval('.lnJFt', (el) => el.textContent?.trim() ?? '').catch(() => '')
        if (placeName) {
          shops.push({ name: placeName, address: placeAddr, phone: placePhone, category: placeCat, placeId: pid, blogUrl })
        }
        await placePage.close()
      } catch {
        // ignore
      }
    }

    // Text-based extraction as fallback
    const bodyText = await contentFrame.evaluate(() => document.body?.innerText ?? '')

    // Also look for place IDs in text (naver.me links sometimes just show as text)
    const textPlaceMatches = bodyText.match(/place\.naver\.com\/(?:restaurant|place)\/(\d+)/g) ?? []
    for (const m of textPlaceMatches) {
      const pid = m.match(/(\d+)$/)?.[1]
      if (pid && !placeIds.has(pid)) {
        placeIds.add(pid)
      }
    }

    // If no shops found through links, try text extraction
    if (shops.length === 0) {
      const strictAddressPattern = /(?:경기도|경기)\s*시흥시\s+[가-힣0-9]+[로길동읍면리가]\s*[0-9\-가-힣]*/g
      const addresses = bodyText.match(strictAddressPattern) ?? []
      const uniqueAddresses = [...new Set(addresses.map((a) => a.trim()))].filter((a) => a.length >= 10 && a.length <= 80)

      const phonePattern = /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g
      const phones = bodyText.match(phonePattern) ?? []

      // Try to find real shop names - look for text between quotes or after specific patterns
      const shopNamePatterns = [
        // "가게이름" in quotes
        /[「『"'"]([가-힣a-zA-Z0-9\s]{2,20})[」』"'"]/g,
        // @가게이름 or #가게이름
        /[@#]([가-힣a-zA-Z0-9]{2,15})/g,
      ]

      const candidates: string[] = []
      for (const pat of shopNamePatterns) {
        const matches = [...bodyText.matchAll(pat)]
        for (const m of matches) {
          const name = m[1].trim()
          if (name.length >= 2 && name.length <= 20 && !/^(시흥|배곧|정왕|오이도|은계|신천)/.test(name)) {
            candidates.push(name)
          }
        }
      }

      if (uniqueAddresses.length > 0) {
        shops.push({
          name: candidates[0] ?? '',
          address: uniqueAddresses[0],
          phone: phones[0] ?? '',
          category: '',
          placeId: '',
          blogUrl,
        })
      }
    }
  } catch (e) {
    console.warn(`[siheung] WARNING: Failed to extract from ${blogUrl}:`, (e as Error).message)
  }

  return shops
}

// ─── Step 2: Verify on Naver Place ───────────────────────────────────────────

async function fetchPlaceDetails(page: Page, placeId: string): Promise<{ name: string; address: string; phone: string; category: string; verified: boolean }> {
  const result = { name: '', address: '', phone: '', category: '', verified: false }

  try {
    const placeUrl = `https://m.place.naver.com/place/${placeId}/home`
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3000)

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '')

    // Extract name - try multiple selectors
    result.name = await page.$eval('span.GHAhO, .Fc1rA, .YwYLL, [class*="name"] span', (el) => el.textContent?.trim() ?? '').catch(() => '')

    // Extract address: look for Korean address pattern in the page text
    const addrMatch = bodyText.match(/(경기도?\s*시흥시\s+[가-힣0-9]+[로길번안]+\s*[0-9\-]+)/)?.[1]
      ?? bodyText.match(/(경기도?\s*시흥시\s+[가-힣0-9]+[로길동읍면리가번안]+\s*[0-9\-가-힣]*)/)?.[1]
      ?? bodyText.match(/((?:서울|경기|인천|부산|대구|대전|광주|울산)[가-힣]*\s+[가-힣]+[시구군]\s+[가-힣0-9]+[로길동읍면리가번안]+\s*[0-9\-가-힣]*)/)?.[1]
      ?? ''
    // Clean trailing junk like "지도내비게이션거리뷰", "복사" etc.
    result.address = addrMatch.replace(/지도.*$/, '').replace(/복사.*$/, '').replace(/내비.*$/, '').trim()

    // Extract phone: find phone number pattern
    const phoneMatch = bodyText.match(/(0\d{1,4}[-.\s]\d{3,4}[-.\s]\d{4})/)?.[1] ?? ''
    result.phone = phoneMatch.trim()

    // Extract category
    result.category = await page.$eval('.lnJFt', (el) => el.textContent?.trim() ?? '').catch(() => '')

    // If address not found via text, also try selectors
    if (!result.address) {
      const selectorAddr = await page.$eval('.LDgIH, .jO09N', (el) => el.textContent?.trim() ?? '').catch(() => '')
      // Only use if it looks like an address (not a URL)
      if (selectorAddr && /[가-힣]/.test(selectorAddr) && !selectorAddr.includes('http') && !selectorAddr.includes('.com')) {
        result.address = selectorAddr.replace(/^주소\s*/, '').replace(/\s*복사$/, '').trim()
      }
    }

    // If phone not found via text, try selectors
    if (!result.phone) {
      const selectorPhone = await page.$eval('.xlx7Q', (el) => el.textContent?.trim() ?? '').catch(() => '')
      if (selectorPhone && /0\d/.test(selectorPhone) && !selectorPhone.includes('http')) {
        result.phone = selectorPhone.replace(/^전화번호\s*/, '').replace(/\s*복사$/, '').trim()
      }
    }

    console.log(`    [place-detail] name="${result.name}" addr="${result.address}" phone="${result.phone}" cat="${result.category}"`)

    // Check for butter keywords on main page
    if (/버터떡|상하이버터떡|버터라이스|상하이버터|버터 떡/.test(bodyText)) {
      result.verified = true
    }

    // If not found, check the menu page
    if (!result.verified) {
      try {
        const menuUrl = `https://m.place.naver.com/place/${placeId}/menu/list`
        await page.goto(menuUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000)
        const menuText = await page.evaluate(() => document.body?.innerText ?? '')
        if (/버터떡|상하이버터떡|버터라이스|상하이버터|버터 떡/.test(menuText)) {
          result.verified = true
        }
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.warn(`  [place] Error fetching place ${placeId}:`, (e as Error).message)
  }

  return result
}

async function searchAndVerifyOnPlace(page: Page, shopName: string, address: string): Promise<{ name: string; address: string; phone: string; category: string; verified: boolean }> {
  const result = { name: shopName, address: '', phone: '', category: '', verified: false }

  try {
    // Search with name + 시흥 for better results
    const searchTerms = [
      shopName,
      `시흥 ${shopName}`,
      `${shopName} 상하이버터떡`,
    ]

    for (const term of searchTerms) {
      const query = encodeURIComponent(term)
      const url = `https://m.place.naver.com/place/list?query=${query}`
      console.log(`  [verify] Searching: "${term}"`)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)

      // Get the page text to find place links
      const pageHtml = await page.evaluate(() => document.body?.innerHTML ?? '')
      const placeMatches = [...pageHtml.matchAll(/\/place\/(\d+)/g)]

      if (placeMatches.length > 0) {
        const pid = placeMatches[0][1]
        console.log(`  [verify] Found place ID: ${pid}`)
        const details = await fetchPlaceDetails(page, pid)
        if (details.verified) {
          return { ...details }
        }
        // Even if not verified with keywords, store name for later
        if (details.name) {
          result.name = details.name
          result.address = details.address
          result.phone = details.phone
          result.category = details.category
        }
        break // Don't try more search terms if we found a place
      }

      await delay(1500)
    }
  } catch (e) {
    console.warn(`  [verify] Error searching "${shopName}":`, (e as Error).message)
  }

  return result
}

// ─── Step 3: Geocode & merge ─────────────────────────────────────────────────

async function geocodeAddress(address: string): Promise<{ lat: number | null; lng: number | null }> {
  if (!address) return { lat: null, lng: null }

  // Try the full address first, then simplified versions
  const attempts = [
    address,
    address.replace(/경기\s/, '경기도 '),  // "경기 시흥시" -> "경기도 시흥시"
    address.replace(/\d+-\d+$/, '').trim(), // Remove building sub-number
    address.replace(/\s+\d+.*$/, '').trim(), // Remove number suffix entirely
  ]

  for (const attempt of attempts) {
    try {
      await delay(1100)
      const query = encodeURIComponent(attempt)
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=kr`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'ShanghaiButterRiceMap/1.0' },
      })
      const data = (await resp.json()) as Array<{ lat: string; lon: string }>
      if (data.length > 0) {
        console.log(`    [geocode] Success with: "${attempt}"`)
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    } catch (e) {
      console.warn(`  [geocode] Failed for "${attempt}":`, (e as Error).message)
    }
  }

  return { lat: null, lng: null }
}

function extractRegion(address: string): string {
  if (/시흥/.test(address)) return '경기'
  if (/서울/.test(address)) return '서울'
  if (/경기/.test(address)) return '경기'
  if (/인천/.test(address)) return '인천'
  return '경기'
}

function extractTags(category: string): string[] {
  const tags: string[] = []
  if (/카페/.test(category)) tags.push('카페')
  if (/베이커리|빵/.test(category)) tags.push('베이커리')
  if (/떡/.test(category)) tags.push('떡집')
  if (/디저트/.test(category)) tags.push('디저트')
  if (/제과/.test(category)) tags.push('제과')
  if (/방앗간/.test(category)) tags.push('방앗간')
  if (tags.length === 0) {
    if (category) tags.push(category)
    else tags.push('디저트')
  }
  return tags
}

async function main() {
  console.log('[siheung] ═══════════════════════════════════════════')
  console.log('[siheung] Starting Naver Blog crawl for 시흥 상하이버터떡')
  console.log('[siheung] ═══════════════════════════════════════════\n')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  const allCandidates: ShopCandidate[] = []

  try {
    // ── Step 1: Collect blog post links ──────────────────────────
    const blogLinks = await collectBlogLinks(page)
    console.log(`\n[siheung] Will visit ${blogLinks.length} blog posts (max 15)\n`)

    for (let i = 0; i < blogLinks.length; i++) {
      const link = blogLinks[i]
      console.log(`[siheung] (${i + 1}/${blogLinks.length}) ${link}`)

      const shops = await extractShopInfoFromPost(page, link)

      if (shops.length > 0) {
        for (const shop of shops) {
          console.log(`  >> ${shop.name || '?'} | placeId=${shop.placeId || '-'} | ${shop.address || '?'} | ${shop.phone || '-'}`)
          allCandidates.push(shop)
        }
      } else {
        console.log('  >> (nothing extracted)')
      }

      await delay(1500)
    }
  } catch (e) {
    console.error('[siheung] Error during blog crawl:', (e as Error).message)
  }

  // Deduplicate: prefer entries with placeId, dedup by placeId then by name
  const byPlaceId = new Map<string, ShopCandidate>()
  const byName = new Map<string, ShopCandidate>()

  for (const c of allCandidates) {
    if (c.placeId && !byPlaceId.has(c.placeId)) {
      byPlaceId.set(c.placeId, c)
    }
    const normName = c.name.replace(/\s+/g, '')
    if (normName && !byName.has(normName) && normName.length >= 2) {
      byName.set(normName, c)
    }
  }

  // Merge: placeId entries first, then name-only entries that don't overlap
  const uniqueCandidates: ShopCandidate[] = [...byPlaceId.values()]
  const usedNames = new Set(uniqueCandidates.map((c) => c.name.replace(/\s+/g, '')))
  for (const [normName, c] of byName) {
    if (!usedNames.has(normName) && !c.placeId) {
      uniqueCandidates.push(c)
      usedNames.add(normName)
    }
  }

  console.log(`\n[siheung] Blog crawl done: ${allCandidates.length} total, ${uniqueCandidates.length} unique candidates`)
  for (const s of uniqueCandidates) {
    console.log(`  - ${s.name} | placeId=${s.placeId || '-'} | ${s.address}`)
  }

  // ── Step 2: Verify on Naver Place ──────────────────────────────
  console.log(`\n[siheung] ── Step 2: Verifying ${uniqueCandidates.length} candidates on Naver Place ──\n`)

  interface VerifiedShop {
    name: string
    address: string
    phone: string
    category: string
  }
  const verifiedShops: VerifiedShop[] = []
  const verifiedNames = new Set<string>()

  for (const candidate of uniqueCandidates) {
    const normName = candidate.name.replace(/\s+/g, '')

    // Skip generic names
    if (/^(시흥|배곧|정왕|오이도|은계|신천|강남)(동?)(카페|디저트카페|디저트|베이커리)$/.test(normName)) {
      console.log(`  [skip] Generic name: "${candidate.name}"`)
      // But if it has a placeId, still try to verify
      if (!candidate.placeId) continue
    }

    if (verifiedNames.has(normName)) {
      console.log(`  [skip] Already verified: "${candidate.name}"`)
      continue
    }

    let result: { name: string; address: string; phone: string; category: string; verified: boolean }

    if (candidate.placeId) {
      console.log(`  [verify] Fetching place ID ${candidate.placeId} for "${candidate.name}"`)
      result = await fetchPlaceDetails(page, candidate.placeId)
    } else {
      result = await searchAndVerifyOnPlace(page, candidate.name, candidate.address)
    }

    console.log(`  [verify] ${result.verified ? 'VERIFIED' : 'NOT verified'}: ${result.name || candidate.name}${result.address ? ' @ ' + result.address : ''}`)

    if (result.verified) {
      const finalName = result.name || candidate.name
      verifiedNames.add(finalName.replace(/\s+/g, ''))
      // Use place address only if it looks real (not a URL)
      let finalAddress = result.address
      if (!finalAddress || finalAddress.includes('http') || finalAddress.includes('.com') || finalAddress.includes('instagram')) {
        finalAddress = candidate.address
      }
      // Same for phone
      let finalPhone = result.phone
      if (!finalPhone || finalPhone.includes('http')) {
        finalPhone = candidate.phone
      }
      // Clean address
      if (finalAddress && (finalAddress.includes('http') || finalAddress.includes('.com'))) {
        finalAddress = '' // discard URLs
      }
      verifiedShops.push({
        name: finalName,
        address: finalAddress,
        phone: finalPhone,
        category: result.category || candidate.category,
      })
    }

    await delay(1500)
  }

  await browser.close()

  console.log(`\n[siheung] Verification done: ${verifiedShops.length} verified shops`)
  for (const s of verifiedShops) {
    console.log(`  OK ${s.name} | ${s.address}`)
  }

  if (verifiedShops.length === 0) {
    console.log('\n[siheung] No new verified shops found. Exiting.')
    return
  }

  // ── Step 3: Merge into shops.json ──────────────────────────────
  console.log(`\n[siheung] ── Step 3: Merging into shops.json ──\n`)

  const shopsPath = resolve(__dirname, '..', 'src', 'data', 'shops.json')
  const existingShops: Shop[] = JSON.parse(readFileSync(shopsPath, 'utf-8'))
  const existingNames = new Set(existingShops.map((s) => s.name.replace(/\s+/g, '')))

  const newShops: VerifiedShop[] = []
  for (const vs of verifiedShops) {
    const normalizedName = vs.name.replace(/\s+/g, '')
    if (existingNames.has(normalizedName)) {
      console.log(`  [skip] "${vs.name}" already exists in shops.json`)
    } else {
      newShops.push(vs)
      console.log(`  [new] "${vs.name}" will be added`)
    }
  }

  if (newShops.length === 0) {
    console.log('\n[siheung] All verified shops already exist in shops.json. Nothing to add.')
    return
  }

  // Geocode
  console.log(`\n[siheung] Geocoding ${newShops.length} new shops...`)
  const newShopEntries: Shop[] = []

  for (const ns of newShops) {
    console.log(`  [geocode] ${ns.name}: ${ns.address}`)
    const coords = await geocodeAddress(ns.address)
    console.log(`  [geocode] -> lat=${coords.lat}, lng=${coords.lng}`)

    const region = extractRegion(ns.address)
    const tags = extractTags(ns.category)
    const tagLabel = tags[0] || '디저트'

    const districtMatch = ns.address.match(/시흥시\s+([가-힣]+[동읍면리])/)
    const district = districtMatch ? districtMatch[1] : '시흥시'

    newShopEntries.push({
      id: '',
      name: ns.name,
      address: ns.address,
      lat: coords.lat,
      lng: coords.lng,
      phone: ns.phone,
      hours: '',
      closedDays: [],
      priceRange: '',
      tags,
      description: `${tagLabel} · 시흥 ${district}에 위치한 상하이버터떡 판매 매장`,
      region,
    })
  }

  // Merge
  const merged = [...existingShops, ...newShopEntries]

  // Sort by region then name
  const regionOrder = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
  merged.sort((a, b) => {
    const ra = regionOrder.indexOf(a.region)
    const rb = regionOrder.indexOf(b.region)
    const raCmp = ra === -1 ? 999 : ra
    const rbCmp = rb === -1 ? 999 : rb
    if (raCmp !== rbCmp) return raCmp - rbCmp
    return a.name.localeCompare(b.name, 'ko')
  })

  // Re-index IDs
  for (let i = 0; i < merged.length; i++) {
    merged[i].id = `shop-${String(i + 1).padStart(3, '0')}`
  }

  writeFileSync(shopsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

  console.log(`\n[siheung] ═══════════════════════════════════════════`)
  console.log(`[siheung] SUMMARY`)
  console.log(`[siheung] ═══════════════════════════════════════════`)
  console.log(`[siheung] Blog posts crawled: up to 15`)
  console.log(`[siheung] Candidates from blogs: ${uniqueCandidates.length}`)
  console.log(`[siheung] Verified on Naver Place: ${verifiedShops.length}`)
  console.log(`[siheung] New shops added: ${newShopEntries.length}`)
  console.log(`[siheung] Previous total: ${existingShops.length}`)
  console.log(`[siheung] New total: ${merged.length}`)
  console.log(`[siheung] Written to: ${shopsPath}`)
  console.log(`[siheung] ═══════════════════════════════════════════`)

  if (newShopEntries.length > 0) {
    console.log(`\n[siheung] New shops added:`)
    for (const s of newShopEntries) {
      console.log(`  - ${s.name} | ${s.address} | lat=${s.lat} lng=${s.lng}`)
    }
  }
}

main()
