import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, MapPin, X } from '@phosphor-icons/react'
import type { Shop } from '../types/shop'

type SuggestionItem =
  | { type: 'keyword'; label: string }
  | { type: 'shop'; shop: Shop }

interface SearchFilterProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  regions: string[]
  selectedRegion: string | null
  onRegionChange: (region: string | null) => void
  shops: Shop[]
  onShopClick: (shop: Shop) => void
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  regions,
  selectedRegion,
  onRegionChange,
  shops,
  onShopClick,
}: SearchFilterProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localQuery), 300)
    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const allKeywords = useMemo(() => {
    const set = new Set<string>()
    shops.forEach(s => {
      s.tags.forEach(t => set.add(t))
      if (s.region) set.add(s.region)
    })
    return [...set]
  }, [shops])

  const q = localQuery.trim().toLowerCase()

  const suggestions: SuggestionItem[] = useMemo(() => {
    if (q.length < 1) return []
    const items: SuggestionItem[] = []
    const matchedKeywords = allKeywords
      .filter(k => k.toLowerCase().includes(q) && k.toLowerCase() !== q)
      .slice(0, 3)
    matchedKeywords.forEach(k => items.push({ type: 'keyword', label: k }))
    const matchedShops = shops
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 5)
    matchedShops.forEach(s => items.push({ type: 'shop', shop: s }))
    return items.slice(0, 7)
  }, [q, allKeywords, shops])

  const showSuggestions = isFocused && suggestions.length > 0

  useEffect(() => {
    setActiveIdx(-1)
  }, [localQuery])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = activeIdx >= 0 ? suggestions[activeIdx] : null
      if (item) {
        if (item.type === 'keyword') {
          setLocalQuery(item.label)
          onSearchChange(item.label)
        } else {
          setLocalQuery(item.shop.name)
          onSearchChange(item.shop.name)
        }
      } else {
        onSearchChange(localQuery)
      }
      setActiveIdx(-1)
      setIsFocused(false)
    } else if (e.key === 'Escape') {
      setIsFocused(false)
    }
  }

  function handleSuggestionClick(item: SuggestionItem) {
    if (item.type === 'keyword') {
      setLocalQuery(item.label)
      onSearchChange(item.label)
      setIsFocused(false)
    } else {
      setIsFocused(false)
      onShopClick(item.shop)
    }
  }

  return (
    <div className="px-4 py-2 border-b border-line flex-shrink-0 space-y-2">
      {/* Search */}
      <div ref={wrapperRef} className="relative">
        <MagnifyingGlass
          size={15}
          weight="bold"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-ink-caption"
        />
        <input
          type="text"
          value={localQuery}
          onChange={e => { setLocalQuery(e.target.value); setIsFocused(true) }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="가게명, 주소, 태그 검색"
          className="
            relative w-full h-10 bg-bg-search rounded-xl
            pl-10 pr-10
            text-[13px] font-medium text-ink placeholder-ink-caption
            outline-none border border-transparent
            focus:border-brand/30 focus:bg-[#292524]
            transition-colors duration-150
          "
        />
        {localQuery && (
          <button
            onClick={() => { setLocalQuery(''); setIsFocused(false) }}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={10} weight="bold" className="text-ink-caption" />
          </button>
        )}

        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-[#292524] rounded-xl border border-white/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.4)] overflow-hidden z-20">
            {suggestions.map((item, idx) => (
              <button
                key={item.type === 'keyword' ? `kw-${item.label}` : item.shop.id}
                className={`
                  w-full text-left px-4 py-2 transition-colors flex items-center gap-3
                  ${idx === activeIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}
                `}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => handleSuggestionClick(item)}
              >
                {item.type === 'keyword' ? (
                  <>
                    <MagnifyingGlass size={14} weight="bold" className="text-ink-caption flex-shrink-0" />
                    <span className="text-[13px] font-semibold text-ink">{item.label}</span>
                  </>
                ) : (
                  <>
                    <MapPin size={14} weight="bold" className="text-ink-caption flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink truncate">{item.shop.name}</p>
                      <p className="text-[11px] text-ink-caption truncate">{item.shop.address}</p>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Region chips */}
      <div className="flex gap-1.5 flex-wrap">
        <Chip label="전체" active={selectedRegion === null} onClick={() => onRegionChange(null)} />
        {regions.map(region => (
          <Chip
            key={region}
            label={region}
            active={selectedRegion === region}
            onClick={() => onRegionChange(region === selectedRegion ? null : region)}
          />
        ))}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        h-8 px-3 rounded-lg
        text-[12px] font-semibold
        transition-all duration-150
        active:scale-[0.96]
        ${active
          ? 'bg-bg-chip-active text-ink-on-dark'
          : 'bg-bg-chip text-ink-caption hover:text-ink-secondary hover:bg-white/[0.08]'
        }
      `}
    >
      {label}
    </button>
  )
}
