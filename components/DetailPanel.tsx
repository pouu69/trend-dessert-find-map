'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Heart, Phone, NavigationArrow, ShareNetwork, Clock, CalendarX, Tag, ArrowSquareOut, Check, MapPin } from '@phosphor-icons/react'
import type { Shop } from '@/types/shop'

interface DetailPanelProps {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
  isMobile: boolean
}

const NAVER_MAP_BASE_URL = "https://map.naver.com/p/search";

function naverMapUrl(query: string): string {
  const params = new URLSearchParams({
    c: "15.00,0,0,0,dh",
    placePath: "/home",
    bk_query: query,
    searchText: query,
    locale: "ko",
    entry: "bmp",
  });

  return `${NAVER_MAP_BASE_URL}/${encodeURIComponent(query)}?${params.toString()}`;
}

// --- Bottom sheet snap points ---
const SNAP_PEEK = 0.55
const SNAP_FULL = 0.90
const SNAPS = [SNAP_PEEK, SNAP_FULL]
const VELOCITY_CLOSE_THRESHOLD = 0.4 // px/ms — fast swipe down = close

function closestSnap(ratio: number): number {
  let best = SNAPS[0]
  let bestDist = Math.abs(ratio - best)
  for (const s of SNAPS) {
    const d = Math.abs(ratio - s)
    if (d < bestDist) { best = s; bestDist = d }
  }
  return best
}

