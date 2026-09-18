import { assertSameOrigin, requireUser } from "@/server/auth";
import { cloudflareEnv, type ExtendedEnv } from "@/server/cloudflare-runtime";

type EvidenceRow = {
  id: string;
  report_id: string;
  original_object_key: string;
  original_content_type: string;
  derivative_object_key: string | null;
  derivative_content_type: string | null;
  status: string;
  person_in_charge_id: string;
};
async function evidence(
  id: string,
  organizationId: string,
  env: ExtendedEnv,
) {
  return env.DB.prepare(
    "SELECT p.*, n.status, n.person_in_charge_id FROM report_photo_evidence p JOIN service_notes n ON n.id = p.report_id AND n.organization_id = p.organization_id WHERE p.id = ? AND p.organization_id = ?",
  )
    .bind(id, organizationId)
    .first<EvidenceRow>();
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> },
) {
  try {
    const env = await cloudflareEnv();
    const user = await requireUser(request, env.DB);
    const route = await params;
    const row = await evidence(route.id, user.organizationId, env);
    if (
      !row ||
      (user.role !== "ADMIN" && row.person_in_charge_id !== user.profileId)
    )
      return new Response("Not found", { status: 404 });
    const derivative = route.variant === "derivative";
    if (route.variant !== "original" && !derivative)
      return new Response("Not found", { status: 404 });
    const key = derivative
      ? row.derivative_object_key
      : row.original_object_key;
    if (!key) return new Response("Not found", { status: 404 });
    const object = await env.REPORT_MEDIA.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "content-type":
        (derivative
          ? row.derivative_content_type
          : row.original_content_type) || "application/octet-stream",
      "cache-control":
        row.status === "COMPLETED"
          ? "private, max-age=86400, immutable"
          : "private, no-store",
      "content-length": String(object.size),
      "x-content-type-options": "nosniff",
    });
    return new Response(object.body, { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(JSON.stringify({ message: "evidence retrieval failed", error: error instanceof Error ? error.message : String(error) }));
    return new Response("Unable to retrieve evidence", { status: 500 });
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> },
) {
  try {
    const env = await cloudflareEnv();
    assertSameOrigin(request);
    const user = await requireUser(request, env.DB);
    const route = await params;
    if (route.variant !== "original")
      return Response.json(
        { message: "Only draft evidence can be removed." },
        { status: 400 },
      );
    const row = await evidence(route.id, user.organizationId, env);
    if (
      !row ||
      (user.role !== "ADMIN" && row.person_in_charge_id !== user.profileId)
    )
      return Response.json({ message: "Evidence not found." }, { status: 404 });
    if (row.status === "COMPLETED")
      return Response.json(
        { message: "Completed Report evidence is read-only." },
        { status: 409 },
      );
    await env.DB.prepare(
      "DELETE FROM report_photo_evidence WHERE id = ? AND organization_id = ? AND report_id = ?",
    )
      .bind(row.id, user.organizationId, row.report_id)
      .run();
    await env.REPORT_MEDIA.delete([
      row.original_object_key,
      ...(row.derivative_object_key ? [row.derivative_object_key] : []),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(JSON.stringify({ message: "evidence deletion failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json(
      { message: "Evidence could not be removed." },
      { status: 500 },
    );
  }
}
