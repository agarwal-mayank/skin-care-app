interface ThankYouScreenProps {
  firstName: string;
  email: string;
}

// Copy is founder-approved ("Option A", architecture doc Open questions) —
// don't reword without checking.
export default function ThankYouScreen({ firstName, email }: ThankYouScreenProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
        {firstName ? `Thank you, ${firstName}!` : "Thank you!"}
      </h2>
      <div className="flex flex-col gap-3 text-lg text-zinc-700 dark:text-zinc-300">
        <p>Your bundle is being lovingly packed, just for you.</p>
        <p>
          We&apos;ve sent your order confirmation to {email}, and we&apos;ll let you know the moment it&apos;s on its
          way.
        </p>
        <p>Here&apos;s to caring for your skin, gently and in its own way.</p>
      </div>
    </div>
  );
}
