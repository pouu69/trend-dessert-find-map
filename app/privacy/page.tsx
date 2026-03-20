import type { Metadata } from 'next'
import { PrivacyPolicy } from '@/components/PrivacyPolicy'

export const metadata: Metadata = {
  title: '개인정보처리방침 — 요즘 뭐가 맛있어?',
  description: '요즘 뭐가 맛있어? 서비스의 개인정보처리방침입니다.',
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyPage() {
  return <PrivacyPolicy />
}
