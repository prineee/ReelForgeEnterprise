/**
 * mockData.ts
 *
 * computeLibraryMetrics() is real, reusable aggregation logic over
 * whatever LibraryMovie[] the page actually has (currently the live
 * /api/workflow/list sync in adapter.ts). The demo catalog this file used
 * to also export was removed once the page stopped seeding itself with it.
 */

import type { LibraryMetrics, LibraryMovie } from './types'

export function computeLibraryMetrics(movies: LibraryMovie[]): LibraryMetrics {
  return {
    totalMovies: movies.length,
    completed: movies.filter((m) => m.status === 'COMPLETED' || m.status === 'ARCHIVED').length,
    rendering: movies.filter((m) => m.status === 'RENDERING' || m.status === 'QUEUED').length,
    failed: movies.filter((m) => m.status === 'FAILED').length,
    creditsConsumed: movies.reduce((sum, m) => sum + m.creditsUsed, 0),
    totalDurationSeconds: movies.reduce((sum, m) => sum + m.durationSeconds, 0),
    storageUsedBytes: movies.reduce((sum, m) => sum + m.storageBytes, 0),
  }
}
