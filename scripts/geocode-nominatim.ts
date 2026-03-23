import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const dataPath = resolve(import.meta.dirname!, '../pipeline/data/enriched-shops.json')

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const clean = query
    .replace(/KR\s*/g, '')
    .replace(/\d+층/g, '')
    .replace(/\d+호/g, '')
    .replace(/번지/g, '')
    .replace(/\(.*\)/g, '')
    .trim()

  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&q=${encodeURIComponent(clean)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'butter-tteok-app/1.0' } })
  const results = (await res.json()) as { lat: string; lon: string }[]

  if (results.length > 0) {
    const lat = parseFloat(results[0].lat)
    const lng = parseFloat(results[0].lon)
    if (lat > 33 && lat < 39 && lng > 124.5 && lng < 132) {
      return { lat, lng }
    }
  }
  return null
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'))
  const need = data.filter(
    (s: { lat: number | null; lng: number | null }) =>
      !s.lat || !s.lng || s.lat < 33 || s.lat > 39 || s.lng < 124.5 || s.lng > 132
  )
  console.log(`[geocode] ${need.length}개 매장 좌표 검색 (Nominatim)`)

  let found = 0
  let failed = 0

  for (let i = 0; i < need.length; i++) {
    const shop = need[i]
    const addr = shop.address || ''
    console.log(`  [${i + 1}/${need.length}] ${shop.name} | ${addr.slice(0, 40)}`)

    // Try full address
    let coords = await geocode(addr)

    // If failed, try shop name + city
    if (!coords && addr) {
      const city =
        addr.match(
          /(서울|부산|대구|인천|광주|대전|울산|경기|충북|충남|전북|전남|경북|경남|제주|강원)/
        )?.[0] || ''
      if (city) {
        coords = await geocode(`${shop.name} ${city}`)
      }
    }

    if (coords) {
      shop.lat = coords.lat
      shop.lng = coords.lng
      found++
      console.log(`    ✓ ${coords.lat}, ${coords.lng}`)
    } else {
      failed++
      console.log(`    ✗`)
    }

    await sleep(1100) // Nominatim rate limit

    if ((i + 1) % 20 === 0) {
      writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`    [saved]`)
    }
  }

  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n${'='.repeat(50)}`)
  console.log(`[geocode] 완료: ${found}개 찾음, ${failed}개 실패`)
  console.log(`${'='.repeat(50)}`)
}

main().catch(console.error)
