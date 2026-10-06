"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

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
  message: z
    .string()
    .trim()
    .min(10, "Please provide some details about your project or enquiry (at least 10 characters).")
    .max(5000, "Message cannot exceed 5,000 characters."),
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
    message: formData.get("message"),
    honeypot: typeof honeypot === "string" ? honeypot : undefined,
  };

  const parsed = contactEnquirySchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Please complete all required fields.";
    return { error: firstError };
  }

  try {
    const admin = createAdminClient();
    const { error: insertError } = await admin
      .from("platform_sales_leads")
      .insert({
        contact_name: parsed.data.contactName,
        email: parsed.data.email.toLowerCase(),
        company_name: parsed.data.companyName || null,
        message: parsed.data.message,
        source: "website",
        stage: "new",
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
