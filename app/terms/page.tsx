import type { Metadata } from 'next'
import PolicyPage, {
  MetaGrid, MetaItem, Section, P, Bullets, EmailLink,
} from '@/components/PolicyPage'

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Read the AI ReelForge Terms and Conditions before using our service.',
}

export default function TermsPage() {
  return (
    <PolicyPage title="Terms and Conditions" badge="Legal" effectiveDate="May 28, 2026">
      <MetaGrid>
        <MetaItem label="Effective Date" value="May 28, 2026" />
        <MetaItem label="Website"        value="reelforge.fabricaipro.com" />
        <MetaItem label="Company"        value="AI ReelForge" />
        <MetaItem label="Contact"        value="support@fabricaipro.com" href="mailto:support@fabricaipro.com" />
      </MetaGrid>

      <Section number={1} title="Acceptance of Terms">
        <P>
          By accessing or using AI ReelForge (&ldquo;the Service&rdquo;), you agree to be bound by
          these Terms and Conditions. If you do not agree, please do not use the Service.
        </P>
      </Section>

      <Section number={2} title="Description of Service">
        <P>
          AI ReelForge is a SaaS platform that provides AI-powered tools for creating reels,
          thumbnails, captions, voiceovers, and scripts for social media content creators,
          marketers, and businesses.
        </P>
      </Section>

      <Section number={3} title="User Accounts">
        <Bullets items={[
          'You must provide accurate and complete information when creating an account.',
          'You are responsible for maintaining the confidentiality of your account credentials.',
          'You must be at least 18 years of age to use the Service.',
          'You are responsible for all activity that occurs under your account.',
          'We reserve the right to terminate accounts that violate these terms.',
        ]} />
      </Section>

      <Section number={4} title="Subscription and Credits">
        <Bullets items={[
          'AI ReelForge operates on a subscription and credit-based model.',
          'Credits are consumed per action: captions (1 credit), thumbnails (1 credit), voiceovers (2 credits), and reels (5 credits).',
          'Credits do not carry over to the next billing cycle unless otherwise stated.',
          'Pro deal credits are non-expiring.',
          'We reserve the right to modify credit pricing with 30 days notice.',
        ]} />
      </Section>

      <Section number={5} title="Acceptable Use">
        <P>You agree NOT to use the Service to:</P>
        <Bullets items={[
          'Create content that is illegal, defamatory, or infringes on intellectual property rights.',
          'Generate spam, misleading, or fraudulent content.',
          'Violate the rights of any third party.',
          'Attempt to reverse engineer, hack, or disrupt the Service.',
          'Use the Service for any unlawful purpose.',
        ]} />
      </Section>

      <Section number={6} title="Intellectual Property">
        <Bullets items={[
          'All content generated using AI ReelForge belongs to you, the user.',
          'The AI ReelForge platform, logo, and underlying technology remain the property of AI ReelForge.',
          'You grant AI ReelForge a non-exclusive license to process your inputs solely to deliver the Service.',
        ]} />
      </Section>

      <Section number={7} title="Third-Party Services">
        <P>
          AI ReelForge integrates with third-party APIs including but not limited to Groq,
          ElevenLabs, Replicate, and Supabase. We are not responsible for the availability or
          accuracy of these third-party services.
        </P>
      </Section>

      <Section number={8} title="Limitation of Liability">
        <P>
          AI ReelForge shall not be liable for any indirect, incidental, special, or consequential
          damages arising from your use of the Service. Our total liability shall not exceed the
          amount you paid in the last 30 days.
        </P>
      </Section>

      <Section number={9} title="Service Availability">
        <P>
          We strive for 99% uptime but do not guarantee uninterrupted access to the Service.
          Scheduled maintenance will be communicated in advance when possible.
        </P>
      </Section>

      <Section number={10} title="Modifications to Terms">
        <P>
          We reserve the right to modify these Terms at any time. Continued use of the Service
          after changes constitutes acceptance of the new Terms.
        </P>
      </Section>

      <Section number={11} title="Governing Law">
        <P>
          These Terms are governed by the laws of India. Any disputes shall be subject to the
          exclusive jurisdiction of the courts of India.
        </P>
      </Section>

      <Section number={12} title="Contact">
        <P>
          For questions regarding these Terms, contact us at{' '}
          <EmailLink address="support@fabricaipro.com" />.
        </P>
      </Section>
    </PolicyPage>
  )
}
