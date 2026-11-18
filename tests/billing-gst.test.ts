import { describe, expect, it } from "vitest";
import { computeGst, creditNoteSplit, gstinCheckCharacter, isValidGstin, GST_STATE_CODES } from "../lib/billing/gst";
import { financialYearFor } from "../lib/billing/invoices";
import { parseBuyerTaxInput } from "../lib/billing/taxProfile";
import { sellerTaxConfig } from "../lib/billing/seller";

describe("GSTIN validation", () => {
  it("accepts a GSTIN whose check character matches", () => {
    const body = "27AAPFU0939F1Z";
    const check = gstinCheckCharacter(body);
    expect(isValidGstin(`${body}${check}`)).toBe(true);
  });

  it("rejects a wrong check character, bad shape or unknown state", () => {
    const body = "27AAPFU0939F1Z";
    const check = gstinCheckCharacter(body);
    const wrong = check === "0" ? "1" : "0";
    expect(isValidGstin(`${body}${wrong}`)).toBe(false);
    expect(isValidGstin("27aapfu0939f1zv")).toBe(false);
    expect(isValidGstin("99AAPFU0939F1Z" + check)).toBe(false);
    expect(isValidGstin("27AAPFU0939F1ZV" + "X")).toBe(false);
  });

  it("knows the GST state codes", () => {
    expect(GST_STATE_CODES["27"]).toBe("Maharashtra");
    expect(GST_STATE_CODES["07"]).toBe("Delhi");
  });
});

describe("GST split", () => {
  it("splits intra-state supply into equal CGST and SGST at 18 percent total", () => {
    const tax = computeGst({ basePaise: 200_000, sellerStateCode: "27", buyerStateCode: "27" });
    expect(tax.rateSplit).toBe("intra_state");
    expect(tax.cgstPaise).toBe(18_000);
    expect(tax.sgstPaise).toBe(18_000);
    expect(tax.igstPaise).toBe(0);
    expect(tax.totalInrPaise).toBe(236_000);
  });

  it("charges IGST for inter-state supply", () => {
    const tax = computeGst({ basePaise: 200_000, sellerStateCode: "27", buyerStateCode: "29" });
    expect(tax.rateSplit).toBe("inter_state");
    expect(tax.igstPaise).toBe(36_000);
    expect(tax.cgstPaise + tax.sgstPaise).toBe(0);
    expect(tax.totalInrPaise).toBe(236_000);
  });

  it("keeps the components summing to the total when rounding", () => {
    const tax = computeGst({ basePaise: 100_001, sellerStateCode: "27", buyerStateCode: "27" });
    expect(tax.cgstPaise + tax.sgstPaise + tax.baseInrPaise).toBe(tax.totalInrPaise);
  });

  it("rejects non-integer or non-positive amounts", () => {
    expect(() => computeGst({ basePaise: 10.5, sellerStateCode: "27", buyerStateCode: "27" })).toThrow();
    expect(() => computeGst({ basePaise: 0, sellerStateCode: "27", buyerStateCode: "27" })).toThrow();
  });
});

describe("credit notes", () => {
  const invoice = { baseInrPaise: 200_000, cgstPaise: 18_000, sgstPaise: 18_000, igstPaise: 0, totalInrPaise: 236_000 };

  it("reverses base and tax in the original proportion", () => {
    const split = creditNoteSplit({ invoice, grossPaise: 118_000 });
    expect(split.basePaise + split.cgstPaise + split.sgstPaise).toBe(118_000);
    expect(split.basePaise).toBe(100_000);
    expect(split.cgstPaise).toBe(9_000);
    expect(split.sgstPaise).toBe(9_000);
  });

  it("refuses credits above the invoice total or non-positive amounts", () => {
    expect(() => creditNoteSplit({ invoice, grossPaise: 236_001 })).toThrow("exceed");
    expect(() => creditNoteSplit({ invoice, grossPaise: 0 })).toThrow();
  });
});

describe("financial year", () => {
  it("runs April to March in IST", () => {
    expect(financialYearFor(new Date("2026-04-01T00:00:00+05:30"))).toBe("2026-27");
    expect(financialYearFor(new Date("2026-03-31T23:59:00+05:30"))).toBe("2025-26");
    expect(financialYearFor(new Date("2026-03-31T19:00:00Z"))).toBe("2026-27");
  });
});

describe("buyer tax input", () => {
  const base = { legalName: "Acme Pvt Ltd", address: "1 Main Road, Mumbai", stateCode: "27" };

  it("accepts an individual buyer without GSTIN", () => {
    const result = parseBuyerTaxInput(base);
    expect(result.ok && result.value.gstin).toBe(null);
  });

  it("requires the GSTIN state to match the chosen state", () => {
    const check = gstinCheckCharacter("29AAPFU0939F1Z");
    const result = parseBuyerTaxInput({ ...base, gstin: `29AAPFU0939F1Z${check}` });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid GSTIN", () => {
    expect(parseBuyerTaxInput({ ...base, gstin: "27AAPFU0939F1ZZ" }).ok).toBe(false);
  });
});

describe("seller tax config", () => {
  it("is null until all seller details are set, so no one is charged without an invoice", () => {
    expect(sellerTaxConfig({})).toBeNull();
    const check = gstinCheckCharacter("27AAPFU0939F1Z");
    const config = sellerTaxConfig({
      SELLER_LEGAL_NAME: "Xeccel Pvt Ltd",
      SELLER_GSTIN: `27AAPFU0939F1Z${check}`,
      SELLER_ADDRESS: "1 Main Road, Mumbai",
    });
    expect(config?.stateCode).toBe("27");
    expect(config?.sacCode).toBe("998314");
    expect(config?.ratePercent).toBe(18);
  });
});
