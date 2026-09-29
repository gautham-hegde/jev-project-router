import "server-only";
import { z } from "zod";

import { examples } from "./examples";
import { routeSubmission, submissionSchema } from "./router";
import type { RoutingDecision } from "./router";

/**
 * The serializable result returned by the form's Server Action.
 * @remarks Returned errors cover validation, Gateway configuration, and routing.
 */
export type SubmissionResult =
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; decision: RoutingDecision };

/**
 * Validates a submission and routes it through Jev and its fallback model.
 * @param formData - Registered string fields plus an `example` ID.
 * @param route - Injectable routing function for offline tests, which need no Gateway credentials.
 * @returns Validation, configuration, or routing errors, or a routing success.
 * @remarks Provider errors are converted to safe messages before being returned.
 * Authentication is resolved by the SDK, including OIDC from Vercel's request context.
 */
export const processSubmission = async (
  formData: FormData,
  route: typeof routeSubmission = routeSubmission
): Promise<SubmissionResult> => {
  const id = z
    .enum(["projects", "contact", "issues"])
    .safeParse(formData.get("example"));
  if (!id.success) {
    return {
      message: "Invalid submission. Refresh the page and try again.",
      status: "error",
    };
  }
  const example = examples[id.data];
  const parsed = submissionSchema(example).safeParse(
    Object.fromEntries(
      example.fields.map((field) => [
        field.name,
        formData.get(field.name) ?? "",
      ])
    )
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return {
      fieldErrors,
      message: "Check the highlighted fields and try again.",
      status: "error",
    };
  }
  try {
    const decision = await route(example, parsed.data);
    return { decision, status: "success" };
  } catch (error) {
    // AI SDK wraps authentication failures with these names and drops the HTTP status.
    const authentication = z
      .union([
        z.object({ statusCode: z.literal(401) }),
        z.object({
          name: z.enum(["GatewayAuthenticationError", "GatewayError"]),
        }),
      ])
      .safeParse(error);
    if (authentication.success) {
      return {
        message:
          process.env.NODE_ENV === "development"
            ? "AI Gateway authentication failed. Set AI_GATEWAY_API_KEY in .env.local, or run vercel link and vercel env pull .env.local to use Vercel OIDC."
            : "AI Gateway authentication failed. Check this deployment’s Gateway credentials or Vercel OIDC configuration.",
        status: "error",
      };
    }
    const forbidden = z.object({ statusCode: z.literal(403) }).safeParse(error);
    if (forbidden.success) {
      return {
        message:
          "AI Gateway denied access to openai/gpt-6-luna-fast. Check this Gateway account’s model access and paid-credit configuration, then try again.",
        status: "error",
      };
    }
    return {
      message:
        "We couldn’t complete the routing review. Check your Gateway configuration or try again.",
      status: "error",
    };
  }
};
