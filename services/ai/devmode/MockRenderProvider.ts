/**
 * MockRenderProvider.ts
 *
 * RenderOrchestrator's AI_MODE=development equivalent of MockVeoService:
 * wraps the same MockVeoClient (MockVeoService.ts) via
 * BaseVeoClientProvider (services/rendering/providers/cloud/), so
 * RenderOrchestrator's dev-mode path returns the identical fake video —
 * no separate fake data, no duplicated mock logic. See
 * MovieProductionFactory.ts for where this replaces the real
 * LTXCloudProvider/GoogleVeoProvider factories when isDeveloperMode() is
 * true.
 */

import { MockVeoClient } from "./MockVeoService";
import { BaseVeoClientProvider } from "@/services/rendering/providers/cloud/BaseVeoClientProvider";

export class MockRenderProvider extends BaseVeoClientProvider {
  readonly name = "MOCK";

  constructor() {
    super(new MockVeoClient());
  }
}
