import { resolve } from 'path'
import type { PipelineConfig, RawShop, EnrichedShop, StageResult } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson, sleep } from './lib/utils'
import { launchBrowser } from './lib/browser'
import { searchGoogleMaps, geocodeWithNominatim } from './lib/google-maps'

export async function runStage4(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const errors: string[] = []

  const cleanedShops = loadJson<RawShop[]>(resolve(dataDir, 'cleaned-shops.json'), [])

  console.log('[Stage 4] Google Maps enrichment + Nominatim fallback')
  console.log(`  Input: ${cleanedShops.length} shops`)

  const { browser, context } = await launchBrowser()
  const enrichedShops: EnrichedShop[] = []
  const page = await context.newPage()

  try {
    for (let i = 0; i < cleanedShops.length; i++) {
      const shop = cleanedShops[i]
      console.log(`  [${i + 1}/${cleanedShops.length}] "${shop.name}"`)

      const city = extractRegion(shop.address) || ''
      const mapsData = await searchGoogleMaps(page, shop.name, city, config.googleMapsDelayMs)

      let lat = mapsData?.lat ?? null
      let lng = mapsData?.lng ?? null

      if ((lat === null || lng === null) && shop.address) {
        console.log(`    Nominatim fallback for: ${shop.address.slice(0, 40)}`)
        const nominatimResult = await geocodeWithNominatim(shop.address, config.nominatimDelayMs)
        if (nominatimResult) {
          lat = nominatimResult.lat
          lng = nominatimResult.lng
          console.log(`    Nominatim: ${lat}, ${lng}`)
        }
      }

      const enriched: EnrichedShop = {
        name: mapsData?.name || shop.name,
        address: mapsData?.address || shop.address,
        phone: mapsData?.phone || shop.phone,
        hours: mapsData?.hours || shop.hours,
        category: mapsData?.category || shop.category,
        rating: mapsData?.rating || '',
        reviewCount: mapsData?.reviewCount || '',
        lat,
        lng,
        description: '',
        source: shop.source,
      }

      enrichedShops.push(enriched)

      if ((i + 1) % 20 === 0) {
        saveJson(resolve(dataDir, 'enriched-shops-checkpoint.json'), enrichedShops)
        console.log(`    [checkpoint saved: ${enrichedShops.length} shops]`)
      }

      await sleep(config.googleMapsDelayMs)
    }
  } catch (error) {
    errors.push(`Stage 4 error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await page.close()
    await browser.close()
  }

  const outputFile = resolve(dataDir, 'enriched-shops.json')
  saveJson(outputFile, enrichedShops)

  const withCoords = enrichedShops.filter(s => s.lat !== null && s.lng !== null).length
  console.log(`  With coordinates: ${withCoords}/${enrichedShops.length}`)
  console.log('[Stage 4] Done\n')

  return {
    stage: 'stage4-enrich',
    success: true,
    outputFile,
    itemCount: enrichedShops.length,
    errors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage4-enrich.ts')) {
  const config = loadConfig()
  runStage4(config).catch(err => {
    console.error('[Stage 4] Fatal:', err)
    process.exit(1)
  })
}
