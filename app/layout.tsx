import type { Metadata } from "next";
import "./globals.css";

import GlowBackground from "@/components/ui/GlowBackground";

export const metadata: Metadata = {
  title: {
    default:
      "ReelForge — AI Video Creator for Instagram Reels, TikTok & YouTube Shorts",
    template: "%s | ReelForge",
  },

  description:
    "Create viral AI-powered video reels in minutes. Generate scripts, voiceovers and videos with AI.",

  keywords: [
    "AI video creator",
    "AI Movie Generator",
    "AI Reel Generator",
    "AI Cartoon Generator",
    "AI Dialogue Video",
    "Instagram Reels",
    "YouTube Shorts",
    "TikTok",
  ],

  openGraph: {
    title: "ReelForge",
    description: "Create AI Movies In Minutes",
    url: "https://reelforge.fabricaipro.com",
    siteName: "ReelForge",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "ReelForge",
    description: "Create AI Movies In Minutes",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>

        <GlowBackground />

        {children}

      </body>
    </html>
  );
}