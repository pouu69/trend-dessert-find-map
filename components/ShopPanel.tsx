'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Heart, MapPin, MagnifyingGlass, List, X } from '@phosphor-icons/react'
import { useBottomSheet } from '@/hooks/useBottomSheet'
import type { Shop } from '@/types/shop'

interface ShopPanelProps {
  shops: Shop[]
  highlightedShopId: string | null
  scrollToShopId: string | null
  onScrollComplete: () => void
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  onShopClick: (shop: Shop) => void
  onShopHover: (shop: Shop) => void
  onShopLeave: () => void
  isMobile: boolean
  expanded: boolean
  onToggleExpand: () => void
  hasSelectedShop: boolean
}

const SNAP_CLOSED = 0
const SNAP_PEEK = 0.35
const SNAP_HALF = 0.55
const SNAP_FULL = 0.85
const SHOP_PANEL_SNAPS = [SNAP_CLOSED, SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const

// --- Shared sub-components ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <MagnifyingGlass size={28} weight="duotone" className="text-ink-caption mb-3" />
      <p className="text-[13px] text-ink-secondary font-medium text-center">검색 결과가 없습니다</p>
      <p className="text-[11px] text-ink-caption mt-1 text-center">다른 키워드로 검색하거나 지도를 이동해 보세요</p>
    </div>
  )
}

function ShopCard({ shop, active, isFavorite, onToggleFavorite, onClick, onMouseEnter, onMouseLeave, variant, style }: {
  shop: Shop
  active: boolean
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClick: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  variant: 'mobile' | 'desktop'
  style?: React.CSSProperties
}) {
  const isMobile = variant === 'mobile'
  const cardPadding = isMobile ? 'mx-2 my-0.5 px-3 py-2.5' : 'mx-1.5 my-0.5 px-3 py-2'
  const nameSize = isMobile ? 'text-[14px]' : 'text-[13px]'
  const addressSize = isMobile ? 'text-[12px]' : 'text-[11px]'
  const heartSize = isMobile ? 15 : 13
  const animClass = isMobile ? '' : 'anim-card'

  return (
    <div
      className={`
        ${animClass} ${cardPadding} rounded-xl
        cursor-pointer select-none transition-all duration-200
        active:scale-[0.98]
        ${active ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]' : 'hover:bg-panel-hover'}
      `}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={`${nameSize} font-bold text-ink leading-snug truncate`}>{shop.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={10} weight="bold" className="text-ink-caption flex-shrink-0" />
            <p className={`${addressSize} text-ink-caption truncate`}>{shop.address.split(' ').slice(0, 3).join(' ')}</p>
          </div>
          {(shop.tags.length > 0 || shop.priceRange) && (
            <div className="flex items-center gap-1 mt-1.5">
              {shop.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] font-medium text-tag-text bg-tag-bg px-1.5 py-0.5 rounded">{tag}</span>
              ))}
              {shop.priceRange && (
                <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">{shop.priceRange}원</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(shop.id) }}
          className={`flex-shrink-0 mt-0.5 ${isMobile ? 'p-1' : ''} active:scale-[0.85] transition-all ${isFavorite ? 'text-danger' : `text-line-bold ${isMobile ? '' : 'hover:text-ink-caption'}`}`}
        >
          <Heart size={heartSize} weight={isFavorite ? 'fill' : 'regular'} />
        </button>
      </div>
    </div>
  )
}

// --- Main component ---

export function ShopPanel({
  shops, highlightedShopId, scrollToShopId, onScrollComplete,
  isFavorite, onToggleFavorite,
  onShopClick, onShopHover, onShopLeave,
  isMobile, expanded, onToggleExpand, hasSelectedShop,
}: ShopPanelProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  const bottomSheet = useBottomSheet({
    snapPoints: SHOP_PANEL_SNAPS,
    initialSnap: SNAP_CLOSED,
  })

  // Sync expanded prop with sheet height
  useEffect(() => {
    if (isMobile) {
      bottomSheet.setSheetHeight(expanded ? SNAP_PEEK : SNAP_CLOSED)
    }
  }, [expanded, isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollToShopId) {
      const el = cardRefs.current.get(scrollToShopId)
      const container = listRef.current
      if (el && container) {
        const elTop = el.offsetTop - container.offsetTop
        const target = elTop - container.clientHeight / 2 + el.clientHeight / 2
        container.scrollTo({ top: target, behavior: 'smooth' })
      }
      onScrollComplete()
    }
  }, [scrollToShopId, onScrollComplete])

  if (isMobile && hasSelectedShop) return null

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    const isVisible = bottomSheet.sheetHeight > 0.02

    return (
      <>
        {!isVisible && (
          <button
            onClick={() => { onToggleExpand(); bottomSheet.setSheetHeight(SNAP_PEEK) }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[999] pointer-events-auto glass rounded-full px-5 py-3 flex items-center gap-2.5 active:scale-[0.97] transition-transform shadow-lg"
          >
            <List size={16} weight="bold" className="text-brand" />
            <span className="text-[13px] font-bold text-ink">{shops.length}개 가게</span>
          </button>
        )}

        {isVisible && (
          <div
            className="fixed bottom-0 left-0 right-0 z-[999] pointer-events-auto glass rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              height: `${bottomSheet.heightPx}px`,
              transition: bottomSheet.isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              borderBottom: 'none',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none touch-none" {...bottomSheet.dragHandleProps}>
              <div className="bottom-sheet-handle" />
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-[12px] font-bold text-ink-caption">{shops.length}개 가게</span>
                <button
                  onClick={(e) => { e.stopPropagation(); bottomSheet.setSheetHeight(SNAP_CLOSED); onToggleExpand() }}
                  className="w-7 h-7 rounded-full bg-panel-hover flex items-center justify-center active:scale-[0.9] transition-transform"
                >
                  <X size={12} weight="bold" className="text-ink-caption" />
                </button>
              </div>
            </div>

            {shops.length === 0 ? (
              <EmptyState />
            ) : (
              <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {shops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    active={highlightedShopId === shop.id}
                    isFavorite={isFavorite(shop.id)}
                    onToggleFavorite={onToggleFavorite}
                    onClick={() => onShopClick(shop)}
                    variant="mobile"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  // --- DESKTOP LAYOUT ---
  if (shops.length === 0) {
    return (
      <div className="absolute top-[108px] left-3 bottom-3 w-[280px] z-[999] pointer-events-auto">
        <div className="h-full glass rounded-2xl flex flex-col items-center justify-center px-6">
          <EmptyState />
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-[108px] left-3 bottom-3 w-[280px] z-[999] pointer-events-auto anim-panel">
      <div className="h-full glass rounded-2xl overflow-hidden flex flex-col">
        <div className="px-3.5 py-2 border-b border-line flex-shrink-0">
          <span className="text-[11px] font-semibold text-ink-caption">{shops.length}개 가게</span>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto py-0.5">
          {shops.map((shop, index) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              active={highlightedShopId === shop.id}
              isFavorite={isFavorite(shop.id)}
              onToggleFavorite={onToggleFavorite}
              onClick={() => onShopClick(shop)}
              onMouseEnter={() => onShopHover(shop)}
              onMouseLeave={onShopLeave}
              variant="desktop"
              style={{ animationDelay: `${index * 18}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
