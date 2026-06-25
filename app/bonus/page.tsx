export default function BonusPage() {
  return (
    <main className="min-h-screen bg-black text-white">

      <div className="max-w-6xl mx-auto px-6 py-20">

        <h1 className="text-6xl font-bold text-center mb-12">
          ReelForge Bonus Package
        </h1>

        <div className="grid md:grid-cols-2 gap-8">

          <div className="bg-zinc-900 p-8 rounded-3xl">
            <h2 className="text-3xl font-bold mb-4">
              Bonus #1
            </h2>
            <p>100 AI Movie Prompts</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-3xl">
            <h2 className="text-3xl font-bold mb-4">
              Bonus #2
            </h2>
            <p>50 Viral Story Templates</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-3xl">
            <h2 className="text-3xl font-bold mb-4">
              Bonus #3
            </h2>
            <p>AI YouTube Channel Starter Kit</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-3xl">
            <h2 className="text-3xl font-bold mb-4">
              Bonus #4
            </h2>
            <p>100 Cartoon Story Ideas</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-3xl md:col-span-2">
            <h2 className="text-3xl font-bold mb-4">
              Bonus #5
            </h2>
            <p>Commercial License Included</p>
          </div>

        </div>

      </div>

    </main>
  )
}