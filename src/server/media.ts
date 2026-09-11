export const PHOTO_MAX_BYTES = 450_000;
export const SIGNATURE_MAX_BYTES = 150_000;

export type MediaPurpose = "photo" | "signature";

export function validateMediaUpload(contentType: string, byteSize: number, purpose: MediaPurpose) {
  const allowed = purpose === "signature" ? ["image/png"] : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(contentType)) throw new Error("Choose a supported image format.");
  const maxBytes = purpose === "signature" ? SIGNATURE_MAX_BYTES : PHOTO_MAX_BYTES;
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > maxBytes)
    throw new Error(purpose === "signature" ? "This signature image is too large." : "This image is too large.");
  return { contentType, maxBytes };
}

