import './globals.css'

export const metadata = {
  title: 'Night Owls - Find 24/7 Places Near You',
  description: 'The ultimate app for night owls! Find restaurants, gas stations, pharmacies, and more that are open 24/7 near your location.',
  keywords: 'night owls, 24/7, open late, restaurants, gas stations, pharmacies, night shift, insomnia',
  authors: [{ name: 'Night Owls Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  themeColor: '#8b5cf6',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Night Owls'
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  openGraph: {
    title: 'Night Owls - Find 24/7 Places Near You',
    description: 'The ultimate app for night owls! Find open businesses near you.',
    url: 'https://nightowls.app',
    siteName: 'Night Owls',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Night Owls App'
    }],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Night Owls - Find 24/7 Places Near You',
    description: 'The ultimate app for night owls! Find open businesses near you.',
    images: ['/og-image.png']
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  )
}
