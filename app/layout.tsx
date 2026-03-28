import { Navbar } from '@/components/navbar'
import { SupabaseProvider } from '@/components/supabase-provider'
import { ToastProvider } from '@/components/toast-provider'
import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import './globals.css'

const inter = Inter({ subsets: ["latin"] })

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
    <html lang="en" className="h-full antialiased">
      <head>
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
      </body>
    </html>
  )
}
