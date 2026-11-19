import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MAX_MEDIA_UPLOAD_BYTES } from "../lib/inbox/media";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  accept: vi.fn(),
  send: vi.fn(),
  upload: vi.fn(),
  fetchMedia: vi.fn(),
  conversation: vi.fn(),
  messageMedia: vi.fn(),
  connectionForNumber: vi.fn(),
  connectionForWorkspace: vi.fn(),
  recordUpload: vi.fn(),
  uploadedSender: vi.fn(),
}));

const workspaceId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const messageId = "55555555-5555-4555-8555-555555555555";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const phoneNumberId = "1234567890";
const mediaId = "1234567890123";

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: vi.fn(async () => ({
    ok: true,
    session: { tenantId: workspaceId, userId: "test-user", role: "owner" },
  })),
}));
vi.mock("@/lib/strapi/client", () => ({
  StrapiClient: class { constructor(_tenantId: string) {} },
  isDurableInboxEnabled: () => true,
}));
vi.mock("@/lib/inbox/store", () => ({
  getConversation: mocks.conversation,
  getMessageMedia: mocks.messageMedia,
  recordMediaUpload: mocks.recordUpload,
  getUploadedMediaSender: mocks.uploadedSender,
}));
vi.mock("@/lib/meta/connections", () => ({
  getMetaConnectionForWorkspace: mocks.connectionForWorkspace,
  getMetaConnectionForNumber: mocks.connectionForNumber,
}));
vi.mock("@/lib/meta/client", () => ({
  MetaGraphClient: class {
    sendMessage = mocks.send;
    uploadMedia = mocks.upload;
    fetchMedia = mocks.fetchMedia;
  },
}));
vi.mock("@/lib/outbound/store", () => ({
  beginOutboundRequest: mocks.begin,
  acceptOutboundRequest: mocks.accept,
  getAcceptedMessage: vi.fn(async () => null),
  hashOutboundRequest: () => "stable-hash",
  markOutboundUncertain: vi.fn(),
}));

import { POST as sendPost } from "../app/api/whatsapp/messages/send/route";
import { POST as uploadPost } from "../app/api/whatsapp/messages/media/route";
import { GET as mediaGet } from "../app/api/whatsapp/messages/[messageId]/media/route";

const openWindow = () => new Date(Date.now() + 60_000).toISOString();
const closedWindow = () => new Date(Date.now() - 60_000).toISOString();

function conversation(windowExpiresAt = openWindow()) {
  return {
    id: conversationId,
    contact: { waId: "919876543210", phoneNumber: "+919876543210" },
    phoneNumber: { phoneNumberId },
    windowExpiresAt,
  };
}

function sendRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/whatsapp/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ conversationId, recipientPhone: "+919876543210", ...body }),
  });
}

function uploadRequest(fields: { messageType?: string; file?: File; conversationId?: string }) {
  const form = new FormData();
  form.append("conversationId", fields.conversationId ?? conversationId);
  if (fields.messageType) form.append("messageType", fields.messageType);
  if (fields.file) form.append("file", fields.file);
  return new NextRequest("http://localhost:3000/api/whatsapp/messages/media", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.conversation.mockResolvedValue(conversation());
  mocks.connectionForNumber.mockResolvedValue({ wabaId: "12345", phoneNumberId, accessToken: "test-token" });
  mocks.connectionForWorkspace.mockResolvedValue({ wabaId: "12345", phoneNumberId, accessToken: "test-token" });
  mocks.begin.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444", status: "sending", requestHash: "stable-hash", wamId: null, createdNew: true });
  mocks.send.mockResolvedValue({ messages: [{ id: "wamid.media.1" }] });
  mocks.accept.mockImplementation(async (input: { wamId: string }) => ({
    id: "66666666-6666-4666-8666-666666666666", wamId: input.wamId, direction: "outbound",
    type: "image", body: "", rawPayload: {}, status: "sent", timestamp: new Date().toISOString(), conversationId,
  }));
  mocks.upload.mockResolvedValue({ id: mediaId });
  mocks.recordUpload.mockResolvedValue(undefined);
  mocks.uploadedSender.mockResolvedValue(phoneNumberId);
});

