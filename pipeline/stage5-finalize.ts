import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { EnrichedShop, Shop } from './lib/types'
import { extractRegion, loadConfig, getDataDir } from './lib/utils'

const config = loadConfig()
const dataDir = getDataDir()
const __filename = fileURLToPath(import.meta.url)
const pipelineDir = dirname(__filename)

const enrichedPath = resolve(dataDir, 'enriched-shops.json')
const enrichedShops: EnrichedShop[] = JSON.parse(readFileSync(enrichedPath, 'utf-8'))

console.log('[Stage 5] 최종 데이터 생성')
console.log(`  입력: ${enrichedShops.length}개 매장`)

// Convert to Shop schema
const shops: Shop[] = enrichedShops.map((enriched, index) => {
  const region = extractRegion(enriched.address)

  // Build tags from category
  const tags: string[] = []
  if (enriched.category) {
    // Split category by common delimiters
    const parts = enriched.category.split(/[·,/]/).map(s => s.trim()).filter(Boolean)
    tags.push(...parts)
  }

  // Build description from rating, reviewCount, category
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
  const description = descParts.join(' · ')

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
    description,
    region,
  }
})

// Sort by region then name
shops.sort((a, b) => {
  const regionCmp = a.region.localeCompare(b.region, 'ko')
  if (regionCmp !== 0) return regionCmp
  return a.name.localeCompare(b.name, 'ko')
})

// Re-assign IDs after sorting
shops.forEach((shop, index) => {
  shop.id = `shop-${String(index + 1).padStart(3, '0')}`
})

// Write to configured output path
const outputPath = resolve(pipelineDir, config.outputPath)
const outputDir = dirname(outputPath)
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

writeFileSync(outputPath, JSON.stringify(shops, null, 2), 'utf-8')
console.log(`  최종 매장 수: ${shops.length}개`)

// Log region breakdown
const regionCounts: Record<string, number> = {}
for (const shop of shops) {
  regionCounts[shop.region] = (regionCounts[shop.region] || 0) + 1
}
console.log('  지역별 매장 수:')
for (const [region, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${region}: ${count}개`)
}

console.log(`  저장: ${outputPath}`)
console.log('[Stage 5] 완료\n')
