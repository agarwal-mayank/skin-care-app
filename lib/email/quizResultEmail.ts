import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";

// Factual, minimal content only — the computed skin type plus its mapped
// package (currently [PLACEHOLDER] content from lib/quiz/packages.ts). No
// invented dosha/Ayurvedic copy; wait for the founder's real copy.
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
  const skinPackage = getPackageForSkinType(skinType);
  const price = formatPrice(skinPackage.priceInCents, skinPackage.currency);

  // Not HTML-escaped: every interpolated value comes from our own config, never
  // user input. Escape anything user-supplied before adding it here.
  const productItems = skinPackage.products.map((product) => `<li>${product}</li>`).join("");
  const productLines = skinPackage.products.map((product) => `- ${product}`).join("\n");

  return {
    subject: "Your Ayurvedic skin type result",
    html: `<p>Thanks for completing the skin quiz!</p><p>Your computed skin type is: <strong>${label}</strong>.</p><p>Your recommended package: <strong>${skinPackage.name}</strong> (${price})</p><ul>${productItems}</ul><p>We'll be in touch soon.</p>`,
    text: `Thanks for completing the skin quiz!\n\nYour computed skin type is: ${label}.\n\nYour recommended package: ${skinPackage.name} (${price})\n${productLines}\n\nWe'll be in touch soon.`,
  };
}
