import { MaxWidthContainer } from "@/components/shared";

const BRANDS = ["TechFlow", "Creator", "ViralLab", "PixelPro", "Studioify", "Nova Media"];

/** "Trusted by" social-proof logo strip. */
export function TrustedBy() {
  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-10">
      <MaxWidthContainer>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Trusted by 10,000+ creators &amp; agencies worldwide
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {BRANDS.map((brand) => (
            <span
              key={brand}
              className="text-lg font-black tracking-tight text-zinc-500 grayscale transition-all duration-300 hover:text-zinc-200 hover:grayscale-0 sm:text-xl"
            >
              {brand}
            </span>
          ))}
        </div>
      </MaxWidthContainer>
    </section>
  );
}

export default TrustedBy;
