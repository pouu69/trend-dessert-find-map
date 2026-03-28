/**
 * Stage 4 (Google-only variant): skips Kakao Maps, runs Google Maps + Nominatim fallback.
 * Used when Kakao enrichment is skipped or already done.
 */
import { resolve } from 'path'
import type { PipelineConfig, RawShop, EnrichedShop } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson, sleep } from './lib/utils'
import { launchBrowser } from './lib/browser'
import { searchGoogleMaps, geocodeWithNominatim } from './lib/google-maps'

async function run(config: PipelineConfig): Promise<void> {
  const dataDir = getDataDir()
  const cleanedShops = loadJson<RawShop[]>(resolve(dataDir, 'cleaned-shops.json'), [])

  console.log('[Stage 4 Google-only] Map enrichment')
  console.log(`  Input: ${cleanedShops.length} shops`)

  const { browser, context } = await launchBrowser()
  const page = await context.newPage()
  const googleData = new Map<string, Partial<EnrichedShop>>()

  try {
    for (let i = 0; i < cleanedShops.length; i++) {
      const shop = cleanedShops[i]
      console.log(`  [gmaps ${i + 1}/${cleanedShops.length}] "${shop.name}"`)

      const city = extractRegion(shop.address) || ''
      const data = await searchGoogleMaps(page, shop.name, city, config.googleMapsDelayMs)
      if (data) {
        googleData.set(shop.name, { ...data, enrichedBy: 'google-maps' })
      }

      if ((i + 1) % 20 === 0) {
        console.log(`    [checkpoint: ${googleData.size} enriched]`)
      }

      await sleep(config.googleMapsDelayMs)
    }
  } finally {
    await page.close()
    await browser.close()
  }

  console.log(`  Google enriched: ${googleData.size}/${cleanedShops.length}`)
  console.log('\n  --- Nominatim fallback ---')

  const enrichedShops: EnrichedShop[] = []
  for (const shop of cleanedShops) {
    const google = googleData.get(shop.name)

    let lat = shop.lat ?? google?.lat ?? null
    let lng = shop.lng ?? google?.lng ?? null
    let enrichedBy = shop.lat !== null ? 'blog-coords' : (google?.lat ? 'google-maps' : '')

    if ((lat === null || lng === null) && shop.address) {
      const nominatim = await geocodeWithNominatim(shop.address, config.nominatimDelayMs)
      if (nominatim) {
        lat = nominatim.lat
        lng = nominatim.lng
        enrichedBy = 'nominatim'
      }
    }

    enrichedShops.push({
      name: google?.name || shop.name,
      address: google?.address || shop.address,
      phone: google?.phone || shop.phone,
      hours: google?.hours || shop.hours,
      category: google?.category || shop.category,
      rating: google?.rating || '',
      reviewCount: google?.reviewCount || '',
      lat,
      lng,
      description: '',
      enrichedBy: enrichedBy || 'none',
    })
  }

  const outputFile = resolve(dataDir, 'enriched-shops.json')
  saveJson(outputFile, enrichedShops)

  const coordCount = enrichedShops.filter(s => s.lat !== null).length
  console.log(`  With coordinates: ${coordCount}/${enrichedShops.length}`)
  console.log('[Stage 4 Google-only] Done\n')
}

const config = loadConfig()
run(config).catch(err => {
  console.error('[Stage 4 Google-only] Fatal:', err)
  process.exit(1)
})
