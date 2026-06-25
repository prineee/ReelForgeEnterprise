import type { Metadata } from 'next'
import PolicyPage, {
  MetaGrid, MetaItem, Section, P, Bullets, Steps, Bold, EmailLink,
} from '@/components/PolicyPage'

export const metadata: Metadata = {
  title: 'Cancellation Policy',
  description: 'Learn how to cancel your AI ReelForge subscription and what happens to your account afterwards.',
}

export default function CancellationPage() {
  return (
    <PolicyPage title="Cancellation Policy" badge="Subscriptions" effectiveDate="May 28, 2026">
      <MetaGrid>
        <MetaItem label="Effective Date" value="May 28, 2026" />
        <MetaItem label="Website"        value="reelforge.fabricaipro.com" />
        <MetaItem label="Contact"        value="support@fabricaipro.com" href="mailto:support@fabricaipro.com" />
      </MetaGrid>

      <Section number={1} title="Overview">
        <P>
          You may cancel your AI ReelForge subscription at any time. This policy explains how
          cancellations work and what happens to your account and data after cancellation.
        </P>
      </Section>

      <Section number={2} title="How to Cancel">
        <P>You can cancel your subscription in two ways:</P>
        <Bullets items={[
          <><Bold>Self-service:</Bold> Go to Dashboard → Billing → Cancel Subscription.</>,
          <><Bold>Email:</Bold> Send a cancellation request to{' '}
            <EmailLink address="support@fabricaipro.com" /> with your registered email.</>,
        ]} />
        <P>Cancellations are processed immediately upon request.</P>
      </Section>

      <Section number={3} title="What Happens After Cancellation">
        <Bullets items={[
          'You will retain full access to your current plan until the end of your billing cycle.',
          'No further charges will be made after cancellation.',
          'Your account will be downgraded to the Free plan at the end of the billing period.',
          'All your previously generated content remains accessible on the Free plan.',
          'Unused credits from your paid plan will expire at the end of the billing cycle.',
        ]} />
      </Section>

      <Section number={4} title="Monthly Subscriptions">
        <Bullets items={[
          'Cancel anytime before your next renewal date to avoid being charged.',
          <>If you cancel on your renewal date, you may still be charged for that cycle. Contact us
            immediately at <EmailLink address="support@fabricaipro.com" /> for assistance.</>,
        ]} />
      </Section>

      <Section number={5} title="Annual Subscriptions">
        <Bullets items={[
          'You may cancel your annual subscription at any time.',
          'Access continues until the end of the annual period.',
          'See our Refund Policy for prorated refund eligibility.',
        ]} />
      </Section>

      <Section number={6} title="Pro Deals">
        <Bullets items={[
          'Pro deals are not subject to cancellation as there is no recurring billing.',
          'Account access remains active permanently unless terminated for Terms violations.',
        ]} />
      </Section>

      <Section number={7} title="Account Deletion">
        <P>
          If you wish to permanently delete your account and all associated data:
        </P>
        <Steps items={[
          <>Email <EmailLink address="support@fabricaipro.com" /> with subject &ldquo;Account Deletion Request&rdquo;.</>,
          'We will permanently delete your account within 7 business days.',
          'This action is irreversible — all your projects, content, and data will be permanently removed.',
          'Any active subscription will be cancelled automatically.',
        ]} />
      </Section>

      <Section number={8} title="Reactivation">
        <Bullets items={[
          'Simply log back in and choose a new plan from the Billing page.',
          'Your previous projects and content will still be available if you did not delete your account.',
        ]} />
      </Section>

      <Section number={9} title="Cancellation by AI ReelForge">
        <P>We reserve the right to cancel or suspend your account if:</P>
        <Bullets items={[
          'You violate our Terms and Conditions.',
          'Fraudulent activity is detected on your account.',
          'Payment fails after multiple retry attempts.',
        ]} />
        <P>In such cases, we will notify you via email with the reason for cancellation.</P>
      </Section>

      <Section number={10} title="Contact">
        <P>
          For cancellation assistance, contact us at{' '}
          <EmailLink address="support@fabricaipro.com" />.
        </P>
      </Section>
    </PolicyPage>
  )
}
