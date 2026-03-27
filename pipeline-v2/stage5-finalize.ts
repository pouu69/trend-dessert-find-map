import { resolve, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import type { PipelineConfig, EnrichedShop, Shop, StageResult } from './lib/types'
import { extractRegion, loadConfig, getDataDir, saveJson, loadJson } from './lib/utils'

const REGION_PAIRS: readonly [string, string][] = [
  ['서울', '서울'], ['부산', '부산'], ['대구', '대구'],
  ['인천', '인천'], ['광주', '광주'], ['대전', '대전'],
  ['울산', '울산'], ['세종', '세종'], ['제주', '제주'],
  ['경기', '경기'], ['강원', '강원'],
  ['충북', '충북'], ['충청북', '충북'],
  ['충남', '충남'], ['충청남', '충남'],
  ['전북', '전북'], ['전라북', '전북'],
  ['전남', '전남'], ['전라남', '전남'],
  ['경북', '경북'], ['경상북', '경북'],
  ['경남', '경남'], ['경상남', '경남'],
]

function normalizeRegion(rawRegion: string): string {
  for (const [prefix, short] of REGION_PAIRS) {
    if (rawRegion.startsWith(prefix)) return short
  }
  return '기타'
}

export async function runStage5(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = dirname(__filename)

  const enrichedShops = loadJson<EnrichedShop[]>(resolve(dataDir, 'enriched-shops.json'), [])

  console.log('[Stage 5] Final schema generation')
  console.log(`  Input: ${enrichedShops.length} shops`)

  const shops: Shop[] = enrichedShops.map((enriched, index) => {
    const rawRegion = extractRegion(enriched.address)
    const region = normalizeRegion(rawRegion)

    const tags: string[] = enriched.category
      ? enriched.category.split(/[·,/]/).map(s => s.trim()).filter(Boolean)
      : []

    const descParts: string[] = []
    if (enriched.rating) {
      let ratingDesc = `★ ${enriched.rating}`
      if (enriched.reviewCount) {
        ratingDesc += ` (리뷰 ${enriched.reviewCount}개)`
      }
      descParts.push(ratingDesc)
    }
    if (enriched.category) {
      descParts.push(enriched.category)
    }

    return {
      id: `shop-${String(index + 1).padStart(3, '0')}`,
      name: enriched.name,
      address: enriched.address,
      lat: enriched.lat,
      lng: enriched.lng,
      phone: enriched.phone,
      hours: enriched.hours,
      closedDays: [],
      priceRange: '',
      tags,
      description: descParts.join(' · '),
      region,
    }
  })

  shops.sort((a, b) => {
    const regionCmp = a.region.localeCompare(b.region, 'ko')
    return regionCmp !== 0 ? regionCmp : a.name.localeCompare(b.name, 'ko')
  })
  shops.forEach((shop, index) => {
    shop.id = `shop-${String(index + 1).padStart(3, '0')}`
  })

  const outputPath = resolve(pipelineDir, config.outputPath)
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  saveJson(outputPath, shops)

  const regionCounts: Record<string, number> = {}
  for (const shop of shops) {
    regionCounts[shop.region] = (regionCounts[shop.region] || 0) + 1
  }
  console.log(`  Final: ${shops.length} shops`)
  for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${region}: ${count}`)
  }
  console.log(`  Output: ${outputPath}`)
  console.log('[Stage 5] Done\n')

  return {
    stage: 'stage5-finalize',
    success: true,
    outputFile: outputPath,
    itemCount: shops.length,
    errors: [],
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage5-finalize.ts')) {
  const config = loadConfig()
  runStage5(config).catch(err => {
    console.error('[Stage 5] Fatal:', err)
    process.exit(1)
  })
}
