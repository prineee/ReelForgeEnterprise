import { redirect } from 'next/navigation'

/**
 * Movie Studio Unification (Sprint 16): this page duplicated Render
 * Center's live job-queue monitoring (services/rendering/jobs/RenderJobManager
 * via app/movie-studio/render-center) with a second, unlinked dashboard.
 * Redirecting rather than deleting keeps the old URL (and the
 * ?productionId= links historically pointed at it) from 404ing.
 */
export default function MovieProductionRedirectPage() {
  redirect('/movie-studio/render-center')
}
