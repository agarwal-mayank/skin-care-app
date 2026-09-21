import type { Prisma } from "@prisma/client";

import type { Gender, SkinType } from "@/lib/quiz/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GENDERS: Gender[] = ["female", "male", "other"];
const VALID_SKIN_TYPES: SkinType[] = ["dry", "sensitive", "oily"];

export function parseQuizResponsePayload(body: unknown): Prisma.QuizResponseCreateInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }

  const { email, gender, answers, skinType } = body as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    throw new Error("email must be a valid email address");
  }

  if (typeof gender !== "string" || !VALID_GENDERS.includes(gender as Gender)) {
    throw new Error(`gender must be one of ${VALID_GENDERS.join(", ")}`);
  }

  if (typeof skinType !== "string" || !VALID_SKIN_TYPES.includes(skinType as SkinType)) {
    throw new Error(`skinType must be one of ${VALID_SKIN_TYPES.join(", ")}`);
  }

  if (typeof answers !== "object" || answers === null || Array.isArray(answers) || Object.keys(answers).length === 0) {
    throw new Error("answers must be a non-empty object of question id -> option id");
  }

  for (const [questionId, optionId] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof optionId !== "string") {
      throw new Error(`answers.${questionId} must be a string option id`);
    }
  }

  return {
    email,
    gender,
    answers: answers as Record<string, string>,
    skinType,
  };
}
