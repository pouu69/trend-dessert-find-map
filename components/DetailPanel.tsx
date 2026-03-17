'use client'

import { useState, useEffect } from 'react'
import { X, Heart, Phone, NavigationArrow, ShareNetwork, Clock, CalendarX, Tag, ArrowSquareOut, Check, MapPin } from '@phosphor-icons/react'
import type { Shop } from '@/types/shop'

interface DetailPanelProps {
  shop: Shop
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
  isMobile: boolean
}

function kakaoMapUrl(name: string) {
  return `https://map.kakao.com/?q=${encodeURIComponent(name)}`
}

export function DetailPanel({ shop, isFavorite, onToggleFavorite, onClose, isMobile }: DetailPanelProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  // --- MOBILE LAYOUT: full-screen overlay ---
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[1001] pointer-events-auto flex flex-col">
        {/* Top spacer for map peek -- tap to close */}
        <div className="flex-shrink-0 h-[80px]" onClick={onClose} />

        {/* Sheet */}
        <div className="anim-overlay-in flex-1 flex flex-col glass rounded-t-2xl overflow-hidden"
          style={{ borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          {/* Handle */}
          <div className="bottom-sheet-handle" />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Hero header */}
            <div className="relative px-5 pt-2 pb-4 bg-gradient-to-b from-brand/[0.06] to-transparent">
              {/* Top actions */}
              <div className="flex items-center justify-between mb-3">
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
              <a href={kakaoMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[12px] font-semibold text-ink-secondary active:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
                <NavigationArrow size={15} weight="duotone" className="text-brand" />
                길찾기
              </a>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.origin + `?shop=${shop.id}`).then(() => setCopied(true))
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

            {/* Kakao link */}
            <div className="px-5 pb-5">
              <a href={kakaoMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-ink text-ink-on-dark text-[13px] font-semibold active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                카카오맵에서 보기
                <ArrowSquareOut size={13} weight="bold" />
              </a>
            </div>

            {/* Safe area bottom padding */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      </div>
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
          <a href={kakaoMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-ink-secondary hover:bg-panel-hover active:scale-[0.97] transition-all border-r border-line">
            <NavigationArrow size={15} weight="duotone" className="text-brand" />
            길찾기
          </a>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.origin + `?shop=${shop.id}`).then(() => setCopied(true))
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

          {/* Kakao link */}
          <div className="px-5 pb-5">
            <a href={kakaoMapUrl(shop.name)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-ink text-ink-on-dark text-[13px] font-semibold hover:bg-ink/90 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              카카오맵에서 보기
              <ArrowSquareOut size={13} weight="bold" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
