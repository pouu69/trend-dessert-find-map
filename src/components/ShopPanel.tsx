import { useEffect, useRef, useCallback, useState } from 'react'
import { Heart, MapPin, MagnifyingGlass, List, X } from '@phosphor-icons/react'
import type { Shop } from '../types/shop'

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

const SNAP_CLOSED = 0    // collapsed — just the pill
const SNAP_PEEK = 0.35   // 35% of viewport
const SNAP_HALF = 0.55   // 55% of viewport
const SNAP_FULL = 0.85   // 85% of viewport
const SNAPS = [SNAP_CLOSED, SNAP_PEEK, SNAP_HALF, SNAP_FULL]

function closestSnap(ratio: number): number {
  let best = SNAPS[0]
  let bestDist = Math.abs(ratio - best)
  for (const s of SNAPS) {
    const d = Math.abs(ratio - s)
    if (d < bestDist) { best = s; bestDist = d }
  }
  return best
}

export function ShopPanel({
  shops, highlightedShopId, scrollToShopId, onScrollComplete,
  isFavorite, onToggleFavorite,
  onShopClick, onShopHover, onShopLeave,
  isMobile, expanded, onToggleExpand, hasSelectedShop,
}: ShopPanelProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)
  const [sheetHeight, setSheetHeight] = useState(SNAP_CLOSED) // ratio of viewport
  const dragRef = useRef({ dragging: false, startY: 0, startHeight: 0 })
  const sheetRef = useRef<HTMLDivElement>(null)

  // Sync expanded prop with sheet height
  useEffect(() => {
    if (isMobile) {
      setSheetHeight(expanded ? SNAP_PEEK : SNAP_CLOSED)
    }
  }, [expanded, isMobile])

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

  // Drag handlers for bottom sheet
  const handleDragStart = useCallback((clientY: number) => {
    dragRef.current = { dragging: true, startY: clientY, startHeight: sheetHeight }
  }, [sheetHeight])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragRef.current.dragging) return
    const vh = window.innerHeight
    const deltaY = dragRef.current.startY - clientY // positive = dragging up
    const deltaRatio = deltaY / vh
    const newHeight = Math.max(0, Math.min(SNAP_FULL, dragRef.current.startHeight + deltaRatio))
    setSheetHeight(newHeight)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    setSheetHeight(prev => {
      const snapped = closestSnap(prev)
      // If snapped to closed, also update the expanded state
      if (snapped === SNAP_CLOSED && expanded) {
        // Defer to avoid state update during render
        setTimeout(() => onToggleExpand(), 0)
      }
      return snapped
    })
  }, [expanded, onToggleExpand])

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }, [handleDragMove])

  const onTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Mouse events (for desktop testing of mobile layout)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }, [handleDragStart])

  useEffect(() => {
    if (!dragRef.current.dragging) return

    function onMove(e: MouseEvent) { handleDragMove(e.clientY) }
    function onUp() { handleDragEnd() }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleDragMove, handleDragEnd])

  // Mobile: hide entirely when a detail panel is open
  if (isMobile && hasSelectedShop) return null

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    const isVisible = sheetHeight > 0.02
    const heightPx = Math.round(sheetHeight * window.innerHeight)

    return (
      <>
        {/* Collapsed: floating pill at bottom */}
        {!isVisible && (
          <button
            onClick={() => { onToggleExpand(); setSheetHeight(SNAP_PEEK) }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[999] pointer-events-auto
              glass rounded-full px-5 py-3 flex items-center gap-2.5
              active:scale-[0.97] transition-transform shadow-lg"
          >
            <List size={16} weight="bold" className="text-brand" />
            <span className="text-[13px] font-bold text-ink">{shops.length}개 가게</span>
          </button>
        )}

        {/* Bottom sheet */}
        {isVisible && (
          <div
            ref={sheetRef}
            className="fixed bottom-0 left-0 right-0 z-[999] pointer-events-auto glass rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              height: `${heightPx}px`,
              transition: dragRef.current.dragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              borderBottom: 'none',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            {/* Drag handle area */}
            <div
              className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onMouseDown}
            >
              <div className="bottom-sheet-handle" />
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-[12px] font-bold text-ink-caption">{shops.length}개 가게</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setSheetHeight(SNAP_CLOSED); onToggleExpand() }}
                  className="w-7 h-7 rounded-full bg-panel-hover flex items-center justify-center active:scale-[0.9] transition-transform"
                >
                  <X size={12} weight="bold" className="text-ink-caption" />
                </button>
              </div>
            </div>

            {/* Shop list */}
            {shops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <MagnifyingGlass size={28} weight="duotone" className="text-ink-caption mb-3" />
                <p className="text-[13px] text-ink-secondary font-medium text-center">검색 결과가 없습니다</p>
                <p className="text-[11px] text-ink-caption mt-1 text-center">다른 키워드로 검색하거나 지도를 이동해 보세요</p>
              </div>
            ) : (
              <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {shops.map((shop, index) => {
                  const active = highlightedShopId === shop.id
                  return (
                    <div
                      key={shop.id}
                      ref={el => { if (el) cardRefs.current.set(shop.id, el); else cardRefs.current.delete(shop.id) }}
                      className={`
                        mx-2 my-0.5 px-3 py-2.5 rounded-xl
                        cursor-pointer select-none transition-all duration-200
                        active:scale-[0.98]
                        ${active
                          ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]'
                          : 'hover:bg-panel-hover'
                        }
                      `}
                      onClick={() => onShopClick(shop)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-bold text-ink leading-snug truncate">{shop.name}</h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin size={10} weight="bold" className="text-ink-caption flex-shrink-0" />
                            <p className="text-[12px] text-ink-caption truncate">{shop.address.split(' ').slice(0, 3).join(' ')}</p>
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
                          className={`flex-shrink-0 mt-0.5 p-1 active:scale-[0.85] transition-all ${isFavorite(shop.id) ? 'text-danger' : 'text-line-bold'}`}
                        >
                          <Heart size={15} weight={isFavorite(shop.id) ? 'fill' : 'regular'} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  // --- DESKTOP LAYOUT (unchanged) ---
  if (shops.length === 0) {
    return (
      <div className="absolute top-[108px] left-3 bottom-3 w-[280px] z-[999] pointer-events-auto">
        <div className="h-full glass rounded-2xl flex flex-col items-center justify-center px-6">
          <MagnifyingGlass size={28} weight="duotone" className="text-ink-caption mb-3" />
          <p className="text-[13px] text-ink-secondary font-medium text-center">검색 결과가 없습니다</p>
          <p className="text-[11px] text-ink-caption mt-1 text-center">다른 키워드로 검색하거나 지도를 이동해 보세요</p>
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
          {shops.map((shop, index) => {
            const active = highlightedShopId === shop.id
            return (
              <div
                key={shop.id}
                ref={el => { if (el) cardRefs.current.set(shop.id, el); else cardRefs.current.delete(shop.id) }}
                className={`
                  anim-card mx-1.5 my-0.5 px-3 py-2 rounded-xl
                  cursor-pointer select-none transition-all duration-200
                  active:scale-[0.99]
                  ${active
                    ? 'bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]'
                    : 'hover:bg-panel-hover'
                  }
                `}
                style={{ animationDelay: `${index * 18}ms` }}
                onClick={() => onShopClick(shop)}
                onMouseEnter={() => onShopHover(shop)}
                onMouseLeave={onShopLeave}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-bold text-ink leading-snug truncate">{shop.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={10} weight="bold" className="text-ink-caption flex-shrink-0" />
                      <p className="text-[11px] text-ink-caption truncate">{shop.address.split(' ').slice(0, 3).join(' ')}</p>
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
                    className={`flex-shrink-0 mt-0.5 active:scale-[0.85] transition-all ${isFavorite(shop.id) ? 'text-danger' : 'text-line-bold hover:text-ink-caption'}`}
                  >
                    <Heart size={13} weight={isFavorite(shop.id) ? 'fill' : 'regular'} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
