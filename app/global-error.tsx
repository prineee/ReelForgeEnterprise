"use client";

import { useEffect } from "react";

/**
 * Only catches errors thrown by the root layout itself (a genuinely rare,
 * catastrophic case) — everything else is caught by app/error.tsx. Must
 * render its own <html>/<body> since it replaces the root layout.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#0f0f1a", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#a1a1aa" }}>
          ReelForge hit an unexpected error loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          style={{ background: "#ea580c", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
