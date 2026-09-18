import { assertSameOrigin, requireUser } from "@/server/auth";
import { cloudflareEnv, type ExtendedEnv } from "@/server/cloudflare-runtime";

const MAX_BYTES = 30_000_000;
function jsonError(message: string, status: number, code: string) {
  return Response.json({ message, code }, { status });
}
function numberHeader(request: Request, name: string) {
  const raw = request.headers.get(name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let objectKey = "";
  try {
    const env = await cloudflareEnv();
    assertSameOrigin(request);
    const user = await requireUser(request, env.DB);
    const reportId = (await params).id;
    const report = await env.DB.prepare(
      "SELECT id, status, schema_version, person_in_charge_id FROM service_notes WHERE id = ? AND organization_id = ?",
    )
      .bind(reportId, user.organizationId)
      .first<{
        id: string;
        status: string;
        schema_version: number;
        person_in_charge_id: string;
      }>();
    if (
      !report ||
      (user.role !== "ADMIN" && report.person_in_charge_id !== user.profileId)
    )
      return jsonError(
        "This Report is not available.",
        404,
        "REPORT_NOT_FOUND",
      );
    if (report.schema_version !== 2 || report.status !== "DRAFT")
      return jsonError(
        "Evidence can only be added to a draft Report.",
        409,
        "REPORT_READ_ONLY",
      );
    const contentType = (request.headers.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();
    if (!contentType.startsWith("image/"))
      return jsonError(
        "Select a supported image file.",
        415,
        "INVALID_MEDIA_TYPE",
      );
    const expectedSha = (
      request.headers.get("x-content-sha256") || ""
    ).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha))
      return jsonError(
        "A SHA-256 checksum is required.",
        400,
        "CHECKSUM_REQUIRED",
      );
    const source = request.headers.get("x-photo-source");
    if (source !== "CAMERA_CAPTURE" && source !== "FILE_UPLOAD")
      return jsonError("Photo source is invalid.", 400, "INVALID_SOURCE");
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES)
      return jsonError(
        "Photos must be between 1 byte and 30 MB.",
        413,
        "FILE_TOO_LARGE",
      );
    if (!request.body)
      return jsonError("The photo is empty.", 400, "EMPTY_FILE");
    const photoId = crypto.randomUUID();
    objectKey = `reports/${user.organizationId}/${reportId}/originals/${photoId}`;
    const stored = await env.REPORT_MEDIA.put(objectKey, request.body, {
      sha256: expectedSha,
      httpMetadata: { contentType },
      customMetadata: { reportId, photoId },
    });
    if (!stored.size || stored.size > MAX_BYTES) {
      await env.REPORT_MEDIA.delete(objectKey);
      objectKey = "";
      return jsonError(
        "Photos must be between 1 byte and 30 MB.",
        413,
        "FILE_TOO_LARGE",
      );
    }
    const timestamp = stored.uploaded.toISOString();
    const filename = decodeURIComponent(
      request.headers.get("x-original-filename") || "evidence-photo",
    ).slice(0, 240);
    const position = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM report_photo_evidence WHERE report_id = ? AND organization_id = ?",
    )
      .bind(reportId, user.organizationId)
      .first<{ count: number }>();
    await env.DB.prepare(
      "INSERT INTO report_photo_evidence (id, organization_id, report_id, uploader_id, uploader_name_snapshot, original_object_key, original_content_type, original_byte_size, original_filename, original_sha256, source_intent, caption, server_uploaded_at, gps_latitude, gps_longitude, gps_accuracy, gps_device_timestamp, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        photoId,
        user.organizationId,
        reportId,
        user.profileId,
        user.fullName,
        objectKey,
        contentType,
        stored.size,
        filename,
        expectedSha,
        source,
        timestamp,
        numberHeader(request, "x-gps-latitude"),
        numberHeader(request, "x-gps-longitude"),
        numberHeader(request, "x-gps-accuracy"),
        request.headers.get("x-gps-device-timestamp"),
        position?.count || 0,
      )
      .run();
    return Response.json({
      id: photoId,
      url: `/api/report-photos/${photoId}/original`,
      original_url: `/api/report-photos/${photoId}/original`,
      original_sha256: expectedSha,
      source,
      uploaded_by_id: user.profileId,
      uploaded_by_name_snapshot: user.fullName,
      category: "OTHER",
      caption: "",
      created_at: timestamp,
      name: filename,
      gps_latitude: numberHeader(request, "x-gps-latitude") ?? undefined,
      gps_longitude: numberHeader(request, "x-gps-longitude") ?? undefined,
      gps_accuracy: numberHeader(request, "x-gps-accuracy") ?? undefined,
      gps_device_timestamp:
        request.headers.get("x-gps-device-timestamp") || undefined,
    });
  } catch (error) {
    if (objectKey)
      try {
        const env = await cloudflareEnv();
        await env.REPORT_MEDIA.delete(objectKey);
      } catch {}
    if (error instanceof Response) return error;
    console.error(
      JSON.stringify({
        message: "evidence upload failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonError(
      error instanceof Error && /checksum/i.test(error.message)
        ? "The uploaded bytes did not match the expected checksum."
        : "The evidence photo could not be stored.",
      422,
      "UPLOAD_FAILED",
    );
  }
}
