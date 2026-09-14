import { requireUser } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";
import { listReports } from "@/server/d1-repository";
import type { ReportQuery } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const env = await cloudflareEnv();
    const user = await requireUser(request, env.DB);
    const params = new URL(request.url).searchParams;
    const query: ReportQuery = {
      q: params.get("q") || "",
      status: (params.get("status") || "") as ReportQuery["status"],
      employee: params.get("employee") || "",
      customer: params.get("customer") || "",
      from: params.get("from") || "",
      to: params.get("to") || "",
      page: Number(params.get("page")) || 1,
      pageSize: Number(params.get("pageSize")) || 20,
    };
    return Response.json(await listReports(user, query, env));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(JSON.stringify({ message: "report listing failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json(
      { message: "Reports could not be loaded." },
      { status: 500 },
    );
  }
}
