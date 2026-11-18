// Pure helpers shared by the inbox UI and the send/upload routes. No server-only imports here.

export type MediaMessageType = "image" | "video" | "document";

/**
 * Largest file the app will accept. A file travels through one of our route handlers before it
 * reaches Meta, and hosting platforms cap request bodies (about 4.5 MB on Vercel functions), so this
 * sits under that cap. WhatsApp itself allows more (images 5 MB, video 16 MB, documents 100 MB);
 * lifting this needs a direct-to-storage upload path.
 */
export const MAX_MEDIA_UPLOAD_BYTES = 4 * 1024 * 1024;

/** WhatsApp caps captions at 1024 characters. */
export const MAX_MEDIA_CAPTION_LENGTH = 1024;

const MEDIA_MIME_TYPES: Record<MediaMessageType, readonly string[]> = {
  image: ["image/jpeg", "image/png"],
  video: ["video/mp4", "video/3gpp"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
  ],
};

/** The message type a file's MIME type can be sent as, or null when WhatsApp cannot carry it. */
export function mediaTypeForMime(mimeType: string): MediaMessageType | null {
  const mime = mimeType.toLowerCase();
  for (const type of Object.keys(MEDIA_MIME_TYPES) as MediaMessageType[]) {
    if (MEDIA_MIME_TYPES[type].includes(mime)) return type;
  }
  return null;
}

export function mediaAcceptAttribute(type: MediaMessageType): string {
  return MEDIA_MIME_TYPES[type].join(",");
}

export function isMediaMessageType(value: unknown): value is MediaMessageType {
  return value === "image" || value === "video" || value === "document";
}

/** Returns a user-facing reason the file cannot be sent as this type, or null when it can. */
export function validateMediaFile(
  file: { size: number; type: string },
  messageType: MediaMessageType,
): string | null {
  if (file.size <= 0) return "The file is empty";
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    return `Files must be ${Math.floor(MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024))} MB or smaller`;
  }
  const detected = mediaTypeForMime(file.type || "");
  if (!detected) return "This file type cannot be sent on WhatsApp";
  if (detected !== messageType) return `This file can only be sent as a ${detected}`;
  return null;
}

/** Keeps a display filename short, free of path separators and control characters. */
export function safeMediaFilename(name: string | undefined | null, fallback: string): string {
  const cleaned = (name || "")
    .replace(/[\\/\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned || fallback;
}
