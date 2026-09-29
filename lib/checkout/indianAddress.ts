// Pure, client-safe helpers for the Indian shipping address + phone captured at
// "Buy Now". Shared by CheckoutForm (hints + state dropdown) and the checkout
// route's validator — keep this free of db/env imports.

// 28 states + 8 union territories.
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export function isIndianState(value: string): value is IndianState {
  return (INDIAN_STATES as readonly string[]).includes(value);
}

// Accepts a 10-digit Indian mobile (starting 6-9), optionally prefixed with
// +91, 91 or 0, with spaces/dashes/parentheses. Returns E.164 (+91XXXXXXXXXX)
// — the format Razorpay's prefill.contact expects — or null if invalid.
export function normalizeIndianPhone(input: string): string | null {
  const stripped = input.replace(/[\s\-()]/g, "");

  let digits: string;
  if (stripped.startsWith("+91")) {
    digits = stripped.slice(3);
  } else if (stripped.startsWith("91") && stripped.length === 12) {
    digits = stripped.slice(2);
  } else if (stripped.startsWith("0") && stripped.length === 11) {
    digits = stripped.slice(1);
  } else {
    digits = stripped;
  }

  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function isValidPinCode(input: string): boolean {
  return /^[1-9]\d{5}$/.test(input.trim());
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
