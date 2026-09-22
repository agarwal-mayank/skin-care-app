import type { SkinType } from "@/lib/quiz/types";

// Factual, minimal content only — no dosha/Ayurvedic descriptive copy and no
// package/pricing (still TBD, see TICKET-6). Don't expand this with invented
// content; wait for the founder's real copy.
const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  dry: "Dry",
  sensitive: "Sensitive",
  oily: "Oily",
};

export interface QuizResultEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildQuizResultEmail(skinType: SkinType): QuizResultEmailContent {
  const label = SKIN_TYPE_LABELS[skinType];

  return {
    subject: "Your Ayurvedic skin type result",
    html: `<p>Thanks for completing the skin quiz!</p><p>Your computed skin type is: <strong>${label}</strong>.</p><p>We'll be in touch soon.</p>`,
    text: `Thanks for completing the skin quiz!\n\nYour computed skin type is: ${label}.\n\nWe'll be in touch soon.`,
  };
}
