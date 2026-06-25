import { MarketingSection } from "@/components/shared";
import { SectionTitle, TestimonialCard } from "@/components/ui";

const TESTIMONIALS = [
  {
    quote:
      "I went from spending 3 hours on a single reel to publishing 5 a day. ReelForge literally 10×ed my output — and the thumbnails are fire.",
    author: "Sarah Johnson",
    role: "Fitness Creator",
    company: "420K followers",
    rating: 5,
  },
  {
    quote:
      "The script tool nails the hook-problem-solution format every time. My click-through rate jumped 40% in the first two weeks.",
    author: "Marcus Chen",
    role: "Finance YouTuber",
    company: "1.2M subscribers",
    rating: 5,
  },
  {
    quote:
      "We run the Agency plan for every client. The credit system makes cost-per-project dead simple to track. The ROI is insane.",
    author: "Priya Sharma",
    role: "Founder",
    company: "Sharma Media",
    rating: 5,
  },
];

/** Customer testimonials with ratings, avatars and company names. */
export function CustomerTestimonials() {
  return (
    <MarketingSection id="testimonials">
      <SectionTitle
        eyebrow="Loved by creators"
        title="Real results from real creators"
        subtitle="Join thousands of creators and agencies scaling their content with ReelForge."
      />
      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <TestimonialCard
            key={t.author}
            quote={t.quote}
            author={t.author}
            role={t.role}
            company={t.company}
            rating={t.rating}
          />
        ))}
      </div>
    </MarketingSection>
  );
}

export default CustomerTestimonials;
