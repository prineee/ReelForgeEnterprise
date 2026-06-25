export default function ReviewAccessPage() {
  return (
    <main className="min-h-screen bg-black text-white">

      <div className="max-w-4xl mx-auto px-6 py-20">

        <h1 className="text-5xl font-bold text-center mb-6">
          ReelForge Review Access
        </h1>

        <p className="text-center text-zinc-400 mb-12">
          Request review access, bonuses and affiliate support.
        </p>

        <form
          action="mailto:support@fabricaipro.com"
          method="post"
          encType="text/plain"
          className="bg-zinc-900 p-10 rounded-3xl space-y-6"
        >

          <input
            type="text"
            name="Name"
            placeholder="Full Name"
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <input
            type="email"
            name="Email"
            placeholder="Email Address"
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <input
            type="text"
            name="YouTube Channel"
            placeholder="YouTube Channel"
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <input
            type="text"
            name="Website"
            placeholder="Website"
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <input
            type="text"
            name="JVZoo ID"
            placeholder="JVZoo Username"
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <textarea
            name="Promotion Plan"
            placeholder="How will you promote ReelForge?"
            rows={5}
            className="w-full p-4 rounded-xl bg-zinc-800"
          />

          <button
            type="submit"
            className="w-full bg-orange-500 py-4 rounded-xl font-bold"
          >
            Request Review Access
          </button>

        </form>

      </div>

    </main>
  )
}