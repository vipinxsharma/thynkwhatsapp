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
      finishType: "cloud_api",
    });
    expect(parseSignupSessionEvent("https://web.facebook.com", finish)).toMatchObject({
      kind: "finish",
    });
  });

  it("accepts other facebook.com subdomains and FINISH variants", () => {
    expect(parseSignupSessionEvent("https://business.facebook.com", finish)).toMatchObject({ kind: "finish" });
    expect(parseSignupSessionEvent("https://www.facebook.com", { ...finish, event: "FINISH_ONLY_WABA" })).toMatchObject({
      kind: "finish",
      wabaId: "123456789",
    });
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      ...finish,
      event: "FINISH_ONLY_WABA",
      data: { waba_id: "123456789" },
    })).toEqual({ kind: "incomplete" });
  });

  it("ignores messages from other origins and unrelated events", () => {
    expect(parseSignupSessionEvent("https://evil.example", finish)).toBeNull();
    expect(parseSignupSessionEvent("https://facebook.com.evil.example", finish)).toBeNull();
    expect(parseSignupSessionEvent("http://www.facebook.com", finish)).toBeNull();
    expect(parseSignupSessionEvent("https://notfacebook.com", finish)).toBeNull();
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

  it("marks WhatsApp Business app onboarding and keeps the customer's business ID", () => {
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      ...finish,
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { ...finish.data, business_id: "2729063490586005" },
    })).toEqual({
      kind: "finish",
      wabaId: "123456789",
      phoneNumberId: "987654321",
      finishType: "business_app",
      businessId: "2729063490586005",
    });
  });

  it("carries Meta's abandoned step and reported error details", () => {
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: { current_step: "PHONE_NUMBER_SETUP" },
    })).toEqual({ kind: "cancel", currentStep: "PHONE_NUMBER_SETUP" });
    expect(parseSignupSessionEvent("https://www.facebook.com", {
      type: "WA_EMBEDDED_SIGNUP",
      event: "ERROR",
      data: { error_message: "Your verified name violates WhatsApp guidelines.", error_code: 524126, session_id: "f34b51dab5e0498" },
    })).toEqual({
      kind: "error",
      errorMessage: "Your verified name violates WhatsApp guidelines.",
      errorCode: "524126",
      sessionId: "f34b51dab5e0498",
    });
  });
});
