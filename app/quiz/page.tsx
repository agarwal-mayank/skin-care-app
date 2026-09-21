import QuizFlow from "./_components/QuizFlow";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center px-6 py-16">
        <QuizFlow />
      </main>
    </div>
  );
}
