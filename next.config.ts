import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer는 Node 전용 소켓을 쓴다 — 번들러가 건드리지 못하게 외부로 뺀다.
  serverExternalPackages: ['nodemailer'],
  // sharp의 네이티브 libvips(@img/*)는 RPATH로 로드돼 트레이서가 놓친다 —
  // 배포에서 ERR_DLOPEN_FAILED(libvips-cpp.so 없음)로 확인된 실사례. 강제 포함.
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*', 'node_modules/@img/**/*'],
  },
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
    // Vercel Hobby 이미지 변환 한도(월 5천 건) 초과로 운영의 /_next/image가 전부
    // 402(OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)를 내며 사이트 사진이 통째로
    // 깨졌다(2026-08). 최적화를 끄고 원본을 직접 서빙한다. 되켜는 조건: 플랜 업그레이드
    // 또는 업로드 시점 리사이즈 파이프라인(docs/operations/image-pipeline 전략) 구축.
    unoptimized: true,
    // remotePatterns는 최적화 재개 시 필요한 허용 호스트 목록이라 남겨 둔다.
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
