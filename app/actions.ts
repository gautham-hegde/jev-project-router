"use server";

import { processSubmission } from "@/lib/submission";
import type { SubmissionResult } from "@/lib/submission";

/**
 * Handles a form submission without exposing provider credentials to the browser.
 * @param formData - Registered string fields plus an `example` ID.
 * @returns The routing decision, or a validation, configuration, or routing error.
 */
export const submitForm = async (
  formData: FormData
): Promise<SubmissionResult> => await processSubmission(formData);
