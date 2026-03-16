import { useEffect, useRef } from 'react'
import type { Shop } from '../types/shop'
import { ShopCard } from './ShopCard'

interface ShopListProps {
  shops: Shop[]
  highlightedShopId: string | null
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  onShopClick: (shop: Shop) => void
  onShopHover: (shop: Shop) => void
  onShopLeave: () => void
}

export function ShopList({
  shops,
  highlightedShopId,
  isFavorite,
  onToggleFavorite,
  onShopClick,
  onShopHover,
  onShopLeave,
}: ShopListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (highlightedShopId) {
      const el = cardRefs.current.get(highlightedShopId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [highlightedShopId])

  if (shops.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#999] p-4">
        검색 결과가 없습니다
      </div>
    )
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
      {shops.map(shop => (
        <div
          key={shop.id}
          ref={el => {
            if (el) cardRefs.current.set(shop.id, el)
            else cardRefs.current.delete(shop.id)
          }}
        >
          <ShopCard
            shop={shop}
            isHighlighted={highlightedShopId === shop.id}
            isFavorite={isFavorite(shop.id)}
            onToggleFavorite={onToggleFavorite}
            onClick={onShopClick}
            onMouseEnter={onShopHover}
            onMouseLeave={onShopLeave}
          />
        </div>
      ))}
    </div>
  )
}
