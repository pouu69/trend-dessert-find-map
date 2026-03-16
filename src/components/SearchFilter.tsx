import { useEffect, useState } from 'react'

interface SearchFilterProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  regions: string[]
  selectedRegion: string | null
  onRegionChange: (region: string | null) => void
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  regions,
  selectedRegion,
  onRegionChange,
}: SearchFilterProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
        <input
          type="text"
          value={localQuery}
          onChange={e => setLocalQuery(e.target.value)}
          placeholder="가게명, 주소 검색..."
          className="w-full bg-[#F5F5F5] rounded-xl py-2 pl-9 pr-3 text-sm text-[#1a1a1a] placeholder-[#999] outline-none focus:ring-2 focus:ring-[#FF9500]/30"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onRegionChange(null)}
          className={`px-3 py-1 rounded-2xl text-xs font-semibold transition-colors ${
            selectedRegion === null
              ? 'bg-[#FF9500] text-white'
              : 'bg-[#F5F5F5] text-[#666] hover:bg-[#eee]'
          }`}
        >
          전체
        </button>
        {regions.map(region => (
          <button
            key={region}
            onClick={() => onRegionChange(region === selectedRegion ? null : region)}
            className={`px-3 py-1 rounded-2xl text-xs font-semibold transition-colors ${
              selectedRegion === region
                ? 'bg-[#FF9500] text-white'
                : 'bg-[#F5F5F5] text-[#666] hover:bg-[#eee]'
            }`}
          >
            {region}
          </button>
        ))}
      </div>
    </div>
  )
}
