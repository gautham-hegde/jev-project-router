import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { examples } from "./examples";
import type { RoutingDecision } from "./router";
import { processSubmission } from "./submission";

vi.mock("server-only", () => ({}));

const example = examples.contact;
const decision: RoutingDecision = {
  destination: example.destinations[0],
  fallbackReason: null,
  jev: {
    confidence: 0.97,
    destination: example.destinations[0].id,
    probabilities: null,
    selectedProbability: 0.99,
  },
  model: "typesafe-ai/jev",
  rice: null,
  threshold: 0.95,
  timings: { jevMs: 42, lunaMs: null },
};
const route = vi.fn(() => Promise.resolve(decision));

const makeSubmission = (): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(example.samples[0].values)) {
    data.set(key, value);
  }
  data.set("example", example.id);
  return data;
};

beforeEach(() => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
  vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubGlobal(Symbol.for("@vercel/request-context"), { get: () => ({}) });
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("Unexpected network request"))
  );
  route.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("submission workflow", () => {
  it("explains a Gateway model-access denial without exposing provider details", async () => {
    const result = await processSubmission(makeSubmission(), () => {
      throw Object.assign(new Error("Private provider response"), {
        statusCode: 403,
      });
    });
    expect(result).toMatchObject({
      message: expect.stringContaining(
        "denied access to openai/gpt-6-luna-fast"
      ),
      status: "error",
    });
    expect(JSON.stringify(result)).not.toContain("Private provider response");
  });

  it("returns the routing decision on success", async () => {
    const result = await processSubmission(makeSubmission(), route);
    expect(result).toMatchObject({ decision, status: "success" });
  });

  it("does not call models for invalid fields", async () => {
    const data = makeSubmission();
    data.set("email", "invalid");
    const result = await processSubmission(data, route);
    expect(result).toMatchObject({
      fieldErrors: { email: expect.any(Array) },
      status: "error",
    });
    expect(route).not.toHaveBeenCalled();
  });

  it("allows injected routing without Gateway environment variables", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const result = await processSubmission(makeSubmission(), route);
    expect(result).toMatchObject({ status: "success" });
    expect(route).toHaveBeenCalledWith(example, example.samples[0].values);
  });

  it("returns a safe error when routing fails", async () => {
    const result = await processSubmission(makeSubmission(), () => {
      throw new Error("Private provider details");
    });
    expect(result).toMatchObject({ status: "error" });
    expect(JSON.stringify(result)).not.toContain("Private provider details");
  });
});

describe("Gateway authentication", () => {
  it.each([
    { confidence: 0.99, source: "api-key" },
    { confidence: 0.99, source: "local-oidc" },
    { confidence: 0.99, source: "request-oidc" },
    { confidence: 0.5, source: "request-oidc" },
  ])(
    "routes using $source with Jev confidence $confidence",
    async ({ source, confidence }) => {
      const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString("base64url");
      const oidcToken = `e30.${payload}.test-signature`;
      vi.stubEnv(
        "NODE_ENV",
        source === "local-oidc" ? "development" : "production"
      );
      vi.stubEnv(
        "AI_GATEWAY_API_KEY",
        source === "api-key" ? "test-gateway-key" : ""
      );
      vi.stubEnv("VERCEL_OIDC_TOKEN", source === "local-oidc" ? oidcToken : "");
      if (source === "request-oidc") {
        vi.stubGlobal(Symbol.for("@vercel/request-context"), {
          get: () => ({ headers: { "x-vercel-oidc-token": oidcToken } }),
        });
      }
      const gatewayFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            answers: {
              destination: { choice: "billing_invoices", type: "choice" },
            },
            providerMetadata: {
              typesafe: { confidence: { destination: confidence } },
            },
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            content: [
              {
                text: JSON.stringify({ destination: "support_access" }),
                type: "text",
              },
            ],
            finishReason: { raw: "stop", unified: "stop" },
            usage: {
              inputTokens: { total: 10 },
              outputTokens: { total: 5 },
            },
          })
        );
      vi.stubGlobal("fetch", gatewayFetch);

      const result = await processSubmission(makeSubmission());

      expect(result).toMatchObject({
        decision: {
          destination: {
            id: confidence < 0.95 ? "support_access" : "billing_invoices",
          },
          model:
            confidence < 0.95 ? "openai/gpt-6-luna-fast" : "typesafe-ai/jev",
        },
        status: "success",
      });
      expect(gatewayFetch).toHaveBeenCalledTimes(confidence < 0.95 ? 2 : 1);
      for (const [, init] of gatewayFetch.mock.calls) {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${source === "api-key" ? "test-gateway-key" : oidcToken}`
        );
      }
    }
  );

  it.each(["development", "production"] as const)(
    "reports actual authentication failures appropriately in %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      const gatewayFetch = vi.fn<typeof fetch>().mockImplementation(() =>
        Promise.resolve(
          Response.json(
            {
              error: {
                message: "Private provider details",
                type: "authentication_error",
              },
            },
            { status: 401 }
          )
        )
      );
      vi.stubGlobal("fetch", gatewayFetch);

      const result = await processSubmission(makeSubmission());

      expect(result).toMatchObject({
        message: expect.stringContaining("AI Gateway authentication failed"),
        status: "error",
      });
      expect(gatewayFetch).toHaveBeenCalledTimes(2);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("Private provider details");
      if (environment === "development") {
        expect(serialized).toContain("AI_GATEWAY_API_KEY");
        expect(serialized).toContain("vercel env pull .env.local");
      } else {
        expect(serialized).toContain("deployment");
        expect(serialized).not.toContain(".env.local");
        expect(serialized).not.toContain("restart");
      }
    }
  );
});
