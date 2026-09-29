import {
  isIndianState,
  isValidPinCode,
  normalizeIndianPhone,
  type IndianState,
} from "@/lib/checkout/indianAddress";

export interface CheckoutPayload {
  quizResponseId: string;
  phone: string; // normalized E.164 (+91XXXXXXXXXX)
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string | null;
  city: string;
  state: IndianState;
  pinCode: string;
}

const MAX_FIELD_LENGTH = 200;
const MAX_NAME_LENGTH = 100;

// Error messages never echo the submitted value — phone/address are PII.
function requireText(fields: Record<string, unknown>, name: string, maxLength = MAX_FIELD_LENGTH): string {
  const value = fields[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${name} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

// Amount, currency, email and skinType are intentionally NOT read from the
// body: the price comes from lib/quiz/packages.ts via the stored QuizResponse.
export function parseCheckoutPayload(body: unknown): CheckoutPayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }

  const fields = body as Record<string, unknown>;

  const quizResponseId = requireText(fields, "quizResponseId");
  const fullName = requireText(fields, "fullName", MAX_NAME_LENGTH);

  if (typeof fields.phone !== "string") {
    throw new Error("phone is required");
  }
  const phone = normalizeIndianPhone(fields.phone);
  if (phone === null) {
    throw new Error("phone must be a valid 10-digit Indian mobile number");
  }

  const addressLine1 = requireText(fields, "addressLine1");
  const addressLine2 = requireText(fields, "addressLine2");
  const city = requireText(fields, "city");

  let landmark: string | null = null;
  if (fields.landmark !== undefined && fields.landmark !== null) {
    if (typeof fields.landmark !== "string") {
      throw new Error("landmark must be a string");
    }
    const trimmed = fields.landmark.trim();
    if (trimmed.length > MAX_FIELD_LENGTH) {
      throw new Error(`landmark must be at most ${MAX_FIELD_LENGTH} characters`);
    }
    landmark = trimmed === "" ? null : trimmed;
  }

  const state = requireText(fields, "state");
  if (!isIndianState(state)) {
    throw new Error("state must be an Indian state or union territory");
  }

  const pinCode = requireText(fields, "pinCode");
  if (!isValidPinCode(pinCode)) {
    throw new Error("pinCode must be a valid 6-digit PIN code");
  }

  return { quizResponseId, phone, fullName, addressLine1, addressLine2, landmark, city, state, pinCode };
}
