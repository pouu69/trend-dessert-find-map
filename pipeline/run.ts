import { execSync } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { loadConfig } from './lib/utils'

const config = loadConfig()
const __filename = fileURLToPath(import.meta.url)
const pipelineDir = resolve(__filename, '..')

// Forward CLI args to each stage
const cliArgs: string[] = []
if (process.argv.includes('--product')) {
  cliArgs.push(`--product "${config.product}"`)
}
if (process.argv.includes('--output')) {
  const outputIdx = process.argv.indexOf('--output')
  cliArgs.push(`--output "${process.argv[outputIdx + 1]}"`)
}
const forwardArgs = cliArgs.join(' ')

console.log(`\n🔍 데이터 수집 파이프라인`)
console.log(`제품: ${config.product}\n`)

const stages = [
  { name: 'Stage 1: 키워드 생성', file: 'stage1-keywords.ts' },
  { name: 'Stage 2: 블로그 크롤링', file: 'stage2-crawl-blogs.ts' },
  { name: 'Stage 3: 데이터 정제', file: 'stage3-clean.ts' },
  { name: 'Stage 4: Google Maps 보강', file: 'stage4-enrich.ts' },
  { name: 'Stage 5: 최종 생성', file: 'stage5-finalize.ts' },
]

for (const stage of stages) {
  console.log(`${'='.repeat(50)}`)
  console.log(`▶ ${stage.name}`)
  console.log(`${'='.repeat(50)}\n`)

  try {
    execSync(`npx tsx ${resolve(pipelineDir, stage.file)} ${forwardArgs}`, {
      stdio: 'inherit',
      cwd: resolve(pipelineDir, '..'),
    })
  } catch (error) {
    console.error(`\n❌ ${stage.name} 실패`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

console.log(`${'='.repeat(50)}`)
console.log(`✅ 파이프라인 완료!`)
console.log(`${'='.repeat(50)}\n`)
