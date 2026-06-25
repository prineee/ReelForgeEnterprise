export default function SupportPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">

        <h1 className="text-5xl font-bold mb-6">
          ReelForge Support
        </h1>

        <p className="text-gray-300 text-lg mb-10">
          Need help with ReelForge AI Movie Studio?
          Our support team is here to assist you.
        </p>

        <div className="border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Contact Support
          </h2>

          <p className="mb-4">
            Email:
          </p>

          <a
            href="mailto:support@fabricaipro.com"
            className="text-purple-400 text-lg"
          >
            support@fabricaipro.com
          </a>

          <p className="mt-6 text-gray-400">
            We normally respond within 24-48 hours.
          </p>
        </div>

        <div className="border border-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">
            Common Questions
          </h2>

          <ul className="space-y-3 text-gray-300">
            <li>• Login Issues</li>
            <li>• Account Access</li>
            <li>• Video Generation Problems</li>
            <li>• Billing Questions</li>
            <li>• Refund Requests</li>
          </ul>
        </div>

      </div>
    </main>
  )
}