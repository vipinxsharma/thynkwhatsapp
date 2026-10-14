import { describe, expect, it } from "vitest";
import { parseSignupSessionEvent } from "../lib/meta/embedded-signup-session";

describe("Meta Embedded Signup session message", () => {
  const finish = {
    type: "WA_EMBEDDED_SIGNUP",
    event: "FINISH",
    data: { waba_id: "123456789", phone_number_id: "987654321" },
  };

  it("extracts the actual WABA and phone IDs from Meta's finish event", () => {
    expect(parseSignupSessionEvent("https://www.facebook.com", JSON.stringify(finish))).toEqual({
      kind: "finish",
      wabaId: "123456789",
      phoneNumberId: "987654321",
    });
    expect(parseSignupSessionEvent("https://web.facebook.com", finish)).toMatchObject({
      kind: "finish",
    });
  });

  it("ignores messages from other origins and unrelated events", () => {
    expect(parseSignupSessionEvent("https://evil.example", finish)).toBeNull();
    expect(parseSignupSessionEvent("https://www.facebook.com", { ...finish, type: "OTHER" })).toBeNull();
    expect(parseSignupSessionEvent("https://www.facebook.com", "not json")).toBeNull();
  });

  it("does not accept a WABA without a valid phone number", () => {
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      ...finish,
      data: { waba_id: "123456789" },
    })).toEqual({ kind: "incomplete" });
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      ...finish,
      data: { waba_id: "123456789", phone_number_id: "not-an-id" },
    })).toEqual({ kind: "incomplete" });
  });

  it("recognizes cancellation and error without treating them as success", () => {
    expect(parseSignupSessionEvent("https://www.facebook.com", { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL" })).toEqual({ kind: "cancel" });
    expect(parseSignupSessionEvent("https://www.facebook.com", { type: "WA_EMBEDDED_SIGNUP", event: "ERROR" })).toEqual({ kind: "error" });
  });
});
