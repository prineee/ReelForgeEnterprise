/**
 * LTXCloudProvider.ts
 *
 * RenderProvider adapter for LTX's hosted REST API. Contains no LTX
 * knowledge of its own — it delegates entirely to the existing
 * LTXVideoClient (services/ai/providers/ltx/LTXVideoClient.ts), the same
 * class MovieProductionFactory.ts wires into VeoService today. This is an
 * adapter only: no request/response logic is duplicated, only translated
 * by BaseVeoClientProvider.
 */

import { LTXVideoClient } from "@/services/ai/providers/ltx/LTXVideoClient";
import { BaseVeoClientProvider } from "./BaseVeoClientProvider";

export class LTXCloudProvider extends BaseVeoClientProvider {
  readonly name = "LTX";

  constructor(apiKey?: string) {
    super(new LTXVideoClient(apiKey));
  }
}
