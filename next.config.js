/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['fastly.4sqi.net', 'foursquare.com'],
  },
  env: {
    FOURSQUARE_API_KEY: process.env.FOURSQUARE_API_KEY,
  }
}

module.exports = nextConfig
