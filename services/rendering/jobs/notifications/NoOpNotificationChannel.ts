/**
 * NoOpNotificationChannel.ts
 *
 * Discards every event. Useful as an explicit "no notifications" default
 * or in tests that don't care about notification side effects.
 */

import type { NotificationChannel, RenderJobNotificationEvent } from "./NotificationChannel";

export class NoOpNotificationChannel implements NotificationChannel {
  readonly name = "noop";

  async notify(_event: RenderJobNotificationEvent): Promise<void> {
    // Intentionally does nothing.
  }
}
