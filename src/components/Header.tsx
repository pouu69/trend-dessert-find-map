interface HeaderProps {
  showFavoritesOnly: boolean
  onToggleFavorites: () => void
  favoriteCount: number
}

export function Header({ showFavoritesOnly, onToggleFavorites, favoriteCount }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#eee]">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#FF9500] rounded-lg flex items-center justify-center text-base">
          🧈
        </div>
        <span className="text-base font-bold text-[#1a1a1a]">버터떡 지도</span>
      </div>
      <button
        onClick={onToggleFavorites}
        className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
          showFavoritesOnly
            ? 'bg-[#FF9500] text-white'
            : 'text-[#999] hover:text-[#FF9500]'
        }`}
      >
        {showFavoritesOnly ? '♥' : '♡'} 즐겨찾기{favoriteCount > 0 ? ` (${favoriteCount})` : ''}
      </button>
    </header>
  )
}
