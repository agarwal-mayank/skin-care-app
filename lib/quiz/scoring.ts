import type { Dosha, QuizAnswers, QuizQuestion, ScoringResult, SkinType } from "@/lib/quiz/types";

const DOSHAS: Dosha[] = ["vata", "pitta", "kapha"];

// Fixed, arbitrary tie-break order — no domain basis yet (see plan's Open
// Questions). Revisit once the real scoring framework is provided.
const TIE_BREAK_ORDER: Dosha[] = ["vata", "pitta", "kapha"];

// Simple 1:1 mapping, no "combination" type — an assumption, not a founder
// decision (see plan's Open Questions).
const DOSHA_TO_SKIN_TYPE: Record<Dosha, SkinType> = {
  vata: "dry",
  pitta: "sensitive",
  kapha: "oily",
};

export function scoreQuiz(answers: QuizAnswers, questions: QuizQuestion[]): ScoringResult {
  const scores: Record<Dosha, number> = { vata: 0, pitta: 0, kapha: 0 };

  for (const [questionId, optionId] of Object.entries(answers.responses)) {
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error(`scoreQuiz: unknown questionId "${questionId}"`);
    }

    const option = question.options.find((o) => o.id === optionId);
    if (!option) {
      throw new Error(`scoreQuiz: unknown optionId "${optionId}" for question "${questionId}"`);
    }

    for (const dosha of DOSHAS) {
      scores[dosha] += option.doshaWeights[dosha] ?? 0;
    }
  }

  const dominantDosha = TIE_BREAK_ORDER.reduce((best, candidate) =>
    scores[candidate] > scores[best] ? candidate : best,
  );

  return {
    dominantDosha,
    skinType: DOSHA_TO_SKIN_TYPE[dominantDosha],
    scores,
  };
}
