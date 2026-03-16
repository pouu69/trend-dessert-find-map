export interface PipelineConfig {
  product: string
  searchPatterns: string[]
  cities: string[]
  blogPages: number
  maxPostsPerKeyword: number
  googleMapsDelayMs: number
  blogDelayMs: number
  outputPath: string
  dataDir: string
}

export interface RawShop {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  source: string // "naver-blog", "naver-place", etc.
  keyword: string // which keyword found this
  blogUrl: string
}

export interface EnrichedShop {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  rating: string
  reviewCount: string
  lat: number | null
  lng: number | null
  description: string
  source: string
}

export interface Shop {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  phone: string
  hours: string
  closedDays: string[]
  priceRange: string
  tags: string[]
  description: string
  region: string
}
