import { Brain, Languages, Gauge, ShieldCheck, Layers, Bot } from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, GlassCard, StatsCard } from "@/components/ui";

const CAPABILITIES = [
  {
    icon: <Brain className="h-6 w-6" />,
    title: "Context-aware scripting",
    description: "Models that understand your niche, audience and platform to write scripts that convert.",
  },
  {
    icon: <Languages className="h-6 w-6" />,
    title: "50+ languages",
    description: "Generate and localise content for a global audience in a single click.",
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "Character memory",
    description: "Persistent faces, voices and personalities reused across every production.",
  },
  {
    icon: <Bot className="h-6 w-6" />,
    title: "Realistic AI voices",
    description: "Studio-grade voiceover with natural intonation across six distinct voices.",
  },
];

const METRICS = [
  { label: "Avg. render time", value: "60s" },
  { label: "Output resolution", value: "4K" },
  { label: "Voice styles", value: "6" },
  { label: "Uptime SLA", value: "99.9%" },
];

/** AI capabilities overview with supporting metrics. */
export function AICapabilities() {
  return (
    <MarketingSection id="capabilities">
      <SectionTitle
        eyebrow="Under the hood"
        title="Enterprise-grade AI capabilities"
        subtitle="The same models powering studios and agencies — tuned for speed, consistency and quality."
      />

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <GlassCard key={c.title} className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-600/20 text-orange-400 ring-1 ring-white/10">
              {c.icon}
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{c.description}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {METRICS.map((m) => (
          <StatsCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={<Gauge className="h-5 w-5" />}
          />
        ))}
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <ShieldCheck className="h-4 w-4 text-orange-400" />
        Secure infrastructure with credit-based, transparent usage.
      </p>
    </MarketingSection>
  );
}

export default AICapabilities;
