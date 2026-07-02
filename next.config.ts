import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // WSL2에서 Turbopack 디스크 캐시가 반복 손상돼(Persisting/Compaction failed
    // → 멀쩡한 라우트가 404/500) dev 파일시스템 캐시를 끈다. 프로덕션 빌드에는 영향 없음.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [
      {
        source: '/guide/screenshots/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
