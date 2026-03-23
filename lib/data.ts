import shopsData from '@/data/shops.json'
import dujjonkuData from '@/data/dujjonku.json'
import type { Shop } from '@/types/shop'

const dataMap: Record<string, Shop[]> = {
  'butter-tteok': shopsData as Shop[],
  'dujjonku': dujjonkuData as Shop[],
}

export function getShopsByProduct(productSlug: string): Shop[] {
  return dataMap[productSlug] ?? []
}
