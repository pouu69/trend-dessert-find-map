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

const QUERIES = ['촉촉한황치즈칩', '촉촉한황치즈칩 파는곳', '황치즈칩']

const REGIONS: { name: string; x: number; y: number }[] = [
  { name: 'Seoul',    x: 126.978, y: 37.566 },
  { name: 'Busan',    x: 129.075, y: 35.179 },
  { name: 'Daegu',    x: 128.601, y: 35.871 },
  { name: 'Incheon',  x: 126.705, y: 37.456 },
  { name: 'Gwangju',  x: 126.851, y: 35.160 },
  { name: 'Daejeon',  x: 127.385, y: 36.350 },
  { name: 'Ulsan',    x: 129.311, y: 35.539 },
  { name: 'Suwon',    x: 127.009, y: 37.263 },
  { name: 'Changwon', x: 128.681, y: 35.228 },
  { name: 'Cheongju', x: 127.489, y: 36.642 },
  { name: 'Jeonju',   x: 127.108, y: 35.824 },
  { name: 'Jeju',     x: 126.531, y: 33.499 },
]

function buildUrl(query: string, x: number, y: number): string {
  return `https://m.place.naver.com/place/list?query=${encodeURIComponent(query)}&x=${x}&y=${y}&level=top`
}

async function delay(ms: number) {
  return new Promise(function (r) { setTimeout(r, ms) })
}

// Extract list items from the search result page - addresses included inline on mobile
const EXTRACT_LIST_JS = `
(() => {
  var results = [];
  var links = document.querySelectorAll('a[href*="/place/"]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var href = link.href;
    // Only match /place/{digits} at end (before query string)
    var pathPart = href.split('?')[0];
    if (!/\\/place\\/\\d+$/.test(pathPart)) continue;
    // Skip photo links
    if (/\\/photo/.test(href)) continue;

    var nameEl = link.querySelector('span, strong, h3, h2');
    var name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : (link.textContent ? link.textContent.trim() : '');
    if (!name || name.length > 50 || name.length < 2) continue;
    if (/^이미지수/.test(name) || /^\\d+$/.test(name)) continue;

    // Get the containing list item for more context
    var li = link.closest('li') || link.closest('[class*="item"]') || link.parentElement;
    var catEl = li ? li.querySelector('[class*="YzBgS"], [class*="subcategory"], [class*="category"]') : null;
    var category = (catEl && catEl.textContent) ? catEl.textContent.trim() : '';

    // Try to grab address text from the list item (mobile shows partial address inline)
    var liText = li ? li.innerText : '';

    results.push({ name: name, href: href, category: category, liText: liText });
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

  // Clean address - remove "주소" prefix and navigation fluff
  if (address) {
    address = address.replace(/^주소/, '').replace(/지도.*$/, '').trim();
  }

  var phone = getText([
    '.xlx7Q', '.place_detail_tel'
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

async function main() {
  console.log('[naver-place-cheese] Starting Naver Place mobile crawl for 촉촉한황치즈칩...')

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
  const MAX_DETAIL_PER_SEARCH = 20 // Only visit top 20 detail pages per search

  for (const region of REGIONS) {
    for (const query of QUERIES) {
      const url = buildUrl(query, region.x, region.y)
      console.log(`\n[naver-place-cheese] Searching "${query}" in ${region.name}...`)
      console.log(`  URL: ${url}`)

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(3000)

        // Scroll to load more
        for (let i = 0; i < 3; i++) {
          await page.evaluate('window.scrollBy(0, 1000)')
          await delay(500)
        }

        const items = await page.evaluate(EXTRACT_LIST_JS) as { name: string; href: string; category: string; liText: string }[]
        console.log(`  Found ${items.length} place items`)

        let visitedCount = 0
        for (const item of items) {
          if (visitedCount >= MAX_DETAIL_PER_SEARCH) {
            console.log(`  [limit] Reached max ${MAX_DETAIL_PER_SEARCH} detail visits for this search`)
            break
          }

          if (seenNames.has(item.name)) continue

          console.log(`  [${visitedCount + 1}] ${item.name} -> ${item.href}`)

          try {
            await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 15000 })
            await delay(2000)

            const detail = await page.evaluate(EXTRACT_DETAIL_JS) as { address: string; phone: string; hours: string; category: string }

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
            visitedCount++
            console.log(`    -> ${result.address || '(no address)'} | ${result.phone || '(no phone)'} | ${result.category || '(no category)'}`)
          } catch (e: any) {
            console.warn(`    [error] ${item.name}: ${e.message?.slice(0, 100)}`)
            visitedCount++
          }

          await delay(2000)
        }

        await delay(2000)
      } catch (e: any) {
        console.warn(`  [error] Search failed: ${e.message?.slice(0, 100)}`)
      }
    }
  }

  await browser.close()

  // Deduplicate by name
  const unique = allResults.filter(function (r, i, arr) {
    return arr.findIndex(function (a) { return a.name === r.name }) === i
  })

  const outPath = resolve(import.meta.dirname!, 'naver-place-cheese-results.json')
  writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log('[naver-place-cheese] SUMMARY')
  console.log(`  Total shops found: ${unique.length}`)
  console.log(`  Output: ${outPath}`)
  console.log('='.repeat(60))

  if (unique.length > 0) {
    console.log('\nShops found:')
    for (const shop of unique) {
      console.log(`  - ${shop.name} | ${shop.address} | ${shop.category}`)
    }
  } else {
    console.log('\nNo shops found.')
  }
}

main().catch(console.error)
