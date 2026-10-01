import { afterEach, describe, expect, it, vi } from "vitest";

import type { SkinType } from "@/lib/quiz/types";

const send = vi.fn();
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));

const { sendOrderConfirmationEmail } = await import("./sendOrderConfirmationEmail");

const shipping = {
  fullName: "Priya Sharma",
  addressLine1: "Flat 4B",
  addressLine2: "MG Road",
  landmark: null,
  city: "Bengaluru",
  state: "Karnataka",
  pinCode: "560038",
};

afterEach(() => {
  vi.restoreAllMocks();
  send.mockReset();
});

describe("sendOrderConfirmationEmail", () => {
  it("logs instead of throwing when the email can't be built (e.g. unknown skin type)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendOrderConfirmationEmail({
        to: "buyer@example.com",
        orderId: "ord_1",
        skinType: "retired-type" as SkinType,
        amount: 9900,
        currency: "INR",
        shipping,
      }),
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("ord_1"), expect.anything());
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("buyer@example.com");
  });

  it("sends the built email to the buyer", async () => {
    send.mockResolvedValue({ error: null });

    await sendOrderConfirmationEmail({
      to: "buyer@example.com",
      orderId: "ord_1",
      skinType: "dry",
      amount: 9900,
      currency: "INR",
      shipping,
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["buyer@example.com"] }));
  });
});
