import Link from "next/link";

export default function FazierPage() {
  return (
    <div className="min-h-screen bg-surface text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">

        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">
            ReelForge
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            AI-powered platform for creating videos, scripts,
            voiceovers, movies, characters and marketing content
            in minutes.
          </p>
        </div>

        <div className="bg-surface-border/20 border border-surface-border rounded-3xl p-10 text-center">

          <h2 className="text-3xl font-bold mb-4">
            🚀 We Have Been Launched on Fazier
          </h2>

          <p className="text-gray-400 mb-10">
            Support ReelForge by visiting our launch page and
            sharing your feedback.
          </p>

          <a
            href="https://fazier.com/launches/reelforge.fabricaipro.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <img
              src="https://fazier.com/api/v1/public/badges/launch_badges.svg?badge_type=launched&theme=light"
              width={180}
              alt="Fazier badge"
              className="mx-auto"
            />
          </a>

          <div className="mt-10">
            <a
              href="https://fazier.com/launches/reelforge.fabricaipro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold"
            >
              Visit ReelForge on Fazier
            </a>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-6">

          <div className="card p-6">
            <h3 className="font-bold text-xl mb-3">
              🎬 AI Video Creator
            </h3>
            <p className="text-gray-400">
              Create professional videos and reels with AI.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-xl mb-3">
              🤖 AI Movie Studio
            </h3>
            <p className="text-gray-400">
              Generate scripts, scenes and characters.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-xl mb-3">
              🚀 Marketing Studio
            </h3>
            <p className="text-gray-400">
              Create ads and promotional videos in minutes.
            </p>
          </div>

        </div>

        <div className="text-center mt-20">
          <Link
            href="/"
            className="text-brand-400 hover:text-brand-300"
          >
            ← Back to ReelForge
          </Link>
        </div>
      </div>
    </div>
  );
}