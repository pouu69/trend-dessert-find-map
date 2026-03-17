import shopsData from '@/data/shops.json'
import dujjonkuData from '@/data/dujjonku.json'
import type { Shop } from '@/types/shop'

const dataMap: Record<string, Shop[]> = {
  'shanghai-butter-rice': shopsData as Shop[],
  'dujjonku': dujjonkuData as Shop[],
}

export function getShopsByProduct(productSlug: string): Shop[] {
  return dataMap[productSlug] ?? []
}
