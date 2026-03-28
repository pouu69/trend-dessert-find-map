'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Heart, Phone, NavigationArrow, ShareNetwork, Clock, CalendarX, Tag, ArrowSquareOut, Check, MapPin } from '@phosphor-icons/react'
import { useBottomSheet } from '@/hooks/useBottomSheet'
import type { Shop } from '@/types/shop'

interface DetailPanelProps {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
  isMobile: boolean
}

const NAVER_MAP_BASE_URL = 'https://map.naver.com/p/search'
const DETAIL_SNAPS = [0.55, 0.90] as const

function naverMapUrl(query: string): string {
  const params = new URLSearchParams({
    c: '15.00,0,0,0,dh',
    placePath: '/home',
    bk_query: query,
    searchText: query,
    locale: 'ko',
    entry: 'bmp',
  })
  return `${NAVER_MAP_BASE_URL}/${encodeURIComponent(query)}?${params.toString()}`
}

// --- Shared sub-components ---

function HeroHeader({ shop, size }: { shop: Shop; size: 'sm' | 'lg' }) {
  const titleClass = size === 'sm'
    ? 'text-[24px]'
    : 'text-[28px]'

  return (
    <div className={`relative px-5 ${size === 'sm' ? 'pt-1 pb-4' : 'pt-0 pb-5'} bg-gradient-to-b from-brand/[0.06] to-transparent`}>
      <h2 className={`font-heading ${titleClass} font-extrabold text-ink leading-[1.1] tracking-[-0.03em]`}>
        {shop.name}
      </h2>
      <div className="flex items-center gap-1.5 mt-2">
        <MapPin size={13} weight="bold" className="text-brand flex-shrink-0" />
        <p className="text-[13px] text-ink-secondary">{shop.address}</p>
      </div>
      {shop.tags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {shop.tags.map(tag => (
            <span key={tag} className="text-[11px] font-bold text-brand bg-brand-soft px-2.5 py-1 rounded-full">{tag}</span>
          ))}
          <span className="text-[11px] font-medium text-ink-caption bg-bg-search px-2.5 py-1 rounded-full">{shop.region}</span>
        </div>
      )}
    </div>
  )
}

