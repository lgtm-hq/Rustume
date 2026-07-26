import { z } from "zod";

/** Permissive resume payload check at the API boundary. */
export const resumeDataSchema = z
  .object({
    basics: z.record(z.string(), z.unknown()),
    sections: z.record(z.string(), z.unknown()),
    metadata: z.object({ template: z.string() }).passthrough(),
  })
  .passthrough();

export const cloudResumeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
});

export const paginatedCloudResumeSummariesSchema = z.object({
  items: z.array(cloudResumeSummarySchema),
  total: z.number(),
  page: z.number(),
  per_page: z.number(),
});

export const cloudResumeRowSchema = cloudResumeSummarySchema.extend({
  user_id: z.string(),
  data: resumeDataSchema,
  is_public: z.boolean(),
  public_slug: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
});

export const importBatchResponseSchema = z.object({
  imported: z.array(cloudResumeSummarySchema),
  failed: z.array(
    z.object({
      id: z.string().optional(),
      error: z.string(),
    }),
  ),
});

export const themeSchema = z.object({
  background: z.string(),
  text: z.string(),
  primary: z.string(),
});

export const templateInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  theme: themeSchema,
});

export const templateListSchema = z.array(templateInfoSchema);

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).optional(),
});

export const resumeExportItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  data: z.unknown(),
});

export const resumeBulkExportSchema = z.object({
  exported_at: z.string(),
  resumes: z.array(resumeExportItemSchema),
});

export const deleteAccountResponseSchema = z.object({
  deleted: z.boolean(),
  message: z.string(),
});

export const authRequireAuthSchema = z.object({
  require_auth: z.boolean().optional(),
});

const authMePayloadSchema = z.object({
  id: z.string(),
  plan: z.string(),
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  subscription: z.unknown().optional(),
  require_auth: z.boolean().optional(),
});

export interface ParsedAuthUser {
  id: string;
  plan: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  subscription?: {
    status: string;
    expires_at?: string;
  };
}

function parseSubscription(value: unknown): ParsedAuthUser["subscription"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const status = (value as { status?: unknown }).status;
  if (typeof status !== "string") {
    return undefined;
  }

  const subscription: NonNullable<ParsedAuthUser["subscription"]> = { status };
  const expiresAt = (value as { expires_at?: unknown }).expires_at;
  if (typeof expiresAt === "string") {
    subscription.expires_at = expiresAt;
  }

  return subscription;
}

/** Parse and validate an authenticated `/auth/me` payload. */
export function parseAuthMePayload(payload: unknown): {
  user: ParsedAuthUser;
  requireAuth: boolean;
} {
  const result = authMePayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("Auth probe failed: invalid /auth/me response");
  }

  const record = result.data;
  const user: ParsedAuthUser = { id: record.id, plan: record.plan };

  if (record.email !== undefined) {
    user.email = record.email;
  }
  if (record.first_name !== undefined) {
    user.first_name = record.first_name;
  }
  if (record.last_name !== undefined) {
    user.last_name = record.last_name;
  }

  const subscription = parseSubscription(record.subscription);
  if (subscription) {
    user.subscription = subscription;
  }

  return { user, requireAuth: record.require_auth === true };
}
