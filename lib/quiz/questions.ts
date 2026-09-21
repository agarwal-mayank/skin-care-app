// PLACEHOLDER CONTENT — not the real Ayurvedic quiz framework.
// The founder has not yet provided the real questions/dosha-scoring framework
// (see .claude/references/quiz-content.md and the PRD's Open Questions).
// Every prompt/label below is deliberately marked "[PLACEHOLDER]" so it is
// never mistaken for real content. Replace the data here when the real
// framework arrives — scoring.ts should not need to change.

import type { QuizQuestion } from "@/lib/quiz/types";

export const questions: QuizQuestion[] = [
  {
    id: "gender",
    prompt: "[PLACEHOLDER] What is your gender?",
    options: [
      { id: "female", label: "[PLACEHOLDER] Female", doshaWeights: {} },
      { id: "male", label: "[PLACEHOLDER] Male", doshaWeights: {} },
      { id: "other", label: "[PLACEHOLDER] Other", doshaWeights: {} },
    ],
  },
  {
    id: "skin-feel",
    prompt: "[PLACEHOLDER] How does your skin feel by midday?",
    options: [
      { id: "tight-dry", label: "[PLACEHOLDER] Tight and dry", doshaWeights: { vata: 2 } },
      { id: "warm-flushed", label: "[PLACEHOLDER] Warm and flushed", doshaWeights: { pitta: 2 } },
      { id: "soft-oily", label: "[PLACEHOLDER] Soft and a bit oily", doshaWeights: { kapha: 2 } },
    ],
  },
  {
    id: "skin-reaction",
    prompt: "[PLACEHOLDER] How does your skin react to new products?",
    options: [
      { id: "flakes", label: "[PLACEHOLDER] Flakes or feels rough", doshaWeights: { vata: 2 } },
      {
        id: "redness-and-dryness",
        label: "[PLACEHOLDER] Gets red, but also patchy dry",
        doshaWeights: { pitta: 2, vata: 1 },
      },
      { id: "breaks-out", label: "[PLACEHOLDER] Breaks out or feels heavy", doshaWeights: { kapha: 2 } },
    ],
  },
  {
    id: "pore-size",
    prompt: "[PLACEHOLDER] How would you describe your pores?",
    options: [
      { id: "barely-visible", label: "[PLACEHOLDER] Barely visible", doshaWeights: { vata: 2 } },
      { id: "visible-t-zone", label: "[PLACEHOLDER] Visible, mostly on the T-zone", doshaWeights: { pitta: 2 } },
      { id: "large-and-open", label: "[PLACEHOLDER] Large and open", doshaWeights: { kapha: 2 } },
    ],
  },
  {
    id: "sensitivity",
    prompt: "[PLACEHOLDER] How sensitive is your skin to sun or heat?",
    options: [
      { id: "dries-out", label: "[PLACEHOLDER] Dries out quickly", doshaWeights: { vata: 2 } },
      { id: "burns-easily", label: "[PLACEHOLDER] Burns or reddens easily", doshaWeights: { pitta: 2 } },
      { id: "tolerates-well", label: "[PLACEHOLDER] Tolerates it well", doshaWeights: { kapha: 2 } },
    ],
  },
];
