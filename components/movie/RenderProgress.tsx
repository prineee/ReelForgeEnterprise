"use client";

import { useEffect, useState } from "react";

interface Props {
  movieId: string;
}

interface ProgressData {
  status: string;
  progress: number;
  currentScene?: number;
  totalScenes?: number;
  downloadUrl?: string;
}

export default function RenderProgress({
  movieId,
}: Props) {
  const [progress, setProgress] =
    useState<ProgressData>({
      status: "Waiting...",
      progress: 0,
    });

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/movie/status?movie_id=${movieId}`
        );

        if (!res.ok) return;

        const data = await res.json();

        setProgress(data);

        if (
          data.status === "completed" ||
          data.status === "failed"
        ) {
          clearInterval(timer);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [movieId]);

  return (
    <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-6">

      <div className="flex justify-between mb-3">

        <span className="font-semibold">
          {progress.status}
        </span>

        <span>
          {progress.progress}%
        </span>

      </div>

      <div className="h-3 bg-gray-700 rounded-full">

        <div
          className="h-3 rounded-full bg-purple-600 transition-all duration-500"
          style={{
            width: `${progress.progress}%`,
          }}
        />

      </div>

      {progress.currentScene && (

        <p className="mt-3 text-gray-400">

          Scene {progress.currentScene}

          /

          {progress.totalScenes}

        </p>

      )}

      {progress.downloadUrl && (

        <a
          href={progress.downloadUrl}
          target="_blank"
          className="mt-5 inline-block rounded-lg bg-green-600 px-6 py-2 text-white"
        >
          Download Movie
        </a>

      )}

    </div>
  );
}