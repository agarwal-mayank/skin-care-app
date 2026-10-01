import { resend } from "@/lib/resend";

import { buildOrderConfirmationEmail, type OrderConfirmationEmailInput } from "./orderConfirmationEmail";

// Resend's shared sandbox sender — same placeholder as sendQuizResultEmail.ts.
const FROM_ADDRESS = "Ayurvedic Skin Quiz <onboarding@resend.dev>";

interface SendOrderConfirmationEmailParams extends OrderConfirmationEmailInput {
  to: string;
}

// Never throws: the Order is already marked paid by the time this runs, and a
// failed email must not undo or fail that update. Failures are logged loudly
// (without the recipient or address — PII). Building the email is inside the
// try too: a throw there would otherwise 500 the caller after the Order is
// paid, and retries would see "already-paid" and never send the email.
export async function sendOrderConfirmationEmail({ to, ...input }: SendOrderConfirmationEmailParams): Promise<void> {
  try {
    const { subject, html, text } = buildOrderConfirmationEmail(input);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
      text,
    });

    if (error) {
      console.error(`Failed to send order confirmation email for order ${input.orderId}:`, error);
    }
  } catch (error) {
    console.error(`Failed to send order confirmation email for order ${input.orderId}:`, error);
  }
}