describe("sending a stored file", () => {
  it("sends an image by Meta media ID with its caption", async () => {
    const response = await sendPost(sendRequest({ messageType: "image", mediaId, caption: "Brochure" }));
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(phoneNumberId, expect.objectContaining({
      type: "image", image: { id: mediaId, caption: "Brochure" },
    }));
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ messageType: "image", messageBody: "Brochure" }));
  });

  it("sends a video by Meta media ID", async () => {
    const response = await sendPost(sendRequest({ messageType: "video", mediaId }));
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(phoneNumberId, expect.objectContaining({
      type: "video", video: { id: mediaId, caption: undefined },
    }));
  });

  it("sends a document with a sanitised display filename", async () => {
    const response = await sendPost(sendRequest({ messageType: "document", mediaId, filename: "../brief.pdf" }));
    expect(response.status).toBe(200);
    const payload = mocks.send.mock.calls[0][1];
    expect(payload.type).toBe("document");
    expect(payload.document.id).toBe(mediaId);
    expect(payload.document.filename).not.toContain("/");
  });

  it("refuses a media send outside the 24-hour window before any provider call", async () => {
    mocks.conversation.mockResolvedValueOnce(conversation(closedWindow()));
    const response = await sendPost(sendRequest({ messageType: "image", mediaId }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("WINDOW_EXPIRED");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("requires a media ID for durable media sends", async () => {
    const response = await sendPost(sendRequest({ messageType: "image", mediaUrl: "https://example.com/a.png" }));
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("accepts a null caption as no caption", async () => {
    const response = await sendPost(sendRequest({ messageType: "image", mediaId, caption: null }));
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(phoneNumberId, expect.objectContaining({
      type: "image", image: { id: mediaId, caption: undefined },
    }));
  });

  it("refuses a media ID that was uploaded under a different sender number", async () => {
    mocks.uploadedSender.mockResolvedValueOnce("9999999999");
    const response = await sendPost(sendRequest({ messageType: "image", mediaId }));
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("refuses a media ID this workspace never uploaded", async () => {
    mocks.uploadedSender.mockResolvedValueOnce(null);
    const response = await sendPost(sendRequest({ messageType: "document", mediaId }));
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects an overlong caption", async () => {
    const response = await sendPost(sendRequest({ messageType: "image", mediaId, caption: "x".repeat(1025) }));
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("still refuses interactive messages in durable mode", async () => {
    const response = await sendPost(sendRequest({ messageType: "interactive", text: "Pick one" }));
    expect(response.status).toBe(501);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("uploading a file", () => {
  it("stores a PNG with Meta and returns the media ID", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    const response = await uploadPost(uploadRequest({ messageType: "image", file }));
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledWith(phoneNumberId, expect.objectContaining({
      mimeType: "image/png", filename: "photo.png",
    }));
    expect((await response.json()).data).toEqual(expect.objectContaining({ mediaId, messageType: "image" }));
  });

  it("records the upload against the workspace and sender number before returning it", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });
    const response = await uploadPost(uploadRequest({ messageType: "image", file }));
    expect(response.status).toBe(200);
    expect(mocks.recordUpload).toHaveBeenCalledWith({
      workspaceId, mediaId, phoneNumberId, authUserId: "test-user",
    });
  });

  it("refuses a file above the upload limit without calling Meta", async () => {
    const file = new File([new Uint8Array(MAX_MEDIA_UPLOAD_BYTES + 1)], "big.png", { type: "image/png" });
    const response = await uploadPost(uploadRequest({ messageType: "image", file }));
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuses a file whose type does not match the message type", async () => {
    const file = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const response = await uploadPost(uploadRequest({ messageType: "image", file }));
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuses an upload for a conversation that is outside the window", async () => {
    mocks.conversation.mockResolvedValueOnce(conversation(closedWindow()));
    const file = new File([new Uint8Array([1])], "clip.mp4", { type: "video/mp4" });
    const response = await uploadPost(uploadRequest({ messageType: "video", file }));
    expect(response.status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuses an unknown conversation", async () => {
    mocks.conversation.mockResolvedValueOnce(null);
    const file = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const response = await uploadPost(uploadRequest({ messageType: "document", file }));
    expect(response.status).toBe(404);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("serving a stored file", () => {
  const streamOf = (text: string) => new Response(text).body!;

  it("returns 404 for a message that holds no media", async () => {
    mocks.messageMedia.mockResolvedValueOnce(null);
    const response = await mediaGet(
      new NextRequest(`http://localhost/api/whatsapp/messages/${messageId}/media`),
      { params: Promise.resolve({ messageId }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.fetchMedia).not.toHaveBeenCalled();
  });

  it("rejects a malformed message ID before touching the database", async () => {
    const response = await mediaGet(
      new NextRequest("http://localhost/api/whatsapp/messages/x/media"),
      { params: Promise.resolve({ messageId: "not-a-uuid" }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.messageMedia).not.toHaveBeenCalled();
  });

  it("streams an image inline with nosniff", async () => {
    mocks.messageMedia.mockResolvedValueOnce({ type: "image", mediaId, filename: null, phoneNumberId });
    mocks.fetchMedia.mockResolvedValueOnce({ body: streamOf("png-bytes"), mimeType: "image/png", contentLength: 9 });
    const response = await mediaGet(
      new NextRequest(`http://localhost/api/whatsapp/messages/${messageId}/media`),
      { params: Promise.resolve({ messageId }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Length")).toBe("9");
    expect(await response.text()).toBe("png-bytes");
    expect(mocks.connectionForNumber).toHaveBeenCalledWith(workspaceId, phoneNumberId);
  });

  it("serves a document as a download, never as an inline page", async () => {
    mocks.messageMedia.mockResolvedValueOnce({ type: "document", mediaId, filename: "brief.pdf", phoneNumberId });
    mocks.fetchMedia.mockResolvedValueOnce({ body: streamOf("%PDF"), mimeType: "text/html", contentLength: null });
    const response = await mediaGet(
      new NextRequest(`http://localhost/api/whatsapp/messages/${messageId}/media`),
      { params: Promise.resolve({ messageId }) },
    );
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="brief\.pdf"/);
  });

  it("returns 502 when Meta can no longer supply the file", async () => {
    mocks.messageMedia.mockResolvedValueOnce({ type: "image", mediaId, filename: null, phoneNumberId });
    mocks.fetchMedia.mockRejectedValueOnce(new Error("expired"));
    const response = await mediaGet(
      new NextRequest(`http://localhost/api/whatsapp/messages/${messageId}/media`),
      { params: Promise.resolve({ messageId }) },
    );
    expect(response.status).toBe(502);
  });
});
