import { describe, expect, it } from "vitest";
import {
  buttonTapFromMessage,
  campaignRefFromPayload,
  csvCell,
  csvText,
  endOfDayExclusive,
  leadsToCsv,
  normalizeStageName,
  parseDateOnly,
} from "../lib/leads/rules";

describe("buttonTapFromMessage", () => {
  it("reads an interactive button reply", () => {
    const tap = buttonTapFromMessage({
      id: "wamid.BUTTON1",
      type: "interactive",
      timestamp: "1767225600",
      context: { id: "wamid.OUTBOUND1" },
      interactive: { type: "button_reply", button_reply: { id: "campaign:camp_42", title: "Yes, call me" } },
    });
    expect(tap).toEqual({
      source: "interactive_button",
      wamId: "wamid.BUTTON1",
      buttonText: "Yes, call me",
      buttonPayload: "campaign:camp_42",
      contextWamId: "wamid.OUTBOUND1",
      campaignRef: "camp_42",
      tappedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("reads a template quick-reply tap", () => {
    const tap = buttonTapFromMessage({
      id: "wamid.TPL1",
      type: "button",
      timestamp: "1767225600",
      button: { text: "Interested", payload: "interested" },
    });
    expect(tap?.source).toBe("template_button");
    expect(tap?.buttonText).toBe("Interested");
    expect(tap?.campaignRef).toBeNull();
    expect(tap?.contextWamId).toBeNull();
  });

  it("ignores list replies, text and other message types", () => {
    expect(buttonTapFromMessage({ id: "a", type: "text", timestamp: "1" })).toBeNull();
    expect(
      buttonTapFromMessage({
        id: "b",
        type: "interactive",
        timestamp: "1",
        interactive: { type: "list_reply", button_reply: undefined },
      }),
    ).toBeNull();
  });

  it("returns null when the tap has neither text nor payload", () => {
    expect(buttonTapFromMessage({ id: "c", type: "button", timestamp: "1", button: { text: "", payload: "" } })).toBeNull();
  });
});

describe("campaignRefFromPayload", () => {
  it("extracts the id from a campaign payload", () => {
    expect(campaignRefFromPayload("campaign:abc_123-XYZ")).toBe("abc_123-XYZ");
  });

  it("returns null for other payloads", () => {
    expect(campaignRefFromPayload("interested")).toBeNull();
    expect(campaignRefFromPayload("campaign:")).toBeNull();
    expect(campaignRefFromPayload("campaign:has spaces")).toBeNull();
  });
});

describe("normalizeStageName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeStageName("  Warm   lead ")).toEqual({ ok: true, name: "Warm lead" });
  });

  it("rejects empty, non-string and overlong names", () => {
    expect(normalizeStageName("   ").ok).toBe(false);
    expect(normalizeStageName(42).ok).toBe(false);
    expect(normalizeStageName("x".repeat(61)).ok).toBe(false);
    expect(normalizeStageName("x".repeat(60)).ok).toBe(true);
  });
});

describe("date range parsing", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(parseDateOnly("2026-02-28")).toBe("2026-02-28");
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("28/02/2026")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it("makes an inclusive end date exclusive at the next midnight UTC", () => {
    expect(endOfDayExclusive("2026-12-31")).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("CSV output", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Rao, "Vipin"')).toBe('"Rao, ""Vipin"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises spreadsheet formulas in free text", () => {
    expect(csvText('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvText("+91 98765")).toBe("'+91 98765");
    expect(csvText("@admin")).toBe("'@admin");
    expect(csvText("Asha")).toBe("Asha");
  });

  it("leaves phone numbers unguarded", () => {
    expect(csvCell("+919876543210")).toBe("+919876543210");
  });

  it("renders a header and one line per lead", () => {
    const csv = leadsToCsv([
      {
        name: "Asha",
        phoneNumber: "+919876543210",
        stageName: "New",
        source: "template_button",
        campaignRef: null,
        lastButtonText: "Interested",
        tapCount: 2,
        firstTappedAt: "2026-01-01T00:00:00Z",
        lastTappedAt: "2026-01-02T00:00:00Z",
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Name,Phone,Stage,Source,Campaign,Last button,Taps,First tap (UTC),Last tap (UTC)");
    expect(lines[1]).toBe(
      "Asha,+919876543210,New,template_button,,Interested,2,2026-01-01T00:00:00Z,2026-01-02T00:00:00Z",
    );
  });
});
