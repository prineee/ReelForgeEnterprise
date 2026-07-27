/**
 * ConsoleNotificationChannel.ts
 *
 * A real, working reference implementation of NotificationChannel — logs
 * every event to the console. Genuinely functional (useful for local
 * development and the verification script), but not a production
 * delivery mechanism; real channels (email, webhook, push, Slack,
 * in-app) are Sprint 6+ work.
 */

import type { NotificationChannel, RenderJobNotificationEvent } from "./NotificationChannel";

export class ConsoleNotificationChannel implements NotificationChannel {
  readonly name = "console";

  async notify(event: RenderJobNotificationEvent): Promise<void> {
    const stagePart = event.stage ? ` stage=${event.stage}` : "";
    const messagePart = event.message ? ` — ${event.message}` : "";
    console.log(`[RenderJobNotification] ${event.type} job=${event.jobId}${stagePart}${messagePart}`);
  }
}
