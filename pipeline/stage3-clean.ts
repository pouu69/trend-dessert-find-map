import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import type { PipelineConfig, RawShop } from './lib/types'
import { isGenericName, isDuplicate } from './lib/utils'

const configPath = resolve(dirname(import.meta.dirname || __dirname), 'pipeline', 'pipeline.config.json')
const config: PipelineConfig = JSON.parse(readFileSync(configPath, 'utf-8'))

const dataDir = resolve(dirname(configPath), config.dataDir)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const rawPath = resolve(dataDir, 'raw-shops.json')
const rawShops: RawShop[] = JSON.parse(readFileSync(rawPath, 'utf-8'))

console.log('[Stage 3] 데이터 정제')
console.log(`  입력: ${rawShops.length}개 매장`)

// Step 1: Remove entries with generic names
let shops = rawShops.filter(shop => {
  if (isGenericName(shop.name)) {
    return false
  }
  return true
})
console.log(`  이름 필터 후: ${shops.length}개`)

// Step 2: Remove entries without name
shops = shops.filter(shop => shop.name && shop.name.trim().length > 0)
console.log(`  이름 없는 항목 제거 후: ${shops.length}개`)

// Step 3: Remove entries without address
shops = shops.filter(shop => shop.address && shop.address.trim().length > 0)
console.log(`  주소 없는 항목 제거 후: ${shops.length}개`)

// Step 4: Deduplicate by normalized name + district, merging data
const deduped: RawShop[] = []
for (const shop of shops) {
  const existingIndex = deduped.findIndex(existing => isDuplicate(existing, shop))
  if (existingIndex >= 0) {
    // Merge: fill missing fields from the new entry
    const existing = deduped[existingIndex]
    if (!existing.phone && shop.phone) existing.phone = shop.phone
    if (!existing.hours && shop.hours) existing.hours = shop.hours
    if (!existing.category && shop.category) existing.category = shop.category
    // Prefer longer address (more detailed)
    if (shop.address.length > existing.address.length) {
      existing.address = shop.address
    }
  } else {
    deduped.push({ ...shop })
  }
}
console.log(`  중복 제거 후: ${deduped.length}개`)

const outputPath = resolve(dataDir, 'cleaned-shops.json')
writeFileSync(outputPath, JSON.stringify(deduped, null, 2), 'utf-8')
console.log(`  저장: ${outputPath}`)
console.log('[Stage 3] 완료\n')
