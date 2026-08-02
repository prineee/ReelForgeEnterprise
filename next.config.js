/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native binary installer packages (dynamic, platform-resolved require()
  // calls that webpack's static bundler can't follow — see
  // services/gpu/backends/SyntheticTestPatternBackend.ts, now reachable
  // from app/api routes via MovieProductionFactory -> ProviderRegistry ->
  // LocalGPUProvider). Marking them external makes Next.js require() them
  // natively at runtime instead of bundling them, which is what these
  // packages already expect.
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', '@ffprobe-installer/ffprobe'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
      {
        protocol: 'https',
        hostname: '*.pixabay.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
  },
}

module.exports = nextConfig