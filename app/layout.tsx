import { Navbar } from '@/components/navbar'
import { SupabaseProvider } from '@/components/supabase-provider'
import { ToastProvider } from '@/components/toast-provider'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import './globals.css'

const inter = Inter({ subsets: ["latin"] })

/** Prefer NEXT_PUBLIC_SITE_URL; in Vercel Production default to the custom domain for metadataBase. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_ENV === 'production' ? 'https://starmap.lol' : undefined)

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: 'Starmap — map your relationships',
    template: '%s · Starmap',
  },
  description:
    'Build a visual graph of people and how they connect. Share your public Starmap profile with a unique profile link.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Starmap',
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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t? t==='dark' : window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var c=document.documentElement.classList; if(d) c.add('dark'); else c.remove('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.className} flex min-h-dvh flex-col bg-background text-foreground`}
      >
        <SupabaseProvider>
          <ToastProvider>
            <Navbar />
            <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          </ToastProvider>
        </SupabaseProvider>
        <Analytics />
      </body>
    </html>
  )
}
