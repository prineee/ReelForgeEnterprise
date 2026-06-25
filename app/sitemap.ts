import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://reelforge.fabricaipro.com',          lastModified: new Date(), changeFrequency: 'weekly',  priority: 1   },
    { url: 'https://reelforge.fabricaipro.com/register', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://reelforge.fabricaipro.com/login',    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ]
}
