import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSharedProductionContextRepository } from "@/services/infrastructure/MovieProductionFactory";
import { getSharedRenderJobManager, getSharedAssetManager, buildDirectorPlan } from "@/services/infrastructure/MovieWorkspaceFactory";
import { DIRECTOR_PROFILE_PRESETS } from "@/services/ai/director-engine/AIDirectorEngine";
import type { SceneTransition } from "@/services/ai/director/OutputSchema";
import { WorkspaceShell } from "@/components/movie-workspace/WorkspaceShell";
import { WorkspaceTopBar } from "@/components/movie-workspace/WorkspaceTopBar";
import { WorkspaceLeftSidebar } from "@/components/movie-workspace/WorkspaceLeftSidebar";
import { WorkspaceCenterPanel, type RenderJobLookup } from "@/components/movie-workspace/WorkspaceCenterPanel";
import { WorkspaceRightSidebar, type SelectedSceneDetail } from "@/components/movie-workspace/WorkspaceRightSidebar";
import { RenderDashboard } from "@/components/render-dashboard/RenderDashboard";
import type { SceneStatus } from "@/components/storyboard/SceneStatusBadge";

/**
 * Composes the Movie Workspace (Storyboard/Timeline/Assets/Continuity/Render)
 * from services that already existed before this route did — this file adds
 * no new business logic, only server-side wiring, exactly as
 * WorkspaceShell.tsx's own docstring says it should. Every prior sprint's
 * components (movie-workspace/, storyboard/, timeline/, assets/,
 * render-dashboard/) were built and left unmounted; this is what mounts them.
 */
export default async function MovieWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ movieId: string }>;
  searchParams: Promise<{ scene?: string }>;
}) {
  const { movieId } = await params;
  const { scene: selectedSceneId } = await searchParams;

  const context = getSharedProductionContextRepository().get(movieId);
  if (!context?.movieBlueprint) {
    notFound();
  }

  const directorProfile = DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA;
  const built = buildDirectorPlan(context, directorProfile);
  if (!built) {
    notFound();
  }
  const { plan } = built;

  const assetManager = getSharedAssetManager();
  const assetCatalog = assetManager.catalog(context.movieBlueprint, plan);
  const transitionLibrary = assetManager.getTransitionLibrary();

  const renderJobManager = getSharedRenderJobManager();
  const jobs = renderJobManager.list().filter((job) => job.projectId === movieId);
  const jobLookups: RenderJobLookup[] = jobs.map((job) => ({
    sceneId: job.sceneId,
    status: job.status as SceneStatus,
    videoUrl: job.result?.videoUrl,
  }));

  const { movie, characters, environments, cameraPlans, emotionPlans, scenes } = context.movieBlueprint;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let credits = 0;
  if (user) {
    const { data: profile } = (await (supabase.from("users") as any)
      .select("credits")
      .eq("id", user.id)
      .single()) as { data: { credits: number } | null };
    credits = profile?.credits ?? 0;
  }

  const activeVideoProvider =
    process.env.VIDEO_PROVIDER?.toUpperCase() === "LTX"
      ? "LTX"
      : process.env.VIDEO_PROVIDER?.toUpperCase() === "LOCAL_GPU"
        ? "LOCAL_GPU"
        : "GOOGLE";

  const { statusLabel, statusVariant } = deriveMovieStatus(scenes.length, jobLookups);

  const selectedScene = selectedSceneId ? scenes.find((s) => s.id === selectedSceneId) : undefined;
  const selectedSceneDetail: SelectedSceneDetail | undefined = selectedScene
    ? {
        scene: selectedScene,
        cameraPlan: cameraPlans.find((c) => c.id === selectedScene.cameraPlanId),
        emotionPlan: emotionPlans.find((e) => e.id === selectedScene.emotionPlanId),
        environment: environments.find((e) => e.id === selectedScene.environmentId),
        characterNames: selectedScene.characterIds.map((id) => characters.find((c) => c.id === id)?.name ?? id),
      }
    : undefined;

  function transitionNameFor(transition: string): string {
    return transitionLibrary.get(transition as SceneTransition).name;
  }

  return (
    <WorkspaceShell
      topBar={
        <WorkspaceTopBar
          movieTitle={movie.title}
          statusLabel={statusLabel}
          statusVariant={statusVariant}
          directorProfileName={directorProfile.name}
          credits={credits}
        />
      }
      leftSidebar={
        <WorkspaceLeftSidebar
          characters={characters}
          characterLibraryEntries={assetCatalog.characters}
          continuityIssues={plan.continuity.issues}
          locations={assetCatalog.locations}
          musicPlan={assetCatalog.musicPlan}
          voicePlan={assetCatalog.voicePlan}
        />
      }
      centerPanel={
        <WorkspaceCenterPanel
          movieId={movieId}
          scenes={scenes}
          characters={characters}
          environments={environments}
          cameraPlans={cameraPlans}
          emotionPlans={emotionPlans}
          timeline={plan.timeline}
          storyPlan={plan.storyPlan}
          musicPlan={assetCatalog.musicPlan}
          transitionNameFor={transitionNameFor}
          initialJobs={jobLookups}
        />
      }
      rightSidebar={
        <WorkspaceRightSidebar selectedScene={selectedSceneDetail} directorProfile={directorProfile} activeVideoProvider={activeVideoProvider} />
      }
      bottomPanel={
        <RenderDashboard
          movieId={movieId}
          initialJobs={jobs.map((job) => ({
            jobId: job.jobId,
            sceneId: job.sceneId,
            status: job.status,
            providerId: job.providerId,
            retryCount: job.retryCount,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            videoUrl: job.result?.videoUrl,
            error: job.error,
            progress: renderJobManager.getProgress(job.jobId),
          }))}
        />
      }
    />
  );
}

function deriveMovieStatus(
  sceneCount: number,
  jobs: readonly RenderJobLookup[]
): { statusLabel: string; statusVariant: "info" | "success" | "warning" | "danger" | "secondary" } {
  if (jobs.some((job) => job.status === "FAILED")) {
    return { statusLabel: "Needs Attention", statusVariant: "danger" };
  }
  const completedCount = jobs.filter((job) => job.status === "COMPLETED").length;
  if (sceneCount > 0 && completedCount === sceneCount) {
    return { statusLabel: "Rendered", statusVariant: "success" };
  }
  if (jobs.some((job) => job.status !== "COMPLETED")) {
    return { statusLabel: "Rendering", statusVariant: "warning" };
  }
  return { statusLabel: "Drafted", statusVariant: "secondary" };
}
