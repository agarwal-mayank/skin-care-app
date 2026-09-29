"use client";

import { useState, type FormEvent } from "react";

import type { Gender, ScoringResult } from "@/lib/quiz/types";
import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";

import CheckoutForm, { type PaidDetails } from "./CheckoutForm";
import ThankYouScreen from "./ThankYouScreen";

interface ResultScreenProps {
  result: ScoringResult;
  gender: Gender;
  answers: Record<string, string>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResultScreen({ result, gender, answers }: ResultScreenProps) {
  const [email, setEmail] = useState("");
  // Set once the QuizResponse is saved — an Order needs it (FK + email), so
  // "Buy Now" only appears after this.
  const [quizResponseId, setQuizResponseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paid, setPaid] = useState<PaidDetails | null>(null);
  const skinPackage = getPackageForSkinType(result.skinType);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quiz-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, gender, answers, skinType: result.skinType }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? `Request failed with status ${response.status}`);
      }

      const { id } = (await response.json()) as { id: string };
      setQuizResponseId(id);
    } catch (err) {
      console.error("Failed to save quiz response:", err);
      setError("Something went wrong saving your result. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (paid) {
    return <ThankYouScreen firstName={paid.firstName} email={paid.email} />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">Your result</h2>
      <div className="flex flex-col gap-1 text-lg text-zinc-700 dark:text-zinc-300">
        <p>Your skin type: {result.skinType}</p>
        <p>Dominant dosha: {result.dominantDosha}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]">
        <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Your recommended package</h3>
        <p className="text-base font-medium text-black dark:text-zinc-50">{skinPackage.name}</p>
        <ul className="list-disc pl-5 text-base text-zinc-700 dark:text-zinc-300">
          {skinPackage.products.map((product) => (
            <li key={product}>{product}</li>
          ))}
        </ul>
        <p className="text-lg font-semibold text-black dark:text-zinc-50">
          {formatPrice(skinPackage.priceInCents, skinPackage.currency)}
        </p>
      </section>

      {quizResponseId ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-zinc-700 dark:text-zinc-300">Thanks! We&apos;ll be in touch.</p>
          {checkoutOpen ? (
            <CheckoutForm quizResponseId={quizResponseId} onPaid={setPaid} />
          ) : (
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]"
            >
              Buy Now
            </button>
          )}
        </div>
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
            disabled={isSubmitting}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
