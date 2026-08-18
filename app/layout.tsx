import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'One Night — Werewolf Game Night',
  description: 'Create a private room, invite your friends, and uncover the werewolf.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#070a10',
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-[#070a10]"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
