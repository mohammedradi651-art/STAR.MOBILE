import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* خيارات الإعداد هنا */
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ['@genkit-ai/google-genai', 'firebase-admin'],
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/aden', destination: '/bandar-aden', permanent: true },
      { source: '/alwadi/renew', destination: '/alwadi', permanent: true },
      { source: '/house-balance', destination: '/telecom-services', permanent: true },
      { source: '/landline-services', destination: '/internet-landline', permanent: true },
      { source: '/pay-balance', destination: '/telecom-services', permanent: true },
      { source: '/why-services', destination: '/why', permanent: true },
      { source: '/yemen-mobile-services', destination: '/yemen-mobile', permanent: true },
      { source: '/yemen-mobile/:packageId', destination: '/yemen-mobile', permanent: true },
      { source: '/baity-packages', destination: '/services', permanent: true },
      { source: '/baity-networks', destination: '/services', permanent: true },
      { source: '/network-cards/:networkId', destination: '/services/:networkId', permanent: true },
      { source: '/electricity-requests', destination: '/admin-requests', permanent: true },
      { source: '/water-requests', destination: '/admin-requests', permanent: true },
      { source: '/withdrawal-requests', destination: '/admin-requests', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        // تم استثناء الأيقونات والبانرات (icons|banners|banr) من منع التخزين لضمان بقائها في الذاكرة وظهورها الفوري
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
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;