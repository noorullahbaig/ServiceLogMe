import { assertSameOrigin, requireUser } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";
import { validateMediaUpload } from "@/server/media";
import { D1MediaStore } from "@/server/media-store";

function responseError(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const env = await cloudflareEnv();
    const user = await requireUser(request, env.DB);
    const contentType = request.headers.get("content-type") || "";
    const purpose = request.headers.get("x-media-purpose") === "signature" ? "signature" : "photo";
    const bytes = new Uint8Array(await request.arrayBuffer());
    validateMediaUpload(contentType, bytes.byteLength, purpose);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const stored = await new D1MediaStore(env.DB).put({ organizationId: user.organizationId, profileId: user.profileId, bytes: buffer, contentType, purpose });
    return Response.json(stored);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to store the image.";
    return responseError("MEDIA_UPLOAD_FAILED", message, 422);
  }
}
