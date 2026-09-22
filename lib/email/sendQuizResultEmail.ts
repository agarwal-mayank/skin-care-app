import { resend } from "@/lib/resend";
import type { SkinType } from "@/lib/quiz/types";

import { buildQuizResultEmail } from "./quizResultEmail";

// Resend's shared sandbox sender — placeholder until a custom domain is
// verified in the Resend dashboard. Swap this once that happens.
const FROM_ADDRESS = "Ayurvedic Skin Quiz <onboarding@resend.dev>";

interface SendQuizResultEmailParams {
  to: string;
  skinType: SkinType;
}

// Never throws: an email-send failure must not fail the QuizResponse save
// that already succeeded (see the plan's "Fail loudly" notes for why this
// differs from the DB write, which is never caught).
export async function sendQuizResultEmail({ to, skinType }: SendQuizResultEmailParams): Promise<void> {
  const { subject, html, text } = buildQuizResultEmail(skinType);

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Failed to send quiz result email:", error);
    }
  } catch (error) {
    console.error("Failed to send quiz result email:", error);
  }
}
