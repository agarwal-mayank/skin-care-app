"use client";

import { useState } from "react";

import { questions } from "@/lib/quiz/questions";
import { scoreQuiz } from "@/lib/quiz/scoring";
import type { Gender, QuizAnswers, ScoringResult } from "@/lib/quiz/types";

import QuestionStep from "./QuestionStep";
import ResultScreen from "./ResultScreen";

export function resolveGender(responses: Record<string, string>): Gender {
  const gender = responses.gender;
  if (gender !== "female" && gender !== "male" && gender !== "other") {
    throw new Error(`QuizFlow: missing/invalid gender answer: ${gender}`);
  }
  return gender;
}

export default function QuizFlow() {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [step, setStep] = useState<number | "result">(0);
  const [result, setResult] = useState<ScoringResult | null>(null);

  if (step === "result") {
    return result ? <ResultScreen result={result} gender={resolveGender(responses)} answers={responses} /> : null;
  }

  const currentQuestion = questions[step];
  const selectedOptionId = responses[currentQuestion.id];
  const isLastQuestion = step === questions.length - 1;

  function handleSelect(optionId: string) {
    setResponses((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  }

  function handleNext() {
    if (!selectedOptionId) return;

    if (isLastQuestion) {
      const answers: QuizAnswers = { gender: resolveGender(responses), responses };
      setResult(scoreQuiz(answers, questions));
      setStep("result");
      return;
    }

    setStep((prev) => (prev === "result" ? prev : prev + 1));
  }

  function handleBack() {
    setStep((prev) => (prev === "result" || prev === 0 ? prev : prev - 1));
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Question {step + 1} of {questions.length}
      </p>
      <QuestionStep question={currentQuestion} selectedOptionId={selectedOptionId} onSelect={handleSelect} />
      <div className="flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-6 text-base font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedOptionId}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]"
        >
          {isLastQuestion ? "See my result" : "Next"}
        </button>
      </div>
    </div>
  );
}
