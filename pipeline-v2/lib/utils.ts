import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PipelineConfig } from './types'

export function normalizeName(name: string): string {
  return name.replace(/[\s\-·.,():/]/g, '').toLowerCase()
}

const REGION_MAP: ReadonlyMap<string, string> = new Map([
  ['서울특별시', '서울'], ['서울시', '서울'], ['서울', '서울'],
  ['부산광역시', '부산'], ['부산시', '부산'], ['부산', '부산'],
  ['대구광역시', '대구'], ['대구시', '대구'], ['대구', '대구'],
  ['인천광역시', '인천'], ['인천시', '인천'], ['인천', '인천'],
  ['광주광역시', '광주'], ['광주시', '광주'], ['광주', '광주'],
  ['대전광역시', '대전'], ['대전시', '대전'], ['대전', '대전'],
  ['울산광역시', '울산'], ['울산시', '울산'], ['울산', '울산'],
  ['세종특별자치시', '세종'], ['세종시', '세종'], ['세종', '세종'],
  ['경기도', '경기'], ['경기', '경기'],
  ['강원특별자치도', '강원'], ['강원도', '강원'], ['강원', '강원'],
  ['충청북도', '충북'], ['충북', '충북'],
  ['충청남도', '충남'], ['충남', '충남'],
  ['전북특별자치도', '전북'], ['전라북도', '전북'], ['전북', '전북'],
  ['전라남도', '전남'], ['전남', '전남'],
  ['경상북도', '경북'], ['경북', '경북'],
  ['경상남도', '경남'], ['경남', '경남'],
  ['제주특별자치도', '제주'], ['제주도', '제주'], ['제주', '제주'],
])

export function extractRegion(address: string): string {
  const first = address.split(/\s+/)[0]
  if (!first) return '기타'
  return REGION_MAP.get(first) ?? first
}

export function extractDistrict(address: string): string {
  return address.split(/\s+/).slice(0, 3).join(' ')
}

export function isDuplicate(
  a: { readonly name: string; readonly address: string },
  b: { readonly name: string; readonly address: string },
): boolean {
  return normalizeName(a.name) === normalizeName(b.name)
    && extractDistrict(a.address) === extractDistrict(b.address)
}

const GENERIC_PATTERNS: readonly RegExp[] = [
  /카페$/, /^.{1,3}카페$/, /동카페$/, /구카페$/, /시카페$/,
  /^디저트카페$/, /^베이커리카페$/, /^맛집카페$/,
  /^네이버/, /^검색 결과/, /위치찾기/,
]

export function isGenericName(name: string): boolean {
  const trimmed = name.trim()
  return GENERIC_PATTERNS.some(p => p.test(trimmed))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export function loadConfig(configOverridePath?: string): PipelineConfig {
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = resolve(dirname(__filename), '..')
  const configPath = configOverridePath ?? resolve(pipelineDir, 'pipeline.config.json')

  let config: PipelineConfig
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch (error) {
    throw new Error(`Failed to load pipeline config from ${configPath}: ${error instanceof Error ? error.message : error}`)
  }

  const args = process.argv.slice(2)
  const productIdx = args.indexOf('--product')
  const product = productIdx !== -1 && args[productIdx + 1]
    ? args[productIdx + 1]
    : config.product

  const outputIdx = args.indexOf('--output')
  const outputPath = outputIdx !== -1 && args[outputIdx + 1]
    ? args[outputIdx + 1]
    : config.outputPath

  const resolved = { ...config, product, outputPath }

  const dataDir = resolve(pipelineDir, resolved.dataDir)
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  return resolved
}

export function getDataDir(): string {
  const config = loadConfig()
  const __filename = fileURLToPath(import.meta.url)
  const pipelineDir = resolve(dirname(__filename), '..')
  return resolve(pipelineDir, config.dataDir)
}

/** Save intermediate results with atomic write pattern */
export function saveJson(filePath: string, data: unknown): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/** Load JSON file, return default if not found */
export function loadJson<T>(filePath: string, defaultValue: T): T {
  if (!existsSync(filePath)) return defaultValue
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

/** Measure execution time of an async function */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start
  console.log(`[${label}] ${(duration / 1000).toFixed(1)}s`)
  return { result, duration }
}
