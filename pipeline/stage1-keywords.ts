import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import type { PipelineConfig } from './lib/types'

const configPath = resolve(dirname(import.meta.dirname || __dirname), 'pipeline', 'pipeline.config.json')
const config: PipelineConfig = JSON.parse(readFileSync(configPath, 'utf-8'))

const dataDir = resolve(dirname(configPath), config.dataDir)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

console.log('[Stage 1] 키워드 생성')
console.log(`  제품: ${config.product}`)
console.log(`  패턴 수: ${config.searchPatterns.length}`)
console.log(`  도시 수: ${config.cities.length}`)

const keywords: string[] = []

for (const pattern of config.searchPatterns) {
  if (pattern.includes('{city}')) {
    // City-specific pattern: generate one keyword per city
    for (const city of config.cities) {
      const keyword = pattern
        .replace('{product}', config.product)
        .replace('{city}', city)
      keywords.push(keyword)
    }
  } else {
    // General pattern: just replace product
    const keyword = pattern.replace('{product}', config.product)
    keywords.push(keyword)
  }
}

// Deduplicate
const uniqueKeywords = [...new Set(keywords)]

console.log(`  생성된 키워드: ${uniqueKeywords.length}개`)
console.log(`  예시:`)
uniqueKeywords.slice(0, 5).forEach(k => console.log(`    - ${k}`))
if (uniqueKeywords.length > 5) {
  console.log(`    ... 외 ${uniqueKeywords.length - 5}개`)
}

const outputPath = resolve(dataDir, 'keywords.json')
writeFileSync(outputPath, JSON.stringify(uniqueKeywords, null, 2), 'utf-8')
console.log(`  저장: ${outputPath}`)
console.log('[Stage 1] 완료\n')
