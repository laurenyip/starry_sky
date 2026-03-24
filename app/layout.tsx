import { Navbar } from '@/components/navbar'
import { SupabaseProvider } from '@/components/supabase-provider'
import { ToastProvider } from '@/components/toast-provider'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: 'FriendGraph — map your relationships',
    template: '%s · FriendGraph',
  },
  description:
    'Build a visual graph of people and how they connect. Share your public FriendGraph with a unique profile link.',
  openGraph: {
    title: 'FriendGraph',
    description:
      'Build a visual graph of people and how they connect.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <SupabaseProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          </ToastProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}
