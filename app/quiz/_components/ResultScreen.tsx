"use client";

import { useState, type FormEvent } from "react";

import type { ScoringResult } from "@/lib/quiz/types";

interface ResultScreenProps {
  result: ScoringResult;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResultScreen({ result }: ResultScreenProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email)) {
      setError("Please enter a valid email address.");
      setSubmitted(false);
      return;
    }

    setError(null);
    // TODO(TICKET-4): replace this local stub with a POST to /api/quiz-response
    // (sending { email, gender, answers, skinType }) once persistence exists.
    setSubmitted(true);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">Your result</h2>
      <div className="flex flex-col gap-1 text-lg text-zinc-700 dark:text-zinc-300">
        <p>Your skin type: {result.skinType}</p>
        <p>Dominant dosha: {result.dominantDosha}</p>
      </div>

      {submitted ? (
        <p className="text-base text-zinc-700 dark:text-zinc-300">Thanks! We&apos;ll be in touch.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium text-black dark:text-zinc-50">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-black/[.08] bg-white px-4 py-2 text-base text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          />
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
}
