/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  async headers() {
    if (isDev) {
      // Disable COEP/COOP in dev to avoid blocking third-party scripts like Razorpay
      return [];
    }
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  
  // Ensure compatibility with FFmpeg.wasm
  serverExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  
  // Configure API routes for large file processing
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  
  // Increase body size limit for large file uploads
  api: {
    bodyParser: {
      sizeLimit: '2gb', // Allow up to 2GB for chunked transcription
    },
    responseLimit: false, // No response size limit
  },
};

export default nextConfig;
