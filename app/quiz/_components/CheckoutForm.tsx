"use client";

import Script from "next/script";
import { useState, type FormEvent } from "react";

import { INDIAN_STATES, isValidPinCode, normalizeIndianPhone } from "@/lib/checkout/indianAddress";
import { formatPrice } from "@/lib/quiz/packages";

// Razorpay Checkout is loaded as a global from checkout.razorpay.com; this
// component never imports the provider SDK (architecture swap rule 1). It only
// uses the order id + public Key ID our /api/checkout returns.
interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open(): void };
  }
}

interface CheckoutSession {
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  packageName: string;
  prefill: { name: string; email: string; contact: string };
}

export interface PaidDetails {
  firstName: string;
  email: string;
}

interface CheckoutFormProps {
  quizResponseId: string;
  onPaid: (details: PaidDetails) => void;
}

const INPUT_CLASS =
  "rounded-lg border border-black/[.08] bg-white px-4 py-2 text-base text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/[.145] dark:bg-black dark:text-zinc-50";
const LABEL_CLASS = "text-sm font-medium text-black dark:text-zinc-50";
const PRIMARY_BUTTON_CLASS =
  "flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#ccc]";

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pinCode: "",
};

type FormFields = typeof EMPTY_FORM;

export default function CheckoutForm({ quizResponseId, onPaid }: CheckoutFormProps) {
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [scriptReady, setScriptReady] = useState(false);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(name: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function verifyPayment(response: RazorpaySuccessResponse) {
    try {
      const verifyResponse = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });

      if (!verifyResponse.ok) {
        const errorBody = await verifyResponse.json().catch(() => null);
        throw new Error(errorBody?.error ?? `Request failed with status ${verifyResponse.status}`);
      }

      onPaid((await verifyResponse.json()) as PaidDetails);
    } catch (err) {
      console.error("Failed to verify payment:", err);
      setError(
        "We couldn't confirm your payment yet. If money was deducted, you'll receive a confirmation email shortly.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  function openCheckout(checkout: CheckoutSession) {
    if (!window.Razorpay) {
      setError("The payment window hasn't loaded yet. Please try again in a moment.");
      return;
    }

    setError(null);
    setIsPaying(true);
    new window.Razorpay({
      key: checkout.keyId,
      amount: checkout.amount,
      currency: checkout.currency,
      order_id: checkout.razorpayOrderId,
      name: "Savyasachi Ayurveda",
      description: checkout.packageName,
      prefill: checkout.prefill,
      handler: (response) => {
        void verifyPayment(response);
      },
      modal: { ondismiss: () => setIsPaying(false) },
    }).open();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalizeIndianPhone(fields.phone) === null) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!isValidPinCode(fields.pinCode)) {
      setError("Please enter a valid 6-digit PIN code.");
      return;
    }
    if (!fields.state) {
      setError("Please choose your state.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizResponseId, ...fields }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? `Request failed with status ${response.status}`);
      }

      const checkout = (await response.json()) as CheckoutSession;
      setSession(checkout);
      openCheckout(checkout);
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setError("Something went wrong starting your checkout. Please check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const script = (
    <Script
      src="https://checkout.razorpay.com/v1/checkout.js"
      strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
      onError={() => setError("Couldn't load the payment window. Please refresh the page and try again.")}
    />
  );

  // Once the order exists, reopen the modal for the SAME Razorpay order rather
  // than creating a new Order on every click.
  const content = session ? (
    <div className="flex flex-col gap-3">
      <p className="text-base text-zinc-700 dark:text-zinc-300">
        Shipping to {session.prefill.name}, {fields.city}. Total{" "}
        <strong>{formatPrice(session.amount, session.currency)}</strong> (shipping included).
      </p>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={() => openCheckout(session)}
        disabled={isPaying || !scriptReady}
        className={PRIMARY_BUTTON_CLASS}
      >
        {isPaying ? "Waiting for payment…" : "Complete payment"}
      </button>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Delivery details</h3>

      <label htmlFor="fullName" className={LABEL_CLASS}>
        Full name
      </label>
      <input
        id="fullName"
        required
        autoComplete="name"
        value={fields.fullName}
        onChange={(e) => update("fullName", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="phone" className={LABEL_CLASS}>
        Mobile number
      </label>
      <input
        id="phone"
        type="tel"
        required
        inputMode="numeric"
        autoComplete="tel"
        placeholder="10-digit mobile number"
        value={fields.phone}
        onChange={(e) => update("phone", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="addressLine1" className={LABEL_CLASS}>
        Flat / House no. / Building
      </label>
      <input
        id="addressLine1"
        required
        autoComplete="address-line1"
        value={fields.addressLine1}
        onChange={(e) => update("addressLine1", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="addressLine2" className={LABEL_CLASS}>
        Area / Street / Locality
      </label>
      <input
        id="addressLine2"
        required
        autoComplete="address-line2"
        value={fields.addressLine2}
        onChange={(e) => update("addressLine2", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="landmark" className={LABEL_CLASS}>
        Landmark (optional)
      </label>
      <input
        id="landmark"
        value={fields.landmark}
        onChange={(e) => update("landmark", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="city" className={LABEL_CLASS}>
        City
      </label>
      <input
        id="city"
        required
        autoComplete="address-level2"
        value={fields.city}
        onChange={(e) => update("city", e.target.value)}
        className={INPUT_CLASS}
      />

      <label htmlFor="state" className={LABEL_CLASS}>
        State
      </label>
      <select
        id="state"
        required
        autoComplete="address-level1"
        value={fields.state}
        onChange={(e) => update("state", e.target.value)}
        className={INPUT_CLASS}
      >
        <option value="" disabled>
          Choose your state
        </option>
        {INDIAN_STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>

      <label htmlFor="pinCode" className={LABEL_CLASS}>
        PIN code
      </label>
      <input
        id="pinCode"
        required
        inputMode="numeric"
        maxLength={6}
        autoComplete="postal-code"
        value={fields.pinCode}
        onChange={(e) => update("pinCode", e.target.value)}
        className={INPUT_CLASS}
      />

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button type="submit" disabled={isSubmitting || !scriptReady} className={PRIMARY_BUTTON_CLASS}>
        {isSubmitting ? "Starting checkout…" : scriptReady ? "Continue to payment" : "Loading payment…"}
      </button>
    </form>
  );

  return (
    <>
      {script}
      {content}
    </>
  );
}
