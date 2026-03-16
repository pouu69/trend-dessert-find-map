import { CookingPot, Cookie } from '@phosphor-icons/react'

const iconMap = {
  butter: CookingPot,
  cookie: Cookie,
} as const

interface ProductIconProps {
  name: 'butter' | 'cookie'
  size?: number
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
}

export function ProductIcon({ name, size = 24, weight = 'duotone', className }: ProductIconProps) {
  const Icon = iconMap[name]
  return <Icon size={size} weight={weight} className={className} />
}