function QuickActions({ shop, copied, onShare, variant }: {
  shop: Shop
  copied: boolean
  onShare: () => void
  variant: 'mobile' | 'desktop'
}) {
  const interactionClass = variant === 'mobile'
    ? 'active:bg-panel-hover active:scale-[0.97]'
    : 'hover:bg-panel-hover active:scale-[0.97]'

  return (
    <div className={`flex border-y border-line ${variant === 'desktop' ? 'flex-shrink-0' : ''}`}>
      {shop.phone && (
        <a href={`tel:${shop.phone}`}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary ${interactionClass} transition-all border-r border-line`}>
          <Phone size={15} weight="duotone" className="text-brand" />
          전화
        </a>
      )}
      <a href={naverMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
        className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary ${interactionClass} transition-all border-r border-line`}>
        <NavigationArrow size={15} weight="duotone" className="text-brand" />
        길찾기
      </a>
      <button onClick={onShare}
        className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary ${interactionClass} transition-all`}>
        {copied ? <Check size={15} weight="bold" className="text-emerald-500" /> : <ShareNetwork size={15} weight="duotone" className="text-brand" />}
        <span className={copied ? 'text-emerald-500' : ''}>{copied ? '복사됨' : '공유'}</span>
      </button>
    </div>
  )
}

function InfoRows({ shop }: { shop: Shop }) {
  if (!shop.phone && !shop.hours && shop.closedDays.length === 0 && !shop.priceRange) return null

  const rows = [
    shop.phone && { icon: Phone, label: '전화', content: <a href={`tel:${shop.phone}`} className="text-[14px] text-link font-semibold hover:underline">{shop.phone}</a> },
    shop.hours && { icon: Clock, label: '영업시간', content: <p className="text-[14px] text-ink font-medium">{shop.hours}</p> },
    shop.closedDays.length > 0 && { icon: CalendarX, label: '휴무일', content: <p className="text-[14px] text-danger font-semibold">{shop.closedDays.join(', ')}</p> },
    shop.priceRange && { icon: Tag, label: '가격대', content: <p className="text-[14px] text-brand font-bold">{shop.priceRange}원</p> },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; content: React.ReactNode }>

  return (
    <div className="px-5 py-4 space-y-3">
      {rows.map(({ icon: Icon, label, content }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-bg-section flex items-center justify-center flex-shrink-0">
            <Icon size={14} weight="bold" className="text-ink-caption" />
          </div>
          <div>
            <p className="text-[10px] text-ink-caption font-semibold uppercase tracking-wider">{label}</p>
            {content}
          </div>
        </div>
      ))}
    </div>
  )
}

function NaverMapLink({ shopName }: { shopName: string }) {
  return (
    <div className="px-5 pb-5">
      <a href={naverMapUrl(shopName)} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#03C75A] text-white text-[13px] font-semibold hover:bg-[#02b350] active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(3,199,90,0.3)]">
        네이버맵에서 보기
        <ArrowSquareOut size={13} weight="bold" />
      </a>
    </div>
  )
}

function ActionBar({ shop, isFavorite, onToggleFavorite, onClose }: {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between">
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
  )
}

// --- Main component ---

export function DetailPanel({ shop, isFavorite, onToggleFavorite, onClose, isMobile }: DetailPanelProps) {
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const bottomSheet = useBottomSheet({
    snapPoints: DETAIL_SNAPS,
    initialSnap: DETAIL_SNAPS[0],
    onClose,
  })

  const handleShare = () => {
    if (typeof window === 'undefined') return
    const url = window.location.origin + window.location.pathname + `#${shop.id}`
    navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {})
  }

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-[1000] pointer-events-auto"
          style={{
            background: `rgba(0,0,0,${Math.min(bottomSheet.sheetHeight * 0.25, 0.18)})`,
            transition: bottomSheet.isDragging ? 'none' : 'background 0.3s ease',
          }}
          onClick={onClose}
        />
        <div
          className="fixed bottom-0 left-0 right-0 z-[1001] pointer-events-auto glass rounded-t-2xl flex flex-col overflow-hidden"
          style={{
            height: bottomSheet.mounted ? `${bottomSheet.heightPx}px` : '0px',
            transition: bottomSheet.isDragging ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            borderBottom: 'none',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none touch-none" {...bottomSheet.dragHandleProps}>
            <div className="bottom-sheet-handle" />
            <div className="px-5 pt-1 pb-2">
              <ActionBar shop={shop} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} onClose={onClose} />
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            <HeroHeader shop={shop} size="sm" />
            <QuickActions shop={shop} copied={copied} onShare={handleShare} variant="mobile" />
            <InfoRows shop={shop} />
            {shop.description && (
              <div className="px-5 pb-4">
                <div className="p-4 bg-bg-section rounded-xl">
                  <p className="text-[13px] text-ink-secondary leading-[1.8]">{shop.description}</p>
                </div>
              </div>
            )}
            <NaverMapLink shopName={shop.name} />
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      </>
    )
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div className="absolute top-3 right-3 bottom-3 w-[360px] z-[1001] pointer-events-auto anim-detail">
      <div className="h-full glass rounded-2xl flex flex-col overflow-hidden">
        <div className="relative px-5 pt-4 flex-shrink-0">
          <div className="mb-4">
            <ActionBar shop={shop} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} onClose={onClose} />
          </div>
          <HeroHeader shop={shop} size="lg" />
        </div>
        <QuickActions shop={shop} copied={copied} onShare={handleShare} variant="desktop" />
        <div className="flex-1 overflow-y-auto">
          <InfoRows shop={shop} />
          {shop.description && (
            <div className="px-5 pb-4">
              <div className="p-4 bg-bg-section rounded-xl">
                <p className="text-[13px] text-ink-secondary leading-[1.8]">{shop.description}</p>
              </div>
            </div>
          )}
          <NaverMapLink shopName={shop.name} />
        </div>
      </div>
    </div>
  )
}
