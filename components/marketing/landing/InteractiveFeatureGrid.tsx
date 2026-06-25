import {
  Clapperboard,
  Tv,
  Drama,
  Smartphone,
  Megaphone,
  Mic2,
  Captions,
  Image as ImageIcon,
  Wand2,
} from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, FeatureCard } from "@/components/ui";

const FEATURES = [
  {
    icon: <Clapperboard className="h-6 w-6" />,
    title: "Cinema Studio",
    description: "Shot-by-shot AI filmmaking with camera controls, lighting and genre direction.",
  },
  {
    icon: <Tv className="h-6 w-6" />,
    title: "Series Generator",
    description: "Multi-episode AI series with story continuity and character memory across episodes.",
  },
  {
    icon: <Drama className="h-6 w-6" />,
    title: "Character Studio",
    description: "Reusable characters — the same face, voice and personality across every production.",
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: "Create Reel",
    description: "Topic to viral reel in 60 seconds with AI script, voiceover and stock clips.",
  },
  {
    icon: <Megaphone className="h-6 w-6" />,
    title: "Marketing Studio",
    description: "URL to ad video — UGC, CGI, cinematic — any format for any platform.",
  },
  {
    icon: <Mic2 className="h-6 w-6" />,
    title: "HeyGen Lipsync",
    description: "Talking avatar videos with perfect lipsync — your AI spokesperson, always on.",
  },
  {
    icon: <Captions className="h-6 w-6" />,
    title: "Caption Burner",
    description: "Six caption styles including TikTok, karaoke and bold — burned in automatically.",
  },
  {
    icon: <ImageIcon className="h-6 w-6" />,
    title: "Thumbnail Maker",
    description: "Scroll-stopping thumbnails generated to match your video and niche instantly.",
  },
  {
    icon: <Wand2 className="h-6 w-6" />,
    title: "Smart Scripts",
    description: "Hook-problem-solution scripts engineered for retention and high click-through.",
  },
];

/** Interactive glass feature grid with hover motion. */
export function InteractiveFeatureGrid() {
  return (
    <MarketingSection id="features">
      <SectionTitle
        eyebrow="Everything you need"
        title="A full creative team, powered by AI"
        subtitle="Nine production-grade tools that replace an entire studio — all included in every plan."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
        ))}
      </div>
    </MarketingSection>
  );
}

export default InteractiveFeatureGrid;
