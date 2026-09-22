import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { sendQuizResultEmail } from "@/lib/email/sendQuizResultEmail";
import type { SkinType } from "@/lib/quiz/types";

import { parseQuizResponsePayload } from "./validate";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let data: Prisma.QuizResponseCreateInput;
  try {
    data = parseQuizResponsePayload(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return Response.json({ error: message }, { status: 400 });
  }

  const quizResponse = await db.quizResponse.create({ data });

  await sendQuizResultEmail({ to: quizResponse.email, skinType: quizResponse.skinType as SkinType });

  return Response.json({ id: quizResponse.id }, { status: 201 });
}
