export default function AffiliatesPage() {
  return (
    <main className="min-h-screen bg-black text-white">

      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          <div>
            <h1 className="text-6xl font-bold mb-6">
              Promote <span className="text-orange-500">ReelForge</span>
            </h1>

            <p className="text-xl text-zinc-300 mb-8">
              The All-In-One AI Movie Studio.
              Help creators generate AI movies, animated stories,
              dialogue videos and cinematic content in minutes.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="https://www.jvzoo.com/affiliates/info/444419"
                target="_blank"
                className="bg-purple-600 hover:bg-purple-700 px-8 py-4 rounded-xl font-bold"
              >
                Become JVZoo Affiliate
              </a>

              <a
                href="https://reelforge.fabricaipro.com"
                target="_blank"
                className="border border-zinc-700 px-8 py-4 rounded-xl"
              >
                Visit Sales Page
              </a>
            </div>
          </div>

          <div>
            <img
              src="/screenshots/hero-image.png"
              alt="ReelForge"
              className="rounded-3xl shadow-2xl"
            />
          </div>

        </div>
      </section>

      {/* VIDEO */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-5xl font-bold text-center mb-10">
          Watch ReelForge In Action
        </h2>

        <video
          controls
          className="w-full rounded-3xl border border-zinc-800"
        >
          <source
            src="/affiliate-promo-video/affiliate-promo.mp4"
            type="video/mp4"
          />
        </video>
      </section>

      {/* COMMISSIONS */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-5xl font-bold text-center mb-12">
          Affiliate Commission
        </h2>

        <div className="flex flex-wrap justify-center gap-8">

          <div className="w-[300px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-orange-500 mb-3">
              50%
            </h3>
            <p>Front End Commission</p>
          </div>

          <div className="w-[300px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-purple-500 mb-3">
              Instant
            </h3>
            <p>JVZoo Tracking</p>
          </div>

          <div className="w-[300px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-green-500 mb-3">
              High EPC
            </h3>
            <p>AI Software Market</p>
          </div>

        </div>
      </section>

      {/* RESOURCES */}
      <section className="max-w-7xl mx-auto px-6 py-20">

        <h2 className="text-5xl font-bold text-center mb-12">
          Affiliate Resources
        </h2>

        <div className="flex flex-wrap justify-center gap-8">

          <div className="w-[320px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-2xl font-bold mb-4">
              Download Logos
            </h3>

            <p className="text-zinc-400 mb-6">
              Official ReelForge logos and branding assets.
            </p>

            <a
              href="/screenshots/logo.png"
              target="_blank"
              className="bg-purple-600 px-6 py-3 rounded-xl"
            >
              Download
            </a>
          </div>

          <div className="w-[320px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-2xl font-bold mb-4">
              Download Banners
            </h3>

            <p className="text-zinc-400 mb-6">
              High converting promotional banners.
            </p>

            <a
              href="/screenshots/banner-1200x630.png"
              target="_blank"
              className="bg-pink-600 px-6 py-3 rounded-xl"
            >
              Download
            </a>
          </div>

          <div className="w-[320px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-2xl font-bold mb-4">
              Product Demo
            </h3>

            <p className="text-zinc-400 mb-6">
              Download promotional demo video.
            </p>

            <a
              href="/affiliate-promo-video/affiliate-promo.mp4"
              target="_blank"
              className="bg-orange-500 px-6 py-3 rounded-xl"
            >
              Download
            </a>
          </div>

        </div>

      </section>

      {/* REVIEW ACCESS */}
      <section className="max-w-4xl mx-auto px-6 py-20">

        <div className="rounded-3xl p-12 bg-gradient-to-r from-purple-700 to-orange-700 text-center">

          <h2 className="text-4xl font-bold mb-4">
            Need Review Access?
          </h2>

          <p className="mb-8 text-lg">
            We provide review access, bonus approval and affiliate support.
          </p>

          <a
            href="mailto:support@fabricaipro.com"
            className="bg-white text-black px-8 py-4 rounded-xl font-bold"
          >
            Request Review Access
          </a>

        </div>

      </section>

      {/* CONTEST */}
      <section className="max-w-6xl mx-auto px-6 py-20">

        <h2 className="text-5xl font-bold text-center mb-12">
          Affiliate Contest
        </h2>

        <div className="flex flex-wrap justify-center gap-8">

          <div className="w-[280px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-yellow-500">
              🏅 $500
            </h3>
            <p>Top Affiliate</p>
          </div>

          <div className="w-[280px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-gray-300">
              🥈 $250
            </h3>
            <p>Second Place</p>
          </div>

          <div className="w-[280px] bg-zinc-900 p-8 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-orange-500">
              🥉 $100
            </h3>
            <p>Third Place</p>
          </div>

        </div>

      </section>

      {/* EMAIL SWIPE */}
      <section className="max-w-5xl mx-auto px-6 py-20">

        <h2 className="text-5xl font-bold text-center mb-10">
          Affiliate Email Swipe
        </h2>

        <div className="bg-zinc-900 p-10 rounded-3xl">

          <p className="mb-5">
            Subject: Create AI Movies In Minutes
          </p>

          <p className="text-zinc-300 leading-8">
            Want to create AI movies, animated films and story videos
            without expensive software?
            <br /><br />
            ReelForge lets anyone create professional AI content in minutes.
            <br /><br />
            Check it out:
            <br />
            https://reelforge.fabricaipro.com
          </p>

        </div>

      </section>

      {/* CTA */}
      <section className="text-center py-24">

        <h2 className="text-6xl font-bold mb-8">
          Start Promoting ReelForge Today
        </h2>

        <a
          href="https://www.jvzoo.com/affiliates/info/444419"
          target="_blank"
          className="bg-orange-500 hover:bg-orange-600 px-10 py-5 rounded-xl text-xl font-bold"
        >
          Get Affiliate Link
        </a>

      </section>

    </main>
  );
}