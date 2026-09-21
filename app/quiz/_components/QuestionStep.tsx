"use client";

import type { QuizQuestion } from "@/lib/quiz/types";

interface QuestionStepProps {
  question: QuizQuestion;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}

export default function QuestionStep({ question, selectedOptionId, onSelect }: QuestionStepProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">{question.prompt}</h2>
      <div className="flex flex-col gap-3">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id)}
              className={`rounded-lg border px-5 py-3 text-left text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-black/[.08] bg-white text-black hover:border-black/[.2] dark:border-white/[.145] dark:bg-black dark:text-zinc-50 dark:hover:border-white/[.3]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
