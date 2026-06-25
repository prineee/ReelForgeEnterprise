import Link from "next/link";
import { Video, Twitter, Youtube, Instagram, Linkedin } from "lucide-react";
import { MaxWidthContainer } from "@/components/shared";
import { gradients } from "@/components/ui";
import { cn } from "@/lib/utils";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "AI Studios", href: "#studios" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Affiliates", href: "/affiliates" },
      { label: "Support", href: "/support" },
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/register" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refund", href: "/refund" },
      { label: "Cancellation", href: "/cancellation" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
];

const SOCIALS = [
  { label: "Twitter", href: "#", icon: Twitter },
  { label: "YouTube", href: "#", icon: Youtube },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "LinkedIn", href: "#", icon: Linkedin },
];

/** Premium multi-column site footer with legal compliance disclaimer. */
export function PremiumFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-white/[0.02]">
      <MaxWidthContainer className="py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-white",
                  gradients.primary,
                )}
              >
                <Video className="h-4 w-4" />
              </span>
              <span className="text-lg font-black tracking-tight text-white">ReelForge</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
              The all-in-one AI video studio. Create cinematic films, cartoons, reels and ads
              in minutes.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/40 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500/60"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-sm text-zinc-500">
            &copy; {year} ReelForge. All rights reserved.
          </p>
          <a
            href="mailto:support@fabricaipro.com"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            support@fabricaipro.com
          </a>
        </div>

        {/* JVZoo required compliance disclaimer (preserved) */}
        <div className="mt-8 space-y-3 border-t border-white/5 pt-6 text-xs leading-6 text-zinc-600">
          <p>
            Disclaimer: Please note that this product does not provide any guarantee of income or
            success. The results achieved by the product owner or any other individuals mentioned
            are not indicative of future success or earnings. This website is not affiliated with
            FaceBook or any of its associated entities. Once you navigate away from FaceBook, the
            responsibility for the content and its usage lies solely with the user.
          </p>
          <p>
            We want to clarify that JVZoo serves as the retailer for the products featured on this
            site. JVZoo® is a registered trademark of BBC Systems Inc. The role of JVZoo as a
            retailer does not constitute an endorsement, approval, or review of these products or
            any claims, statements, or opinions used in their promotion.
          </p>
        </div>
      </MaxWidthContainer>
    </footer>
  );
}

export default PremiumFooter;
