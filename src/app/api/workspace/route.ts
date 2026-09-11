import { assertSameOrigin, requireUser } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";
import { createNote, readWorkspace, saveCustomer, saveEmployee, saveNote, saveOrganization, saveTrackedItem } from "@/server/d1-repository";
import type { Customer, Organization, Profile, ServiceNote, TrackedItem } from "@/lib/types";

function failure(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return Response.json({ message: "Unexpected workspace error" }, { status: 500 });
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw Response.json({ message: `${name} is required` }, { status: 400 });
  return value;
}

export async function GET(request: Request) {
  try {
    const env = await cloudflareEnv();
    const user = await requireUser(request, env.DB);
    return Response.json(await readWorkspace(user, env));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const env = await cloudflareEnv();
    assertSameOrigin(request);
    const user = await requireUser(request, env.DB);
    const body = await request.json() as {
      action: string;
      note?: ServiceNote;
      complete?: boolean;
      customer?: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string };
      item?: Omit<TrackedItem, "id" | "organization_id" | "created_at" | "updated_at"> & { id?: string };
      employee?: Profile;
      organization?: Organization;
    };
    switch (body.action) {
      case "create-note": return Response.json(await createNote(user, env));
      case "save-note": return Response.json(await saveNote(user, required(body.note, "note"), Boolean(body.complete), env));
      case "save-customer": return Response.json(await saveCustomer(user, required(body.customer, "customer"), env));
      case "save-tracked-item": return Response.json(await saveTrackedItem(user, required(body.item, "item"), env));
      case "save-employee": await saveEmployee(user, required(body.employee, "employee"), env); return Response.json({ ok: true });
      case "save-organization": await saveOrganization(user, required(body.organization, "organization"), env); return Response.json({ ok: true });
      default: return Response.json({ message: "Unknown workspace action" }, { status: 400 });
    }
  } catch (error) {
    return failure(error);
  }
}
