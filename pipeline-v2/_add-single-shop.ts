import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { launchBrowser } from './lib/browser'
import { enrichWithKakaoMaps } from './lib/kakao-maps'
import { searchGoogleMaps, geocodeWithNominatim } from './lib/google-maps'
import { extractRegion, loadConfig } from './lib/utils'
import type { Shop } from './lib/types'

const __filename = fileURLToPath(import.meta.url)
const pipelineDir = dirname(__filename)

async function run() {
  const shopName = process.argv[2] ?? '오보타르트 선유도역'
  const hintCity = process.argv[3] ?? '서울'
  const config = loadConfig()

  console.log(`Searching: "${shopName}"`)

  // Kakao Maps
  const kakaoData = await enrichWithKakaoMaps(
    [{ name: shopName, address: hintCity }],
    config.kakaoMapsDelayMs,
  )
  const kakao = kakaoData.get(shopName)
  console.log('Kakao:', JSON.stringify(kakao))

  // Google Maps
  const { browser, context } = await launchBrowser()
  const page = await context.newPage()
  let google = null
  try {
    google = await searchGoogleMaps(page, shopName, hintCity, config.googleMapsDelayMs)
    console.log('Google:', JSON.stringify(google))
  } finally {
    await page.close()
    await browser.close()
  }

  // Coordinates
  let lat = google?.lat ?? kakao?.lat ?? null
  let lng = google?.lng ?? kakao?.lng ?? null
  let enrichedBy = google?.lat ? 'google-maps' : (kakao?.lat ? 'kakao-maps' : '')

  const address = kakao?.address ?? google?.address ?? hintCity
  if ((lat === null || lng === null) && address) {
    const nominatim = await geocodeWithNominatim(address, config.nominatimDelayMs)
    if (nominatim) { lat = nominatim.lat; lng = nominatim.lng; enrichedBy = 'nominatim' }
  }

  // Region
  const REGION_PAIRS: [string, string][] = [
    ['서울','서울'],['부산','부산'],['대구','대구'],['인천','인천'],
    ['광주','광주'],['대전','대전'],['울산','울산'],['세종','세종'],
    ['제주','제주'],['경기','경기'],['강원','강원'],['충북','충북'],
    ['충청북','충북'],['충남','충남'],['충청남','충남'],['전북','전북'],
    ['전라북','전북'],['전남','전남'],['전라남','전남'],['경북','경북'],
    ['경상북','경북'],['경남','경남'],['경상남','경남'],
  ]
  const rawRegion = extractRegion(address)
  const region = REGION_PAIRS.find(([p]) => rawRegion.startsWith(p))?.[1] ?? '기타'

  // Tags
  const category = kakao?.category ?? google?.category ?? ''
  const tags = category ? category.split(/[·,/]/).map((s: string) => s.trim()).filter(Boolean) : []

  // Load shops.json and append
  const outputPath = resolve(pipelineDir, config.outputPath)
  const shops: Shop[] = JSON.parse(readFileSync(outputPath, 'utf-8'))

  const newShop: Shop = {
    id: `shop-${String(shops.length + 1).padStart(3, '0')}`,
    name: google?.name ?? kakao?.name ?? shopName,
    address,
    lat,
    lng,
    phone: kakao?.phone ?? google?.phone ?? '',
    hours: kakao?.hours ?? google?.hours ?? '',
    closedDays: [],
    priceRange: '',
    tags,
    description: category,
    region,
  }

  console.log('\nNew shop:', JSON.stringify(newShop, null, 2))

  shops.push(newShop)
  // Re-sort and re-id
  shops.sort((a, b) => {
    const rc = a.region.localeCompare(b.region, 'ko')
    return rc !== 0 ? rc : a.name.localeCompare(b.name, 'ko')
  })
  shops.forEach((s, i) => { s.id = `shop-${String(i + 1).padStart(3, '0')}` })
  writeFileSync(outputPath, JSON.stringify(shops, null, 2), 'utf-8')
  console.log(`\nSaved. Total: ${shops.length} shops`)
}

run().catch(err => { console.error(err); process.exit(1) })