export function DetailPanel({ shop, isFavorite, onToggleFavorite, onClose, isMobile }: DetailPanelProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  // --- Mobile bottom sheet state ---
  const [sheetHeight, setSheetHeight] = useState(SNAP_PEEK)
  const [viewportHeight, setViewportHeight] = useState(800)
  const [mounted, setMounted] = useState(false)
  const dragRef = useRef({ dragging: false, startY: 0, startHeight: 0, startTime: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMobile) return
    setViewportHeight(window.innerHeight)
    setMounted(true)
    const handleResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobile])

  const handleDragStart = useCallback((clientY: number) => {
    dragRef.current = { dragging: true, startY: clientY, startHeight: sheetHeight, startTime: Date.now() }
  }, [sheetHeight])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragRef.current.dragging) return
    const deltaY = dragRef.current.startY - clientY
    const deltaRatio = deltaY / viewportHeight
    const newHeight = Math.max(0.1, Math.min(SNAP_FULL, dragRef.current.startHeight + deltaRatio))
    setSheetHeight(newHeight)
  }, [viewportHeight])

  const handleDragEnd = useCallback((clientY: number) => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false

    const elapsed = Date.now() - dragRef.current.startTime
    const distancePx = clientY - dragRef.current.startY
    const velocity = distancePx / Math.max(elapsed, 1) // px/ms, positive = downward

    // Fast downward swipe → close
    if (velocity > VELOCITY_CLOSE_THRESHOLD) {
      onClose()
      return
    }

    setSheetHeight(prev => {
      // If dragged below minimum, close
      if (prev < SNAP_PEEK * 0.5) {
        setTimeout(() => onClose(), 0)
        return prev
      }
      return closestSnap(prev)
    })
  }, [onClose])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }, [handleDragMove])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientY)
  }, [handleDragEnd])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }, [handleDragStart])

  useEffect(() => {
    if (!dragRef.current.dragging) return
    function onMove(e: MouseEvent) { handleDragMove(e.clientY) }
    function onUp(e: MouseEvent) { handleDragEnd(e.clientY) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  })

  // --- MOBILE LAYOUT: draggable bottom sheet ---
  if (isMobile) {
    const heightPx = Math.round(sheetHeight * viewportHeight)
    const isDragging = dragRef.current.dragging

    return (
      <>
        {/* Dim backdrop — tap to close */}
        <div
          className="fixed inset-0 z-[1000] pointer-events-auto"
          style={{
            background: `rgba(0,0,0,${Math.min(sheetHeight * 0.25, 0.18)})`,
            transition: isDragging ? 'none' : 'background 0.3s ease',
          }}
          onClick={onClose}
        />

        {/* Bottom sheet */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[1001] pointer-events-auto glass rounded-t-2xl flex flex-col overflow-hidden"
          style={{
            height: mounted ? `${heightPx}px` : '0px',
            transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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

            {/* Top actions row inside handle for easy drag access */}
            <div className="flex items-center justify-between px-5 pt-1 pb-2">
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-panel-hover flex items-center justify-center hover:bg-line transition-colors active:scale-[0.95]">
                <X size={14} weight="bold" className="text-ink-secondary" />
              </button>
              <button onClick={() => onToggleFavorite(shop.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.96] ${
                  isFavorite
                    ? 'bg-danger text-white shadow-[0_2px_8px_rgba(220,38,38,0.2)]'
                    : 'bg-panel-hover text-ink-secondary hover:bg-line'
                }`}>
                <Heart size={13} weight={isFavorite ? 'fill' : 'regular'} />
                {isFavorite ? '저장됨' : '즐겨찾기'}
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ overflowY: 'auto' }}
          >
            {/* Hero header */}
            <div className="relative px-5 pt-1 pb-4 bg-gradient-to-b from-brand/[0.06] to-transparent">
              {/* Shop name */}
              <h2 className="font-heading text-[24px] font-extrabold text-ink leading-[1.1] tracking-[-0.03em]">
                {shop.name}
              </h2>

              {/* Address */}
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={13} weight="bold" className="text-brand flex-shrink-0" />
                <p className="text-[13px] text-ink-secondary">{shop.address}</p>
              </div>

              {/* Tags */}
              {shop.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {shop.tags.map(tag => (
                    <span key={tag} className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-full">{tag}</span>
                  ))}
                  <span className="text-[11px] font-medium text-ink-caption bg-bg-search px-2.5 py-1 rounded-full">{shop.region}</span>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex border-y border-line">
              {shop.phone && (
                <a href={`tel:${shop.phone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary active:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
                  <Phone size={15} weight="duotone" className="text-brand" />
                  전화
                </a>
              )}
              <a href={naverMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary active:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
                <NavigationArrow size={15} weight="duotone" className="text-brand" />
                길찾기
              </a>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.origin + window.location.pathname + `#${shop.id}`).then(() => setCopied(true))
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary active:bg-panel-hover active:scale-[0.97] transition-all">
                {copied ? <Check size={15} weight="bold" className="text-emerald-500" /> : <ShareNetwork size={15} weight="duotone" className="text-brand" />}
                <span className={copied ? 'text-emerald-500' : ''}>{copied ? '복사됨' : '공유'}</span>
              </button>
            </div>

            {/* Info rows */}
            {(shop.phone || shop.hours || shop.closedDays.length > 0 || shop.priceRange) && (
              <div className="px-5 py-4 space-y-3">
                {shop.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                      <Phone size={14} weight="bold" className="text-ink-caption" />
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">전화</p>
                      <a href={`tel:${shop.phone}`} className="text-[14px] text-link font-semibold hover:underline">{shop.phone}</a>
                    </div>
                  </div>
                )}
                {shop.hours && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                      <Clock size={14} weight="bold" className="text-ink-caption" />
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">영업시간</p>
                      <p className="text-[14px] text-ink font-medium">{shop.hours}</p>
                    </div>
                  </div>
                )}
                {shop.closedDays.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                      <CalendarX size={14} weight="bold" className="text-ink-caption" />
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">휴무일</p>
                      <p className="text-[14px] text-danger font-semibold">{shop.closedDays.join(', ')}</p>
                    </div>
                  </div>
                )}
                {shop.priceRange && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                      <Tag size={14} weight="bold" className="text-ink-caption" />
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">가격대</p>
                      <p className="text-[14px] text-brand font-bold">{shop.priceRange}원</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {shop.description && (
              <div className="px-5 pb-4">
                <div className="p-4 bg-bg-section rounded-xl">
                  <p className="text-[13px] text-ink-secondary leading-[1.8]">{shop.description}</p>
                </div>
              </div>
            )}

            {/* Naver map link */}
            <div className="px-5 pt-2 pb-5">
              <a href={naverMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#03C75A] text-white text-[13px] font-semibold active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(3,199,90,0.3)]">
                네이버맵에서 보기
                <ArrowSquareOut size={13} weight="bold" />
              </a>
            </div>

            {/* Safe area bottom padding */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      </>
    )
  }

  // --- DESKTOP LAYOUT (unchanged) ---
  return (
    <div className="absolute top-3 right-3 bottom-3 w-[360px] z-[1001] pointer-events-auto anim-detail">
      <div className="h-full glass rounded-2xl flex flex-col overflow-hidden">
        {/* Hero header */}
        <div className="relative px-5 pt-4 pb-5 bg-gradient-to-b from-brand/[0.06] to-transparent flex-shrink-0">
          {/* Top actions */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-panel-hover flex items-center justify-center hover:bg-line transition-colors active:scale-[0.95]">
              <X size={14} weight="bold" className="text-ink-secondary" />
            </button>
            <button onClick={() => onToggleFavorite(shop.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.96] ${
                isFavorite
                  ? 'bg-danger text-white shadow-[0_2px_8px_rgba(220,38,38,0.2)]'
                  : 'bg-panel-hover text-ink-secondary hover:bg-line'
              }`}>
              <Heart size={13} weight={isFavorite ? 'fill' : 'regular'} />
              {isFavorite ? '저장됨' : '즐겨찾기'}
            </button>
          </div>

          {/* Shop name -- large, editorial */}
          <h2 className="font-heading text-[28px] font-extrabold text-ink leading-[1.1] tracking-[-0.03em]">
            {shop.name}
          </h2>

          {/* Address with icon */}
          <div className="flex items-center gap-1.5 mt-2">
            <MapPin size={13} weight="bold" className="text-brand flex-shrink-0" />
            <p className="text-[13px] text-ink-secondary">{shop.address}</p>
          </div>

          {/* Tags as horizontal pills */}
          {shop.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {shop.tags.map(tag => (
                <span key={tag} className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-full">{tag}</span>
              ))}
              <span className="text-[11px] font-medium text-ink-caption bg-bg-search px-2.5 py-1 rounded-full">{shop.region}</span>
            </div>
          )}
        </div>

        {/* Quick actions -- full-width row */}
        <div className="flex border-y border-line flex-shrink-0">
          {shop.phone && (
            <a href={`tel:${shop.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-ink-secondary hover:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
              <Phone size={15} weight="duotone" className="text-brand" />
              전화
            </a>
          )}
          <a href={naverMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-ink-secondary hover:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
            <NavigationArrow size={15} weight="duotone" className="text-brand" />
            길찾기
          </a>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.origin + window.location.pathname + `#${shop.id}`).then(() => setCopied(true))
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-ink-secondary hover:bg-panel-hover active:scale-[0.97] transition-all">
            {copied ? <Check size={15} weight="bold" className="text-emerald-500" /> : <ShareNetwork size={15} weight="duotone" className="text-brand" />}
            <span className={copied ? 'text-emerald-500' : ''}>{copied ? '복사됨' : '공유'}</span>
          </button>
        </div>

        {/* Scrollable info */}
        <div className="flex-1 overflow-y-auto">
          {/* Info chips -- horizontal layout */}
          {(shop.phone || shop.hours || shop.closedDays.length > 0 || shop.priceRange) && (
            <div className="px-5 py-4 space-y-3">
              {shop.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                    <Phone size={14} weight="bold" className="text-ink-caption" />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">전화</p>
                    <a href={`tel:${shop.phone}`} className="text-[14px] text-link font-semibold hover:underline">{shop.phone}</a>
                  </div>
                </div>
              )}
              {shop.hours && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                    <Clock size={14} weight="bold" className="text-ink-caption" />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">영업시간</p>
                    <p className="text-[14px] text-ink font-medium">{shop.hours}</p>
                  </div>
                </div>
              )}
              {shop.closedDays.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                    <CalendarX size={14} weight="bold" className="text-ink-caption" />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">휴무일</p>
                    <p className="text-[14px] text-danger font-semibold">{shop.closedDays.join(', ')}</p>
                  </div>
                </div>
              )}
              {shop.priceRange && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
                    <Tag size={14} weight="bold" className="text-ink-caption" />
                  </div>
                  <div>
                    <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">가격대</p>
                    <p className="text-[14px] text-brand font-bold">{shop.priceRange}원</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {shop.description && (
            <div className="px-5 pb-4">
              <div className="p-4 bg-bg-section rounded-xl">
                <p className="text-[13px] text-ink-secondary leading-[1.8]">{shop.description}</p>
              </div>
            </div>
          )}

          {/* Naver map link */}
          <div className="px-5 pb-5">
            <a href={naverMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#03C75A] text-white text-[13px] font-semibold hover:bg-[#02b350] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(3,199,90,0.3)]">
              네이버맵에서 보기
              <ArrowSquareOut size={13} weight="bold" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
