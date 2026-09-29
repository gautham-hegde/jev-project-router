/** A supported form example and its URL segment. */
export type ExampleId = "projects" | "contact" | "issues";

/** A form control whose constraints also drive server validation. */
export interface FormField {
  name: string;
  label: string;
  placeholder: string;
  type: "text" | "email" | "textarea";
  required: boolean;
  maxLength: number;
}

/** One application-owned destination, combining its team and specialty. */
interface DestinationDefinition {
  id: string;
  team: string;
  specialty: string;
  criteria: string;
}

/** One ordered level of a RICE dimension: a description Jev scores against, and its domain value. */
export interface RiceLevel {
  label: string;
  value: number;
}

/**
 * Ordered levels for each RICE dimension, scored by Jev as a single `score` question per dimension.
 * @remarks Reach and Impact follow the standard RICE scale; Effort is expressed in person-months.
 * Confidence here is a RICE input describing evidence quality, distinct from Jev's own routing confidence.
 */
interface RiceCriteria {
  reach: readonly [RiceLevel, RiceLevel, ...RiceLevel[]];
  impact: readonly [RiceLevel, RiceLevel, ...RiceLevel[]];
  confidence: readonly [RiceLevel, RiceLevel, ...RiceLevel[]];
  effort: readonly [RiceLevel, RiceLevel, ...RiceLevel[]];
}

/** The shared source of truth for a page, its form, and both routing models. */
interface ExampleDefinition {
  id: ExampleId;
  title: string;
  description: string;
  instructions: string;
  fields: readonly FormField[];
  destinations: readonly [DestinationDefinition, ...DestinationDefinition[]];
  samples: readonly { label: string; values: Record<string, string> }[];
  /** Present only for examples that also stack-rank submissions with a RICE score. */
  rice?: RiceCriteria;
}

const field = (
  name: string,
  label: string,
  placeholder: string,
  type: FormField["type"] = "text",
  required = true
): FormField => ({
  label,
  maxLength: type === "textarea" ? 4000 : 254,
  name,
  placeholder,
  required,
  type,
});

const identityFields = [
  field("name", "Your name", "Alex Morgan"),
  field("email", "Email address", "alex@example.com", "email"),
];

const sampleIdentity = { email: "alex@example.com", name: "Alex Morgan" };

