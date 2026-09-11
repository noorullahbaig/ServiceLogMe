import { requireAccessIdentity } from "@/server/access";
import { cloudflareEnv } from "@/server/cloudflare-runtime";
import { createNote, readWorkspace, saveCustomer, saveEmployee, saveNote, saveOrganization } from "@/server/d1-repository";
import type { Customer, Organization, Profile, ServiceNote } from "@/lib/types";

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
    const identity = await requireAccessIdentity(request, env);
    return Response.json(await readWorkspace(identity));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const env = await cloudflareEnv();
    const identity = await requireAccessIdentity(request, env);
    const body = await request.json() as {
      action: string;
      note?: ServiceNote;
      complete?: boolean;
      customer?: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string };
      employee?: Profile;
      organization?: Organization;
    };
    switch (body.action) {
      case "create-note": return Response.json(await createNote(identity));
      case "save-note": return Response.json(await saveNote(identity, required(body.note, "note"), Boolean(body.complete)));
      case "save-customer": return Response.json(await saveCustomer(identity, required(body.customer, "customer")));
      case "save-employee": await saveEmployee(identity, required(body.employee, "employee")); return Response.json({ ok: true });
      case "save-organization": await saveOrganization(identity, required(body.organization, "organization")); return Response.json({ ok: true });
      default: return Response.json({ message: "Unknown workspace action" }, { status: 400 });
    }
  } catch (error) {
    return failure(error);
  }
}
