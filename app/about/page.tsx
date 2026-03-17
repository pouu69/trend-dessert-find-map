import type { Metadata } from 'next'
import { About } from '@/components/About'

export const metadata: Metadata = {
  title: '서비스 소개 — 요즘 뭐가 맛있어?',
  description: '전국 트렌드 디저트 & 간식 맛집을 지도에서 한눈에 찾는 서비스입니다.',
}

export default function AboutPage() {
  return <About />
}
