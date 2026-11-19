import { NextRequest, NextResponse } from "next/server";
import { MetaGraphClient } from "@/lib/meta/client";
import { requireApiSession } from "@/lib/auth/session";
import { getMetaConnectionForNumber, getMetaConnectionForWorkspace } from "@/lib/meta/connections";
import { getMessageMedia } from "@/lib/inbox/store";
import { isDurableInboxEnabled } from "@/lib/strapi/client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only these may render inline. Anything else Meta returns is served as a download, and the
// response is marked nosniff, so a stored file can never run as a page on this origin.
const INLINE_TYPES = new Set(["image/jpeg", "image/png", "video/mp4", "video/3gpp"]);

function contentDisposition(filename: string, inline: boolean): string {
  const safeAscii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${inline ? "inline" : "attachment"}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Serves the bytes of an image, video or document message. Meta holds the file; this route looks up
 * the message's media ID inside the caller's workspace, then streams it with the workspace's token, so
 * the token never reaches the browser.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;
  if (!isDurableInboxEnabled()) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const { messageId } = await context.params;
  if (!uuid.test(messageId)) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const media = await getMessageMedia(auth.session.tenantId, messageId);
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const connection = media.phoneNumberId
    ? await getMetaConnectionForNumber(auth.session.tenantId, media.phoneNumberId)
    : await getMetaConnectionForWorkspace(auth.session.tenantId);
  if (!connection) return NextResponse.json({ error: "This conversation's WhatsApp channel is not connected" }, { status: 409 });

  let file: Awaited<ReturnType<MetaGraphClient["fetchMedia"]>>;
  try {
    file = await new MetaGraphClient(connection.accessToken).fetchMedia(media.mediaId);
  } catch (error) {
    console.error("[Media Fetch Error]", error);
    return NextResponse.json({ error: "This file is no longer available from WhatsApp" }, { status: 502 });
  }

  const contentType = file.mimeType.toLowerCase();
  const inline = media.type !== "document" && INLINE_TYPES.has(contentType);
  const headers: Record<string, string> = {
    "Content-Type": inline ? contentType : "application/octet-stream",
    "Content-Disposition": contentDisposition(media.filename || `${media.type}-${messageId}`, inline),
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (file.contentLength) headers["Content-Length"] = String(file.contentLength);
  return new NextResponse(file.body, { headers });
}
