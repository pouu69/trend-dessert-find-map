export interface Product {
  slug: string
  name: string
  iconName: 'butter' | 'cookie'
  dataFile: string
}

export const products: Product[] = [
  {
    slug: 'shanghai-butter-rice',
    name: '상하이버터떡',
    iconName: 'butter',
    dataFile: 'shops',
  },
  {
    slug: 'dujjonku',
    name: '두쫀쿠',
    iconName: 'cookie',
    dataFile: 'dujjonku',
  },
]

export const defaultProduct = products[0]

export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug)
}
