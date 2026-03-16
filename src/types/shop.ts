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
