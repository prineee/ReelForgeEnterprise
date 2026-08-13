/**
 * VeoProviderError.test.ts
 *
 * Run with: npx tsx --test services/rendering/providers/cloud/VeoProviderError.test.ts
 * (no test framework is configured in this repo — see CameraDirector.test.ts's
 * file header for the established convention this follows.)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { VeoProviderError, classifySdkError } from "./VeoProviderError";

describe("VeoProviderError — error normalization", () => {
  test("passes an already-typed VeoProviderError through unchanged", () => {
    const original = new VeoProviderError("INVALID_DURATION", "bad duration");
    const classified = classifySdkError(original, "GENERATION_FAILED");
    assert.equal(classified, original);
  });

  test("classifies an API-key-flavored message as AUTHENTICATION_FAILED", () => {
    const classified = classifySdkError(new Error("Missing or invalid API key"), "GENERATION_FAILED");
    assert.equal(classified.code, "AUTHENTICATION_FAILED");
  });

  test("classifies a permission/403-flavored message as AUTHENTICATION_FAILED", () => {
    const classified = classifySdkError(new Error("403 Forbidden: permission denied"), "GENERATION_FAILED");
    assert.equal(classified.code, "AUTHENTICATION_FAILED");
  });

  test("classifies an invalid-argument-flavored message as INVALID_REQUEST", () => {
    const classified = classifySdkError(new Error("400 Bad Request: invalid argument in request"), "GENERATION_FAILED");
    assert.equal(classified.code, "INVALID_REQUEST");
  });

  test("classifies a timeout-flavored message as TIMEOUT", () => {
    const classified = classifySdkError(new Error("Request timed out after 60000ms"), "GENERATION_FAILED");
    assert.equal(classified.code, "TIMEOUT");
  });

  test("falls back to the caller-supplied code for an unrecognized message", () => {
    const classified = classifySdkError(new Error("something unexpected happened"), "POLLING_FAILED");
    assert.equal(classified.code, "POLLING_FAILED");
  });

  test("handles a non-Error thrown value", () => {
    const classified = classifySdkError("a plain string error", "DOWNLOAD_FAILED");
    assert.equal(classified.code, "DOWNLOAD_FAILED");
    assert.match(classified.message, /a plain string error/);
  });

  test("preserves the original error as `cause`", () => {
    const original = new Error("boom");
    const classified = classifySdkError(original, "GENERATION_FAILED");
    assert.equal(classified.cause, original);
  });
});