/** Three examples, with criteria shared verbatim between Jev and Luna. */
export const examples = {
  contact: {
    description: "Share your question and any useful account details.",
    destinations: [
      {
        criteria:
          "Invoice explanations, billing details, tax information, charges, or corrections, without a request to return money.",
        id: "billing_invoices",
        specialty: "Invoices",
        team: "Billing",
      },
      {
        criteria:
          "The primary requested resolution is a refund, reimbursement, or reversal of a payment. Routing does not approve a refund.",
        id: "billing_refunds",
        specialty: "Refunds",
        team: "Billing",
      },
      {
        criteria:
          "The immediate blocker is signing in, recovering an account, permissions, or access to a workspace, including access needed to reach billing.",
        id: "support_access",
        specialty: "Account access",
        team: "Support",
      },
      {
        criteria:
          "A customer needs help with a malfunction, integration error, configuration, or product usage; account recovery is not the primary issue.",
        id: "support_technical",
        specialty: "Technical help",
        team: "Support",
      },
      {
        criteria:
          "A clear informational inquiry such as availability, company information, or a general question unrelated to an account, billing, or a technical problem.",
        id: "general_inquiries",
        specialty: "Inquiries",
        team: "General",
      },
      {
        criteria:
          "An unclear or unsupported request, or multiple unrelated requests without an identifiable primary resolution.",
        id: "contact_triage",
        specialty: "Triage",
        team: "Contact",
      },
    ],
    fields: [
      ...identityFields,
      field("subject", "Subject", "How can we help?"),
      field(
        "message",
        "Your message",
        "What happened, and what would you like us to help with?",
        "textarea"
      ),
      field(
        "accountContext",
        "Account context",
        "Optional plan, workspace, or recent changes. Don’t include passwords.",
        "textarea",
        false
      ),
    ],
    id: "contact",
    instructions:
      "Choose the team that can resolve the main request. Distinguish a request to return money from a request to explain or correct an invoice. For mixed topics, select the owner of the immediate blocker or explicitly requested resolution. A billing mention alone does not make a message a billing request. Use contact_triage if no primary need can be established.",
    rice: undefined,
    samples: [
      {
        label: "Clear request",
        values: {
          ...sampleIdentity,
          accountContext: "Pro plan, workspace Daybreak",
          message:
            "I paid invoice INV-204 twice by mistake. Both charges have settled. Please return the second payment to my original payment method.",
          subject: "Duplicate payment",
        },
      },
      {
        label: "Overlapping needs",
        values: {
          ...sampleIdentity,
          accountContext: "Workspace owner; recovery codes are unavailable",
          message:
            "I need invoices for our accountant, but my old phone broke and I can’t pass two-factor authentication. Please help me recover access first; the invoices themselves are correct.",
          subject: "Can’t get to my invoices",
        },
      },
      {
        label: "Limited context",
        values: {
          ...sampleIdentity,
          accountContext: "",
          message:
            "Something doesn’t look right. Can somebody contact me about it?",
          subject: "Need a hand",
        },
      },
    ],
    title: "Contact",
  },
  issues: {
    description: "Describe what happened and how to reproduce it.",
    destinations: [
      {
        criteria:
          "Visual rendering, layout, or client interaction failures, particularly when the underlying API returns correct data.",
        id: "frontend_interface",
        specialty: "Interface",
        team: "Frontend",
      },
      {
        criteria:
          "Keyboard, screen reader, focus, contrast, or other assistive-access barriers in the interface.",
        id: "frontend_accessibility",
        specialty: "Accessibility",
        team: "Frontend",
      },
      {
        criteria:
          "First-party API correctness, validation, response shape, or endpoint behavior, without evidence of a broader outage or authentication failure.",
        id: "platform_api",
        specialty: "API",
        team: "Platform",
      },
      {
        criteria:
          "Third-party connectors, webhook delivery, data synchronization, or external service interoperability.",
        id: "platform_integrations",
        specialty: "Integrations",
        team: "Platform",
      },
      {
        criteria:
          "Widespread availability, networking, latency, capacity, or deployment infrastructure failures across services or users.",
        id: "infrastructure_reliability",
        specialty: "Reliability",
        team: "Infrastructure",
      },
      {
        criteria:
          "Session, token, SSO, sign-in, or authentication infrastructure defects supported by the report.",
        id: "identity_authentication",
        specialty: "Authentication",
        team: "Identity",
      },
      {
        criteria:
          "Insufficient reproduction evidence, ambiguous ownership, or a problem outside the listed areas.",
        id: "engineering_triage",
        specialty: "Triage",
        team: "Engineering",
      },
    ],
    fields: [
      ...identityFields,
      field("title", "Issue title", "A short description of the problem"),
      field(
        "behavior",
        "Observed and expected behavior",
        "What happened? What should have happened?",
        "textarea"
      ),
      field(
        "steps",
        "Steps to reproduce",
        "Describe the sequence that leads to the issue.",
        "textarea"
      ),
      field(
        "environment",
        "Environment",
        "Browser, app version, deployment, or integration"
      ),
      field(
        "impact",
        "Impact",
        "Who is affected? Is there a workaround?",
        "textarea"
      ),
    ],
    id: "issues",
    instructions:
      "Select the most likely first engineering owner using observed behavior, reproduction evidence, environment, and impact. Prefer concrete evidence over a reporter’s speculation. Accessibility barriers belong to accessibility; invalid sessions or token validation belong to identity; successful API responses with incorrect rendering belong to frontend. Cross-service failures suggest infrastructure, while third-party synchronization points to integrations. Use engineering_triage when the available evidence cannot distinguish owners. This is an ownership suggestion, not a confirmed root cause.",
    rice: undefined,
    samples: [
      {
        label: "Clear request",
        values: {
          ...sampleIdentity,
          behavior:
            "The close button can be clicked, but it is skipped by Tab and Escape does not close the dialog. Keyboard users should be able to dismiss it.",
          environment: "Chrome and Safari, production web app",
          impact:
            "Keyboard-only users cannot return to the page without reloading.",
          steps:
            "Open Team settings, choose Invite member, then try to close the dialog using only the keyboard.",
          title: "Invite dialog traps keyboard users",
        },
      },
      {
        label: "Overlapping needs",
        values: {
          ...sampleIdentity,
          behavior:
            "The UI shows no projects after a token refresh. The network log shows /projects returning 401 with invalid_token; signing out and back in restores the same projects.",
          environment: "Web app, all browsers, SSO workspace",
          impact:
            "Users lose access after refresh. Signing in again is a workaround.",
          steps:
            "Sign in, leave the app open until the session refreshes, then open Projects.",
          title: "Dashboard looks empty after session refresh",
        },
      },
      {
        label: "Limited context",
        values: {
          ...sampleIdentity,
          behavior:
            "The app seemed different yesterday. I can’t remember the exact error.",
          environment: "Browser unknown",
          impact: "One report so far; impact unclear.",
          steps: "I haven’t been able to reproduce it.",
          title: "It stopped working",
        },
      },
    ],
    title: "Issue Report",
  },
  projects: {
    description:
      "Describe a project proposal so it can be routed to an owning team and stack-ranked with RICE.",
    destinations: [
      {
        criteria:
          "New-user acquisition, onboarding conversion, or top-of-funnel growth experiments.",
        id: "growth_acquisition",
        specialty: "Acquisition",
        team: "Growth",
      },
      {
        criteria:
          "Checkout, merchandising, or purchase-funnel improvements for existing traffic; conversion-rate optimization on already-acquired users.",
        id: "growth_conversion",
        specialty: "Conversion",
        team: "Growth",
      },
      {
        criteria:
          "Payment methods, checkout reliability, transaction processing, or checkout-time fraud and risk controls.",
        id: "payments_checkout",
        specialty: "Checkout",
        team: "Payments",
      },
      {
        criteria:
          "Scalability, reliability, performance, or core platform architecture work not owned by a specific product surface.",
        id: "platform_infra",
        specialty: "Infrastructure",
        team: "Platform",
      },
      {
        criteria:
          "New-market or new-locale launches, language and currency support, or region-specific regulatory adaptation.",
        id: "localization_intl",
        specialty: "Internationalization",
        team: "Localization",
      },
      {
        criteria:
          "Fraud, abuse, account security, or policy enforcement outside the checkout flow itself.",
        id: "trust_safety",
        specialty: "Trust and safety",
        team: "Trust & Safety",
      },
      {
        criteria:
          "Reporting, experimentation infrastructure, instrumentation, or decision-support tooling requested as the primary deliverable.",
        id: "data_analytics",
        specialty: "Analytics",
        team: "Data",
      },
      {
        criteria:
          "Insufficient detail to identify a primary owner, or a request that spans several unrelated teams without a clear lead.",
        id: "eng_triage",
        specialty: "Triage",
        team: "Engineering",
      },
    ],
    fields: [
      ...identityFields,
      field("projectName", "Project name", "Checkout retry flow"),
      field(
        "description",
        "Description",
        "What problem does this solve, what's the proposed solution, and why now?",
        "textarea"
      ),
      field(
        "gmvImpact",
        "Estimated GMV impact",
        "e.g. +$120k monthly GMV, or the metric it moves and by how much"
      ),
      field(
        "bizPriority",
        "Business priority",
        "e.g. P0, tied to Q3 OKR; how the requester ranks this"
      ),
      field("locales", "Locales", "e.g. US, CA, UK, or Global"),
      field(
        "timeline",
        "Timeline",
        "e.g. Needed before Q3 close",
        "text",
        false
      ),
    ],
    id: "projects",
    instructions:
      "Choose the team best positioned to own this project, based on its description, target locales, and estimated GMV impact. Business priority is the requester's own urgency claim, not a routing rule by itself; use it only as supporting evidence. Prefer the team whose specialty matches the primary product or technical surface being changed, not every team the description mentions in passing. Use eng_triage when the description is too thin to identify a primary owner, or when it spans unrelated needs with no clear lead.",
    rice: {
      confidence: [
        {
          label:
            "Low confidence: mostly assumption, little supporting evidence for reach or impact.",
          value: 0.5,
        },
        {
          label:
            "Medium confidence: some supporting data, precedent, or a partial test.",
          value: 0.8,
        },
        {
          label:
            "High confidence: strong supporting data, precedent, or a controlled test.",
          value: 1,
        },
      ],
      effort: [
        {
          label: "Extra small: well under one person-month.",
          value: 0.5,
        },
        { label: "Small: about one person-month.", value: 1 },
        { label: "Medium: two to three person-months.", value: 2.5 },
        { label: "Large: four to six person-months.", value: 5 },
        { label: "Extra large: more than six person-months.", value: 8 },
      ],
      impact: [
        {
          label: "Minimal: barely noticeable effect on the goal.",
          value: 0.25,
        },
        { label: "Low: a small, measurable improvement.", value: 0.5 },
        { label: "Medium: a clear, meaningful improvement.", value: 1 },
        { label: "High: a strong improvement to a key metric.", value: 2 },
        {
          label: "Massive: a transformative improvement to a key metric.",
          value: 3,
        },
      ],
      reach: [
        {
          label: "Single locale, a small segment of users (under 5%).",
          value: 1,
        },
        {
          label: "A few locales or a mid-size segment (5-20%).",
          value: 3,
        },
        {
          label: "Most locales or a broad segment (20-50%).",
          value: 6,
        },
        {
          label: "All locales, a majority of active users (50-80%).",
          value: 9,
        },
        {
          label: "All locales, essentially the entire user base (over 80%).",
          value: 12,
        },
      ],
    },
    samples: [
      {
        label: "Clear request",
        values: {
          ...sampleIdentity,
          bizPriority: "P1, supports the Q3 growth OKR",
          description:
            "Add Apple Pay and Google Pay at checkout. Support tickets and cart-abandonment data both point to missing wallet options as a top drop-off reason on mobile.",
          gmvImpact: "+$200k monthly GMV, based on a competitor benchmark",
          locales: "US, CA, UK",
          projectName: "Wallet checkout",
          timeline: "Needed before Q3 close",
        },
      },
      {
        label: "Overlapping needs",
        values: {
          ...sampleIdentity,
          bizPriority: "P2",
          description:
            "Launch the storefront in Mexico and Brazil, which needs local payment methods (Pix, OXXO), Portuguese and Spanish translations, and BRL/MXN pricing.",
          gmvImpact: "Unclear; new-market launch, no current baseline",
          locales: "MX, BR",
          projectName: "LatAm launch",
          timeline: "Targeting next fiscal year",
        },
      },
      {
        label: "Limited context",
        values: {
          ...sampleIdentity,
          bizPriority: "Not sure yet",
          description:
            "Users have been complaining about the app. We should probably look into it and make things better.",
          gmvImpact: "Unknown",
          locales: "Not specified",
          projectName: "App improvements",
          timeline: "",
        },
      },
    ],
    title: "Project",
  },
} as const satisfies Record<ExampleId, ExampleDefinition>;

/** A registered example, preserving its destination IDs as literal types. */
export type Example = (typeof examples)[ExampleId];

/** An application-owned destination derived from the example registry. */
export type Destination = Example["destinations"][number];

/** Narrows an untrusted URL segment to a registered example. */
export const isExampleId = (value: string): value is ExampleId =>
  Object.hasOwn(examples, value);

/** Formats an application-owned team and specialty for display. */
export const destinationLabel = (destination: Destination): string =>
  `${destination.team} · ${destination.specialty}`;
