import type { Metadata } from 'next'
import PolicyPage, {
  MetaGrid, MetaItem, Section, P, Bullets, Steps, Bold, EmailLink,
} from '@/components/PolicyPage'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Understand the AI ReelForge refund policy — money-back guarantee and eligibility conditions.',
}

export default function RefundPage() {
  return (
    <PolicyPage title="Refund Policy" badge="Payments" effectiveDate="May 28, 2026">
      <MetaGrid>
        <MetaItem label="Effective Date" value="May 28, 2026" />
        <MetaItem label="Website"        value="reelforge.fabricaipro.com" />
        <MetaItem label="Contact"        value="support@fabricaipro.com" href="mailto:support@fabricaipro.com" />
      </MetaGrid>

      <Section number={1} title="Overview">
        <P>
          At AI ReelForge, we want you to be completely satisfied with your purchase. This Refund
          Policy outlines the conditions under which refunds are granted.
        </P>
      </Section>

      <Section number={2} title="Monthly Subscriptions">
        <Bullets items={[
          <><Bold>7-Day Money Back Guarantee:</Bold> If you are not satisfied with your subscription,
            you may request a full refund within 7 days of your first payment.</>,
          'Refund requests made after 7 days will not be eligible unless there is a technical issue on our end.',
          'Refunds are not provided for partial months. If you cancel mid-cycle, you retain access until the end of the billing period.',
        ]} />
      </Section>

      <Section number={3} title="Annual Subscriptions">
        <Bullets items={[
          'Annual plans are eligible for a full refund within 14 days of purchase.',
          'After 14 days, a prorated refund may be issued at our discretion based on unused months.',
        ]} />
      </Section>

      <Section number={4} title="Pro Deals">
        <Bullets items={[
          'Pro deal purchases are eligible for a full refund within 7 days of purchase.',
          'After 7 days, Pro deals are non-refundable.',
        ]} />
      </Section>

      <Section number={5} title="Credits">
        <Bullets items={[
          'Purchased credits that have not been consumed are refundable within 7 days of purchase.',
          'Partially consumed credit packs are not eligible for refunds.',
          'Free credits given on signup are non-refundable.',
        ]} />
      </Section>

      <Section number={6} title="Non-Refundable Situations">
        <P>Refunds will NOT be issued in the following cases:</P>
        <Bullets items={[
          'You have violated our Terms and Conditions.',
          'Your account was terminated due to misuse.',
          'You simply changed your mind after 7 days.',
          'Technical issues caused by third-party services outside our control.',
          'You forgot to cancel your subscription before renewal.',
        ]} />
      </Section>

      <Section number={7} title="Technical Issues">
        <P>
          If you experience a technical issue that prevents you from using the Service, please
          contact us at <EmailLink address="support@fabricaipro.com" />. We will attempt to resolve
          the issue within 48 hours. If we are unable to resolve it, a full refund will be issued.
        </P>
      </Section>

      <Section number={8} title="How to Request a Refund">
        <P>To request a refund:</P>
        <Steps items={[
          <>Email <EmailLink address="support@fabricaipro.com" /> with subject line &ldquo;Refund Request&rdquo;.</>,
          'Include your registered email address and order ID.',
          'Briefly describe the reason for your refund request.',
          'We will process eligible refunds within 5–7 business days.',
          'Refunds are credited back to the original payment method.',
        ]} />
      </Section>

      <Section number={9} title="Contact">
        <P>
          For refund queries, contact us at{' '}
          <EmailLink address="support@fabricaipro.com" />.
        </P>
      </Section>
    </PolicyPage>
  )
}
