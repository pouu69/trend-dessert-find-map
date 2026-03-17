'use client'

import { useEffect, useRef } from 'react'
import type { Shop } from '@/types/shop'
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-ink-caption mb-3">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-[13px] text-ink-secondary font-semibold">검색 결과가 없습니다</p>
        <p className="text-[12px] text-ink-caption mt-1">다른 키워드로 검색하거나 지도를 이동해 보세요</p>
      </div>
    )
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto py-1">
      {shops.map((shop, index) => (
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
            index={index}
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
