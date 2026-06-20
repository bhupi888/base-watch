import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Base Watch',
  description: 'Onchain wallet monitoring for Base App',
  other: {
    'talentapp:project_verification':
      '178dc73ee7f43eb1e8b59aa58113df9378d70556b52314bc07df8c1e5d0774bbfbc2eff940b618553cf3b48b4f1aa0083218427a51319c12e1187bf6a501195a',
  },
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
