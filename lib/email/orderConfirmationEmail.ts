import { getFirstName } from "@/lib/checkout/indianAddress";
import { formatPrice, getPackageForSkinType } from "@/lib/quiz/packages";
import type { SkinType } from "@/lib/quiz/types";

import { escapeHtml } from "./escapeHtml";

// Order confirmation, sent once when an Order becomes "paid". Tone reuses the
// founder-approved thank-you copy (architecture Open questions, "Option A").
// This is NOT a tax invoice — the business issues GST invoices separately — so
// don't add invoice/tax wording here.
// Package + price come from lib/quiz/packages.ts (config); the name and
// address are user input and MUST be HTML-escaped in the html body.

export interface OrderShippingDetails {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string | null;
  city: string;
  state: string;
  pinCode: string;
}

export interface OrderConfirmationEmailInput {
  orderId: string;
  skinType: SkinType;
  shipping: OrderShippingDetails;
}

export interface OrderConfirmationEmailContent {
  subject: string;
  html: string;
  text: string;
}

function addressLines(shipping: OrderShippingDetails): string[] {
  return [
    shipping.fullName,
    shipping.addressLine1,
    shipping.addressLine2,
    ...(shipping.landmark ? [`Landmark: ${shipping.landmark}`] : []),
    `${shipping.city}, ${shipping.state} ${shipping.pinCode}`,
  ];
}

export function buildOrderConfirmationEmail({
  orderId,
  skinType,
  shipping,
}: OrderConfirmationEmailInput): OrderConfirmationEmailContent {
  const skinPackage = getPackageForSkinType(skinType);
  const price = formatPrice(skinPackage.priceInCents, skinPackage.currency);
  const firstName = getFirstName(shipping.fullName);
  const greeting = firstName ? `Thank you, ${firstName}!` : "Thank you!";
  const lines = addressLines(shipping);

  const productItems = skinPackage.products.map((product) => `<li>${product}</li>`).join("");
  const productLines = skinPackage.products.map((product) => `- ${product}`).join("\n");

  const html = [
    `<p><strong>${escapeHtml(greeting)}</strong></p>`,
    `<p>Your bundle is being lovingly packed, just for you. We'll let you know the moment it's on its way.</p>`,
    `<p>Order reference: <strong>${escapeHtml(orderId)}</strong></p>`,
    `<p><strong>${skinPackage.name}</strong> (${price})</p>`,
    `<ul>${productItems}</ul>`,
    `<p>Shipping to:<br>${lines.map(escapeHtml).join("<br>")}</p>`,
    `<p>Here's to caring for your skin, gently and in its own way.</p>`,
  ].join("");

  const text = [
    greeting,
    "",
    "Your bundle is being lovingly packed, just for you. We'll let you know the moment it's on its way.",
    "",
    `Order reference: ${orderId}`,
    "",
    `${skinPackage.name} (${price})`,
    productLines,
    "",
    "Shipping to:",
    ...lines,
    "",
    "Here's to caring for your skin, gently and in its own way.",
  ].join("\n");

  return { subject: "Your order is confirmed", html, text };
}
