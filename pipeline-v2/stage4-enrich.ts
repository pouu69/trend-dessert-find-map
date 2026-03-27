import { resolve } from 'path'
import type { PipelineConfig, RawShop, EnrichedShop, StageResult } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson, sleep } from './lib/utils'
import { launchBrowser } from './lib/browser'
import { searchGoogleMaps, geocodeWithNominatim } from './lib/google-maps'
import { enrichWithKakaoMaps } from './lib/kakao-maps'

/**
 * Stage 4: Map Enrichment
 *
 * Takes discovered shops from Stage 3 and enriches with:
 * 1. Blog-extracted coordinates (if SmartEditor map block had GPS)
 * 2. Kakao Maps — address, phone, hours, category
 * 3. Google Maps — rating, review count, coordinates
 * 4. Nominatim — coordinate fallback
 *
 * Kakao Maps and Google Maps run on SEPARATE shop batches for parallelism.
 * When run via Agent Team, each can be a separate agent.
 */
export async function runStage4(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const errors: string[] = []

  const cleanedShops = loadJson<RawShop[]>(resolve(dataDir, 'cleaned-shops.json'), [])

  console.log('[Stage 4] Map enrichment (Kakao + Google + Nominatim)')
  console.log(`  Input: ${cleanedShops.length} shops`)

  // Step 1: Separate shops that already have coordinates (from blog SmartEditor)
  const withCoords = cleanedShops.filter(s => s.lat !== null && s.lng !== null)
  const needsEnrichment = cleanedShops.filter(s => s.lat === null || s.lng === null)
  console.log(`  Already have coords: ${withCoords.length}`)
  console.log(`  Need enrichment: ${needsEnrichment.length}`)

  // Step 2: Kakao Maps enrichment for ALL shops (get address, phone, hours, category)
  console.log('\n  --- Kakao Maps enrichment ---')
  const kakaoData = await enrichWithKakaoMaps(
    cleanedShops.map(s => ({ name: s.name, address: s.address })),
    config.kakaoMapsDelayMs,
  ).catch(err => {
    errors.push(`Kakao Maps enrichment failed: ${err instanceof Error ? err.message : err}`)
    return new Map<string, Partial<EnrichedShop>>()
  })
  console.log(`  Kakao enriched: ${kakaoData.size}/${cleanedShops.length}`)

  // Step 3: Google Maps enrichment for shops still missing coordinates
  console.log('\n  --- Google Maps enrichment ---')
  const { browser, context } = await launchBrowser()
  const gmapsPage = await context.newPage()
  const googleData = new Map<string, Partial<EnrichedShop>>()

  try {
    const shopsNeedingCoords = cleanedShops.filter(s => {
      // Skip if blog already gave us coords
      if (s.lat !== null && s.lng !== null) return false
      // Skip if Kakao already gave us enough
      const kakao = kakaoData.get(s.name)
      if (kakao?.lat !== null && kakao?.lat !== undefined) return false
      return true
    })

    console.log(`  Google Maps targets: ${shopsNeedingCoords.length} shops`)

    for (let i = 0; i < shopsNeedingCoords.length; i++) {
      const shop = shopsNeedingCoords[i]
      console.log(`  [gmaps ${i + 1}/${shopsNeedingCoords.length}] "${shop.name}"`)

      const city = extractRegion(shop.address) || ''
      const data = await searchGoogleMaps(gmapsPage, shop.name, city, config.googleMapsDelayMs)

      if (data) {
        googleData.set(shop.name, { ...data, enrichedBy: 'google-maps' })
      }

      // Checkpoint every 20 shops
      if ((i + 1) % 20 === 0) {
        console.log(`    [checkpoint: ${googleData.size} enriched]`)
      }

      await sleep(config.googleMapsDelayMs)
    }
  } catch (error) {
    errors.push(`Google Maps error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await gmapsPage.close()
    await browser.close()
  }
  console.log(`  Google enriched: ${googleData.size}`)

  // Step 4: Merge all data sources and apply Nominatim fallback
  console.log('\n  --- Merging + Nominatim fallback ---')
  const enrichedShops: EnrichedShop[] = []

  for (const shop of cleanedShops) {
    const kakao = kakaoData.get(shop.name)
    const google = googleData.get(shop.name)

    // Determine coordinates: blog > google > nominatim
    let lat = shop.lat ?? google?.lat ?? null
    let lng = shop.lng ?? google?.lng ?? null
    let enrichedBy = shop.lat !== null ? 'blog-coords' : (google?.lat ? 'google-maps' : '')

    // Nominatim fallback if still no coords
    if ((lat === null || lng === null) && shop.address) {
      const nominatim = await geocodeWithNominatim(shop.address, config.nominatimDelayMs)
      if (nominatim) {
        lat = nominatim.lat
        lng = nominatim.lng
        enrichedBy = 'nominatim'
      }
    }

    enrichedShops.push({
      name: google?.name || kakao?.name || shop.name,
      address: kakao?.address || google?.address || shop.address,
      phone: kakao?.phone || google?.phone || shop.phone,
      hours: kakao?.hours || google?.hours || shop.hours,
      category: kakao?.category || google?.category || shop.category,
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

  const coordCount = enrichedShops.filter(s => s.lat !== null && s.lng !== null).length
  console.log(`\n  With coordinates: ${coordCount}/${enrichedShops.length}`)
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
