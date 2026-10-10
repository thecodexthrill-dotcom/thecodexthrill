"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatLeadMessage } from "@/lib/supabase/lead-service-helper";

export type ContactActionState = {
  error?: string;
  message?: string;
};

const contactEnquirySchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Please enter your name (at least 2 characters).")
    .max(160, "Name must be under 160 characters."),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(320, "Email address is too long."),
  companyName: z
    .string()
    .trim()
    .max(160, "Company name must be under 160 characters.")
    .optional(),
  requestedService: z
    .string()
    .trim()
    .max(160)
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "Please provide some details about your project or enquiry (at least 10 characters).")
    .max(5000, "Message cannot exceed 5,000 characters."),
  source: z.enum(["website", "referral", "admin", "import", "other"]).default("website"),
  honeypot: z.string().optional(),
});

export async function submitContactEnquiryAction(
  _previousState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const honeypot = formData.get("_hp_security");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    // Bot detected via honeypot trap. Silently accept to mislead automated spam scrapers.
    return {
      message:
        "Thank you for reaching out. We have received your project details and an engineering lead will review them within one business day.",
    };
  }

  const raw = {
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    companyName: formData.get("companyName") || undefined,
    requestedService: formData.get("requestedService") || undefined,
    message: formData.get("message"),
    source: (formData.get("source") as string) || "website",
    honeypot: typeof honeypot === "string" ? honeypot : undefined,
  };

  const parsed = contactEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Please complete all required fields.";
    return { error: firstError };
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  try {
    const admin = createAdminClient();

    // Spam / duplicate submission throttle: 120 seconds
    const throttleThreshold = new Date(Date.now() - 120 * 1000).toISOString();
    const { data: recentSubmissions } = await admin
      .from("platform_sales_leads")
      .select("id")
      .eq("email", normalizedEmail)
      .gte("created_at", throttleThreshold)
      .limit(1);

    if (recentSubmissions && recentSubmissions.length > 0) {
      return {
        message:
          "Thank you for reaching out. We have received your project details and an engineering lead is already reviewing them.",
      };
    }

    const formattedMessage = formatLeadMessage(
      parsed.data.requestedService,
      parsed.data.message,
    );

    // Schedule 1 business day follow-up
    const nextBusinessDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await admin
      .from("platform_sales_leads")
      .insert({
        contact_name: parsed.data.contactName,
        email: normalizedEmail,
        company_name: parsed.data.companyName || null,
        message: formattedMessage,
        source: parsed.data.source,
        stage: "new",
        follow_up_at: nextBusinessDay,
      });

    if (insertError) {
      console.error("[contact.enquiry] Failed to record website lead", {
        code: insertError.code,
        message: insertError.message,
      });
      return {
        error:
          "We could not record your enquiry at this moment. Please email us directly at contact@thecodexthrill.com.",
      };
    }

    return {
      message:
        "Thank you for reaching out. We have received your project details and an engineering lead will review them within one business day.",
    };
  } catch (err) {
    console.error("[contact.enquiry] Unexpected failure handling enquiry", err);
    return {
      error:
        "An unexpected error occurred. Please contact us directly at contact@thecodexthrill.com.",
    };
  }
}
