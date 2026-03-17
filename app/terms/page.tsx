import type { Metadata } from 'next'
import { Terms } from '@/components/Terms'

export const metadata: Metadata = {
  title: '이용약관 — 요즘 뭐가 맛있어?',
  description: '요즘 뭐가 맛있어? 서비스의 이용약관입니다.',
}

export default function TermsPage() {
  return <Terms />
}
