import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* خيارات الإعداد هنا */
  serverExternalPackages: ['@genkit-ai/google-genai', 'firebase-admin'],
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // السماح بنطاقات بيئة التطوير الخاصة بـ Firebase Studio لمنع أخطاء CORS وتسريع التحميل
    allowedDevOrigins: [
      '*.cloudworkstations.dev',
      'localhost:9002'
    ]
  },
  async headers() {
    return [
      {
        // السماح بتخزين الأيقونات والمانيفست لسرعة الفتح (PWA Optimization)
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        // تحسين رؤوس الحماية وتحسين سرعة الوصول للملفات البرمجية
        source: '/((?!icons|banners|banr|_next|static|favicon).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          }
        ],
      },
      {
        // تخزين الصور بشكل عدواني لزيادة السرعة
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'tse2.mm.bing.net', pathname: '/**' },
      { protocol: 'https', hostname: 'tse1.mm.bing.net', pathname: '/**' },
      { protocol: 'https', hostname: 'i.postimg.cc', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ibb.co', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
