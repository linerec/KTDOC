import type { MetadataRoute } from 'next';

const baseUrl = 'https://ktdoc.org';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    { path: '/', priority: 1 },
    { path: '/about', priority: 0.8 },
    { path: '/classes', priority: 0.7 },
    { path: '/performances', priority: 0.7 },
    { path: '/calendar', priority: 0.6 },
    { path: '/gallery', priority: 0.9 },
    { path: '/community', priority: 0.5 },
    { path: '/media', priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.path === '/gallery' ? 'weekly' : 'monthly',
    priority: route.priority,
  }));
}
