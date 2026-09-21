import { describe, expect, it } from "vitest";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { QuizAnswers, QuizQuestion } from "@/lib/quiz/types";

// Local fixtures, deliberately independent of lib/quiz/questions.ts's
// placeholder content, so these tests stay valid when the real content
// replaces the placeholders later.
const fixtureQuestions: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "Fixture question 1",
    options: [
      { id: "q1-vata", label: "Vata leaning", doshaWeights: { vata: 2 } },
      { id: "q1-pitta", label: "Pitta leaning", doshaWeights: { pitta: 2 } },
      { id: "q1-kapha", label: "Kapha leaning", doshaWeights: { kapha: 2 } },
      { id: "q1-mixed", label: "Pitta and Vata leaning", doshaWeights: { pitta: 1, vata: 1 } },
    ],
  },
  {
    id: "q2",
    prompt: "Fixture question 2",
    options: [
      { id: "q2-vata", label: "Vata leaning", doshaWeights: { vata: 3 } },
      { id: "q2-pitta", label: "Pitta leaning", doshaWeights: { pitta: 3 } },
      { id: "q2-kapha", label: "Kapha leaning", doshaWeights: { kapha: 3 } },
    ],
  },
];

function makeAnswers(responses: Record<string, string>): QuizAnswers {
  return { gender: "other", responses };
}

describe("scoreQuiz", () => {
  it("scores a dominant Vata result", () => {
    const result = scoreQuiz(makeAnswers({ q1: "q1-vata", q2: "q2-vata" }), fixtureQuestions);
    expect(result.dominantDosha).toBe("vata");
    expect(result.skinType).toBe("dry");
  });

  it("scores a dominant Pitta result", () => {
    const result = scoreQuiz(makeAnswers({ q1: "q1-pitta", q2: "q2-pitta" }), fixtureQuestions);
    expect(result.dominantDosha).toBe("pitta");
    expect(result.skinType).toBe("sensitive");
  });

  it("scores a dominant Kapha result", () => {
    const result = scoreQuiz(makeAnswers({ q1: "q1-kapha", q2: "q2-kapha" }), fixtureQuestions);
    expect(result.dominantDosha).toBe("kapha");
    expect(result.skinType).toBe("oily");
  });

  it("sums weights across an option that spans two doshas", () => {
    // q1-mixed contributes pitta:1, vata:1; q2-vata contributes vata:3 —
    // vata should end up ahead of pitta (4 vs 1), not just "whichever dosha
    // the option belongs to".
    const result = scoreQuiz(makeAnswers({ q1: "q1-mixed", q2: "q2-vata" }), fixtureQuestions);
    expect(result.scores).toEqual({ vata: 4, pitta: 1, kapha: 0 });
    expect(result.dominantDosha).toBe("vata");
  });

  it("breaks an exact tie using the fixed vata > pitta > kapha order", () => {
    // Every dosha ends at 0 — an exact tie.
    const result = scoreQuiz(makeAnswers({}), fixtureQuestions);
    expect(result.scores).toEqual({ vata: 0, pitta: 0, kapha: 0 });
    expect(result.dominantDosha).toBe("vata");
  });

  it("throws on an unknown questionId", () => {
    expect(() => scoreQuiz(makeAnswers({ "not-a-question": "q1-vata" }), fixtureQuestions)).toThrow();
  });

  it("throws on an unknown optionId for a known question", () => {
    expect(() => scoreQuiz(makeAnswers({ q1: "not-an-option" }), fixtureQuestions)).toThrow();
  });
});
