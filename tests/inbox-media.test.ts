import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  mediaTypeForMime,
  safeMediaFilename,
  validateMediaFile,
} from "../lib/inbox/media";
import { MetaGraphClient } from "../lib/meta/client";

describe("media file rules", () => {
  it("maps WhatsApp-deliverable MIME types to message types", () => {
    expect(mediaTypeForMime("image/jpeg")).toBe("image");
    expect(mediaTypeForMime("VIDEO/MP4")).toBe("video");
    expect(mediaTypeForMime("application/pdf")).toBe("document");
    expect(mediaTypeForMime("application/x-msdownload")).toBeNull();
    expect(mediaTypeForMime("text/html")).toBeNull();
  });

  it("refuses empty, oversize, unsupported and mismatched files", () => {
    expect(validateMediaFile({ size: 0, type: "image/png" }, "image")).toMatch(/empty/);
    expect(validateMediaFile({ size: MAX_MEDIA_UPLOAD_BYTES + 1, type: "image/png" }, "image")).toMatch(/MB or smaller/);
    expect(validateMediaFile({ size: 10, type: "text/html" }, "document")).toMatch(/cannot be sent/);
    expect(validateMediaFile({ size: 10, type: "application/pdf" }, "image")).toMatch(/only be sent as a document/);
  });

  it("accepts a file at the size limit with the right type", () => {
    expect(validateMediaFile({ size: MAX_MEDIA_UPLOAD_BYTES, type: "video/mp4" }, "video")).toBeNull();
  });

  it("keeps display filenames free of path separators and control characters", () => {
    expect(safeMediaFilename("../../secret/report.pdf", "document")).toBe("....secretreport.pdf");
    expect(safeMediaFilename("a\u0000b.pdf", "document")).toBe("ab.pdf");
    expect(safeMediaFilename("   ", "document")).toBe("document");
    expect(safeMediaFilename("x".repeat(400), "document")).toHaveLength(255);
  });
});

describe("Meta media calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads a file to the sender number's media store as multipart form data", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1234567890123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MetaGraphClient("live-token").uploadMedia("5550001111", {
      bytes: new Blob(["png-bytes"], { type: "image/png" }),
      mimeType: "image/png",
      filename: "photo.png",
    });

    expect(result).toEqual({ id: "1234567890123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/5550001111\/media$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer live-token");
    const form = init.body as FormData;
    expect(form.get("messaging_product")).toBe("whatsapp");
    expect(form.get("type")).toBe("image/png");
    expect((form.get("file") as File).name).toBe("photo.png");
  });

  it("fails cleanly when Meta returns no media ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    await expect(new MetaGraphClient("live-token").uploadMedia("5550001111", {
      bytes: new Blob(["x"]), mimeType: "image/png", filename: "a.png",
    })).rejects.toThrow(/media ID/);
  });

  it("resolves a media ID to a download URL before streaming the bytes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: "https://lookaside.example.net/file", mime_type: "video/mp4",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("video-bytes", { status: 200, headers: { "content-length": "11" } }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await new MetaGraphClient("live-token").fetchMedia("1234567890123");

    expect(file.mimeType).toBe("video/mp4");
    expect(file.contentLength).toBe(11);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/1234567890123$/);
    expect(fetchMock.mock.calls[1][0]).toBe("https://lookaside.example.net/file");
    for (const call of fetchMock.mock.calls) {
      expect(((call[1] as RequestInit).headers as Record<string, string>).Authorization).toBe("Bearer live-token");
    }
    expect(await new Response(file.body).text()).toBe("video-bytes");
  });

  it("refuses to fetch a non-numeric media ID", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new MetaGraphClient("live-token").fetchMedia("../../me")).rejects.toThrow(/Invalid media ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
