import { chromium, type Page } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

interface PlaceResult {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  source: 'naver-place'
}

const ALREADY_FOUND = new Set([
  '달리당', '연남허니밀크', '수아카롱', '코드91', '모어커피랩',
  '브리나케오슈', '하츠베이커리', '미구제과', '위치앙베이커리',
  '야탑버터떡카페', '스칼렛베이커리', '몰레디저트카페', '디저트릭',
  '휘도르베이커리카페', '겐츠베이커리', '김덕규베이커리',
])

function isAlreadyFound(name: string): boolean {
  for (const known of ALREADY_FOUND) {
    if (name.includes(known) || known.includes(name)) return true
  }
  return false
}

const QUERIES = ['상하이버터떡', '버터라이스떡', '상하이떡']

const REGIONS: { name: string; x: number; y: number }[] = [
  { name: 'Seoul', x: 126.978, y: 37.566 },
  { name: 'Busan', x: 129.075, y: 35.179 },
  { name: 'Daegu', x: 128.601, y: 35.871 },
  { name: 'Gwangju', x: 126.851, y: 35.160 },
]

function buildUrl(query: string, x: number, y: number): string {
  return `https://m.place.naver.com/place/list?query=${encodeURIComponent(query)}&x=${x}&y=${y}&level=top`
}

async function delay(ms: number) {
  return new Promise(function (r) { setTimeout(r, ms) })
}

// Use page.$eval or string-based evaluate to avoid tsx __name injection
const EXTRACT_LIST_JS = `
(() => {
  var results = [];
  var links = document.querySelectorAll('a[href*="/place/"]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var href = link.href;
    if (!/\\/place\\/\\d+$/.test(href.split('?')[0])) continue;
    // Skip photo links
    if (/\\/photo/.test(href)) continue;

    var nameEl = link.querySelector('span, strong, h3, h2');
    var name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : (link.textContent ? link.textContent.trim() : '');
    if (!name || name.length > 50 || name.length < 2) continue;
    // Skip non-shop text
    if (/^이미지수/.test(name) || /^\\d+$/.test(name)) continue;

    var parent = link.closest('li') || link.parentElement;
    var catEl = parent ? parent.querySelector('[class*="YzBgS"], [class*="subcategory"], [class*="category"]') : null;
    var category = (catEl && catEl.textContent) ? catEl.textContent.trim() : '';

    results.push({ name: name, href: href, category: category });
  }
  // Deduplicate by href
  var seen = {};
  var deduped = [];
  for (var j = 0; j < results.length; j++) {
    if (!seen[results[j].href]) {
      seen[results[j].href] = true;
      deduped.push(results[j]);
    }
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

  var address = getText([
    '.LDgIH', '.PlaceDetailInfo .address', '.IH7VR', '.O8qbU', '.Y31Sf',
    'span[class*="addr"]', '.place_detail_txt'
  ]);

  if (!address) {
    var addrEl = document.querySelector('[aria-label*="주소"]');
    if (addrEl && addrEl.textContent) address = addrEl.textContent.trim();
  }

  var phone = getText([
    '.xlx7Q', '.place_detail_tel', 'a[href^="tel:"]'
  ]);
  if (!phone) {
    var phoneEl = document.querySelector('a[href^="tel:"]');
    if (phoneEl) phone = phoneEl.href.replace('tel:', '');
  }

  var hours = getText([
    '.A_cdD .i8cJw', '.place_detail_hours', '.MkTHd'
  ]);

  var category = getText([
    '.lnJFt', '.YzBgS', '.KCMnt', 'span[class*="category"]'
  ]);

  return {
    address: address || '',
    phone: phone || '',
    hours: hours || '',
    category: category || ''
  };
})()
`

async function extractListItems(page: Page): Promise<{ name: string; href: string; category: string }[]> {
  // Scroll a few times to load more results
  for (let i = 0; i < 5; i++) {
    await page.evaluate('window.scrollBy(0, 800)')
    await delay(500)
  }
  const items = await page.evaluate(EXTRACT_LIST_JS) as { name: string; href: string; category: string }[]
  return items
}

async function extractDetailInfo(page: Page): Promise<{ address: string; phone: string; hours: string; category: string }> {
  await delay(2000)
  return page.evaluate(EXTRACT_DETAIL_JS) as Promise<{ address: string; phone: string; hours: string; category: string }>
}

async function main() {
  console.log('[naver-place] Starting Naver Place mobile crawl...')

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

  for (const region of REGIONS) {
    for (const query of QUERIES) {
      const url = buildUrl(query, region.x, region.y)
      console.log(`\n[naver-place] Searching "${query}" in ${region.name}...`)
      console.log(`  URL: ${url}`)

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(3000)

        // Debug: log page title
        const title = await page.title()
        console.log(`  Page title: ${title}`)

        // Preview page text
        const bodyText = await page.evaluate('document.body ? document.body.innerText.slice(0, 500) : "(empty)"') as string
        console.log(`  Page preview: ${bodyText.slice(0, 200)}...`)

        const items = await extractListItems(page)
        console.log(`  Found ${items.length} place items`)

        for (const item of items) {
          if (seenNames.has(item.name)) continue
          if (isAlreadyFound(item.name)) {
            console.log(`  [skip] Already known: ${item.name}`)
            continue
          }

          console.log(`  Visiting detail: ${item.name} -> ${item.href}`)

          try {
            await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 15000 })
            await delay(2000)

            const detail = await extractDetailInfo(page)

            const result: PlaceResult = {
              name: item.name,
              address: detail.address,
              phone: detail.phone,
              hours: detail.hours,
              category: detail.category || item.category,
              source: 'naver-place',
            }

            allResults.push(result)
            seenNames.add(item.name)
            console.log(`    -> ${result.address || '(no address)'} | ${result.phone || '(no phone)'} | ${result.category || '(no category)'}`)
          } catch (e) {
            console.warn(`    [error] Failed to get detail for ${item.name}:`, e)
          }

          await delay(2000)
        }

        await delay(2000)
      } catch (e) {
        console.warn(`  [error] Failed to search "${query}" in ${region.name}:`, e)
      }
    }
  }

  await browser.close()

  // Deduplicate by name
  const unique = allResults.filter(function (r, i, arr) {
    return arr.findIndex(function (a) { return a.name === r.name }) === i
  })

  const outPath = resolve(import.meta.dirname!, 'naver-place-results.json')
  writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log(`[naver-place] SUMMARY`)
  console.log(`  Total new shops found: ${unique.length}`)
  console.log(`  Output: ${outPath}`)
  console.log('='.repeat(60))

  if (unique.length > 0) {
    console.log('\nNew shops:')
    for (const shop of unique) {
      console.log(`  - ${shop.name} | ${shop.address} | ${shop.category}`)
    }
  } else {
    console.log('\nNo new shops found beyond already-known list.')
  }
}

main().catch(console.error)
