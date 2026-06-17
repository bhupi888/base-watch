import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Base Watch',
  description: 'Onchain wallet monitoring for Base App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-black text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
