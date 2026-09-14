import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceRepository } from "../src/dev/local-repository";
import { createDevelopmentWorkspace } from "../src/dev/fixtures";
let repo: LocalWorkspaceRepository;
beforeEach(() => {
  repo = new LocalWorkspaceRepository(
    `test-${crypto.randomUUID()}`,
    createDevelopmentWorkspace(),
  );
});
describe("local persisted note workflow", () => {
  it("allocates distinct numbers concurrently and keeps drafts across repository instances", async () => {
    const [a, b] = await Promise.all([repo.createNote(), repo.createNote()]);
    expect(a.service_number).not.toBe(b.service_number);
    expect(a).toMatchObject({
      schema_version: 2,
      quantity: "1",
      organization_name_snapshot: "Meridian Warehouse Operations",
    });
    expect(a.record_type).toBeUndefined();
    expect(a.labor).toEqual([]);
    expect(a.materials).toEqual([]);
    expect(a.charges).toEqual([]);
    const loaded = await repo.read();
    expect(loaded.notes.find((n) => n.id === a.id)?.status).toBe("DRAFT");
  });
  it("rejects stale edits rather than overwriting", async () => {
    const n = await repo.createNote();
    await repo.saveNote({ ...n, item_name_snapshot: "Inspection lot" });
    await expect(repo.saveNote({ ...n, item_name_snapshot: "Old tab" })).rejects.toThrow(
      /changed/i,
    );
  });
  it("submits an evidence report without repair or acknowledgement data", async () => {
    let n = await repo.createNote();
    const data = await repo.read();
    const c = data.customers[0];
    n = {
      ...n,
      customer_id: c.id,
      customer_name_snapshot: c.name,
      contact_number_snapshot: c.contact_number,
      item_name_snapshot: "Pallet of sealed inverter cartons",
      quantity: "12",
      location_snapshot: "Warehouse A · Receiving Bay 2",
      condition_code: "NO_VISIBLE_ISSUE",
      photos: [{
        id: "evidence-photo",
        url: "/api/report-photos/evidence-photo/derivative",
        original_url: "/api/report-photos/evidence-photo/original",
        original_sha256: "a".repeat(64),
        derivative_sha256: "b".repeat(64),
        source: "CAMERA_CAPTURE",
        uploaded_by_id: data.profile.id,
        uploaded_by_name_snapshot: data.profile.full_name,
        category: "OTHER",
        caption: "Seals and outer cartons at receipt",
        created_at: new Date().toISOString(),
        name: "receiving-bay.jpg",
      }],
    };
    const completed = await repo.saveNote(n, true);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.signature).toBeNull();
    expect(completed.work_performed).toBe("");
    await expect(
      repo.saveNote({ ...completed, item_name_snapshot: "Changed" }),
    ).rejects.toThrow(/read.only/i);
    await repo.saveCustomer({ ...c, name: "Renamed company" });
    const after = await repo.read();
    expect(after.notes.find((x) => x.id === n.id)?.customer_name_snapshot).toBe(
      c.name,
    );
    expect(
      after.events.filter((e) => e.note_id === n.id).map((e) => e.type),
    ).toEqual(["SERVICE_NOTE_CREATED", "SERVICE_NOTE_COMPLETED"]);
  });
  it("rejects incomplete completion without writing an event", async () => {
    const n = await repo.createNote();
    await expect(repo.saveNote(n, true)).rejects.toThrow(/required/);
    expect(
      (await repo.read()).events.filter((e) => e.note_id === n.id),
    ).toHaveLength(1);
  });
  it("keeps the final active administrator from demoting themselves", async () => {
    const data = await repo.read();
    await expect(
      repo.saveEmployee({ ...data.profile, role: "EMPLOYEE" }),
    ).rejects.toThrow(/last active administrator/i);
  });
  it("ships only fresh evidence-report fixtures", async () => {
    const initial = createDevelopmentWorkspace();
    expect(initial.notes.length).toBeGreaterThan(0);
    expect(initial.notes.every((note) => note.schema_version === 2)).toBe(true);
    expect(initial.notes.every((note) => note.labor.length === 0)).toBe(true);
    expect(initial.tracked_items).toEqual([]);
  });
});
