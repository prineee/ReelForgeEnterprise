import type { Metadata } from 'next'
import PolicyPage, {
  MetaGrid, MetaItem, Section, P, SubHeading, Bullets, EmailLink,
} from '@/components/PolicyPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how AI ReelForge collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy" badge="Legal" effectiveDate="May 28, 2026">
      <MetaGrid>
        <MetaItem label="Effective Date" value="May 28, 2026" />
        <MetaItem label="Website"        value="reelforge.fabricaipro.com" />
        <MetaItem label="Contact"        value="support@fabricaipro.com" href="mailto:support@fabricaipro.com" />
      </MetaGrid>

      <Section number={1} title="Introduction">
        <P>
          AI ReelForge (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and safeguard your personal information
          when you use our Service.
        </P>
      </Section>

      <Section number={2} title="Information We Collect">
        <SubHeading>Information you provide:</SubHeading>
        <Bullets items={[
          'Name and email address during registration.',
          'Payment information (processed securely via Razorpay/Stripe — we never store card details).',
          'Content inputs such as topics, scripts, and prompts you enter.',
        ]} />

        <SubHeading>Information collected automatically:</SubHeading>
        <Bullets items={[
          'IP address and browser type.',
          'Pages visited and features used.',
          'Device information.',
          'Usage logs and credit consumption data.',
        ]} />
      </Section>

      <Section number={3} title="How We Use Your Information">
        <P>We use your information to:</P>
        <Bullets items={[
          'Create and manage your account.',
          'Process payments and subscriptions.',
          'Deliver AI-generated content.',
          'Send account-related notifications and updates.',
          'Improve our Service and fix issues.',
          'Comply with legal obligations.',
        ]} />
      </Section>

      <Section number={4} title="Data Storage">
        <P>
          Your data is stored securely using Supabase (PostgreSQL). Generated content including
          thumbnails and voiceovers are stored on Cloudinary with SSL encryption. We retain your
          data for as long as your account is active.
        </P>
      </Section>

      <Section number={5} title="Data Sharing">
        <P>We do not sell your personal data. We share data only with:</P>
        <Bullets items={[
          <><strong className="text-gray-200 font-semibold">Payment processors</strong>{' '}(Razorpay, Stripe) to process transactions.</>,
          <><strong className="text-gray-200 font-semibold">AI API providers</strong>{' '}(Groq, ElevenLabs, Replicate) solely to generate your requested content.</>,
          <><strong className="text-gray-200 font-semibold">Cloud storage</strong>{' '}(Cloudinary, Supabase) to store your files.</>,
          <><strong className="text-gray-200 font-semibold">Legal authorities</strong>{' '}if required by law.</>,
        ]} />
      </Section>

      <Section number={6} title="Cookies">
        <P>
          We use cookies to maintain your login session and remember your preferences. You can
          disable cookies in your browser settings, but this may affect functionality.
        </P>
      </Section>

      <Section number={7} title="Your Rights">
        <P>You have the right to:</P>
        <Bullets items={[
          'Access your personal data at any time.',
          'Request correction of inaccurate data.',
          'Request deletion of your account and data.',
          'Export your data in a portable format.',
          'Opt out of marketing communications.',
        ]} />
        <P>
          To exercise these rights, email us at{' '}
          <EmailLink address="support@fabricaipro.com" />.
        </P>
      </Section>

      <Section number={8} title="Children's Privacy">
        <P>
          AI ReelForge is not intended for users under 18 years of age. We do not knowingly
          collect data from minors.
        </P>
      </Section>

      <Section number={9} title="Security">
        <P>
          We implement industry-standard security measures including SSL encryption, secure password
          hashing, and role-based access controls to protect your data.
        </P>
      </Section>

      <Section number={10} title="Changes to This Policy">
        <P>
          We may update this Privacy Policy periodically. We will notify you via email or in-app
          notification of significant changes.
        </P>
      </Section>

      <Section number={11} title="Contact">
        <P>
          For privacy-related concerns, contact us at{' '}
          <EmailLink address="support@fabricaipro.com" />.
        </P>
      </Section>
    </PolicyPage>
  )
}
