// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import NoteEditor from "../src/components/note-editor";
import type { ServiceNote } from "../src/lib/types";

const note: ServiceNote = {
  id: "n",
  organization_id: "o",
  service_number: "SL-2026-000001",
  status: "DRAFT",
  revision: 1,
  job_title: "Compressor service",
  job_description: "",
  work_performed: "Replaced pressure regulator.",
  result_remarks: "",
  additional_notes: "",
  service_date: "2026-09-09",
  service_time: "09:00",
  person_in_charge_id: "p",
  person_in_charge_name_snapshot: "Amir Malik",
  person_in_charge_job_title_snapshot: "Technician",
  person_in_charge_employee_id_snapshot: "EMP-01",
  customer_id: "c",
  customer_name_snapshot: "Atlas",
  contact_name_snapshot: "Ali",
  contact_position_snapshot: "Manager",
  contact_mobile_snapshot: "0123456789",
  contact_office_snapshot: "",
  contact_email_snapshot: "",
  customer_address_snapshot: "",
  payment_status: "UNPAID",
  payment_method: "",
  payment_terms: "Immediate",
  payment_reference: "",
  payment_remarks: "",
  labor: [],
  materials: [],
  charges: [],
  photos: [],
  signature: {
    signer_name: "Ali",
    signer_position: "Manager",
    image: "data:image/png;base64,a",
    signed_at: "2026-09-09T01:00:00Z",
  },
  labor_total: "0.00",
  material_total: "0.00",
  additional_charge_total: "0.00",
  subtotal: "0.00",
  discount_amount: "0.00",
  tax_rate: "0",
  tax_amount: "0.00",
  grand_total: "0.00",
  created_at: "2026-09-09T01:00:00Z",
  updated_at: "2026-09-09T01:00:00Z",
  completed_at: null,
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(cleanup);
function setup(
  overrides: Partial<React.ComponentProps<typeof NoteEditor>> = {},
) {
  const props = {
    note,
    customers: [],
    employees: [],
    onSave: vi.fn(async (value: ServiceNote) => ({ ...value, revision: 2 })),
    onComplete: vi.fn(async (value: ServiceNote) => ({
      ...value,
      status: "COMPLETED" as const,
    })),
    onCreateCustomer: vi.fn(),
    onCreateTrackedItem: vi.fn(),
    onDone: vi.fn(),
    ...overrides,
  };
  render(<NoteEditor {...props} />);
  return props;
}
describe("service note editing", () => {
  it("autosaves a changed draft after a short quiet period", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Record title/), {
      target: { value: "Autosaved regulator service" },
    });
    expect(screen.getByRole("status").textContent).toContain("Unsaved changes");
    await waitFor(() => expect(props.onSave).toHaveBeenCalled(), {
      timeout: 1800,
    });
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({
      job_title: "Autosaved regulator service",
    });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "All changes saved",
      ),
    );
  });
  it("invalidates acceptance after a service change and saves the changed draft", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Record title/), {
      target: { value: "Regulator replacement" },
    });
    expect(screen.queryByAltText("Confirmed customer signature")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Save draft/i })[0]);
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({
      job_title: "Regulator replacement",
      signature: null,
    });
  });
  it("preserves unsaved input after a failed save", async () => {
    setup({
      onSave: vi.fn(async () => {
        throw new Error("Storage unavailable. Try again.");
      }),
    });
    fireEvent.change(screen.getByLabelText(/Record title/), {
      target: { value: "Keep this edited title" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Save draft/i })[0]);
    await screen.findByText("Storage unavailable. Try again.");
    expect((screen.getByLabelText(/Record title/) as HTMLInputElement).value).toBe(
      "Keep this edited title",
    );
  });
  it("uses staff attestation and removes billing for an internal inspection", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Record type/), {
      target: { value: "INSPECTION" },
    });
    expect(screen.getAllByText("Staff attestation")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Payment" })).toBeNull();
  });
  it("cancels labor without adding it, then saves a real line and total", async () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add labor" }));
    let dialog = screen.getByRole("dialog", { name: "Add labor" });
    fireEvent.change(within(dialog).getByLabelText(/Worker name/), {
      target: { value: "External worker" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("External worker")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add labor" }));
    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Worker name/), {
      target: { value: "Amir" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hours/), {
      target: { value: "2.5" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hourly rate/), {
      target: { value: "80" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save labor" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Save draft/i })[0]);
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect(vi.mocked(props.onSave).mock.calls[0][0]).toMatchObject({
      grand_total: "200.00",
      labor: [{ name: "Amir", hours: "2.5", rate: "80" }],
      signature: null,
    });
  });
  it("disables completion and identifies the first incomplete section", () => {
    const props = setup({
      note: { ...note, signature: null, work_performed: "" },
    });
    const complete = screen.getByRole("button", {
      name: /Complete service note/i,
    });
    expect((complete as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/requirements remaining/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "service details" }).getAttribute("href"),
    ).toBe("#note-section-service-details");
    expect(props.onComplete).not.toHaveBeenCalled();
  });
  it("blocks customer handoff until the technician requirements are complete", () => {
    setup({ field: true, note: { ...note, customer_id: "", signature: null } });
    fireEvent.click(screen.getByRole("button", { name: "Go to Review" }));
    expect(screen.getByRole("heading", { name: "Customer" })).toBeTruthy();
    expect(
      screen.getByText(
        "Customer is required before completing this Service Note.",
      ),
    ).toBeTruthy();
    expect(document.body.classList.contains("customer-signing")).toBe(false);
  });
  it("shows missing requirements and disables completion until acceptance is confirmed", () => {
    setup({ field: true, note: { ...note, signature: null } });
    fireEvent.click(screen.getByRole("button", { name: "Go to Review" }));
    expect(screen.getByText("Customer acceptance")).toBeTruthy();
    expect(screen.getByText(/Signature required/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Complete service note",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it("removes field navigation during customer acceptance and restores it on back", () => {
    setup({ field: true });
    fireEvent.click(screen.getByRole("button", { name: "Go to Review" }));
    expect(document.body.classList.contains("customer-signing")).toBe(true);
    expect(screen.getByText("Customer acceptance")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.body.classList.contains("customer-signing")).toBe(false);
  });
});

describe("signature capture", () => {
  it("requires a real stroke before confirming and supports clearing", async () => {
    const { SignaturePad } = await import("../src/components/signature-pad");
    vi.stubGlobal("PointerEvent", MouseEvent);
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,c2lnbmF0dXJl",
    );
    const onConfirm = vi.fn(),
      onClear = vi.fn();
    render(
      <SignaturePad value={null} onConfirm={onConfirm} onClear={onClear} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm signature" }));
    expect(
      screen.getByText("Please draw your signature before confirming."),
    ).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    const canvas = screen.getByLabelText("Draw your signature");
    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 500,
      bottom: 180,
      width: 500,
      height: 180,
      toJSON() {},
    });
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 90 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 100 });
    fireEvent.pointerUp(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Confirm signature" }));
    expect(onConfirm).toHaveBeenCalledWith(
      "data:image/png;base64,c2lnbmF0dXJl",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
    onConfirm.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Confirm signature" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
