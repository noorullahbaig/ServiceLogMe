// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EvidenceReportEditor from "../src/components/evidence-report-editor";
import { createDevelopmentWorkspace, emptyNote } from "../src/dev/fixtures";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(cleanup);

function setup() {
  const data = createDevelopmentWorkspace();
  const note = emptyNote(data.profile, "SL-2026-000999", data.organization);
  const props = {
    note,
    customers: data.customers,
    organization: data.organization,
    onSave: vi.fn(async (value: typeof note) => ({ ...value, revision: value.revision + 1 })),
    onComplete: vi.fn(async (value: typeof note) => ({ ...value, status: "COMPLETED" as const })),
    onCreateCustomer: vi.fn(),
    onUploadPhoto: vi.fn(),
    onDeletePhoto: vi.fn(),
    onDone: vi.fn(),
  };
  render(<EvidenceReportEditor {...props} />);
  return props;
}

describe("evidence report editor", () => {
  it("shows the evidence fields and no repair, labour, or payment workflow", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Create report" })).toBeTruthy();
    expect(screen.getByLabelText(/Item description/)).toBeTruthy();
    expect(screen.getByLabelText(/Quantity/)).toBeTruthy();
    expect(screen.getByLabelText(/^Condition$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Take photo/i })).toBeTruthy();
    expect(screen.queryByText("Work performed")).toBeNull();
    expect(screen.queryByText("Labor")).toBeNull();
    expect(screen.queryByText("Payment")).toBeNull();
  });

  it("keeps acknowledgement off and blocks submission until evidence is complete", async () => {
    setup();
    expect((screen.getByLabelText("Add customer acknowledgement") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Submit report" })[0]);
    expect(await screen.findByText(/Customer \/ company name is required/)).toBeTruthy();
    expect(screen.getByText(/At least one stored evidence photo is required/)).toBeTruthy();
  });

  it("autosaves report fields without manufacturing N/A values", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Item description/), { target: { value: "Wrapped motor assembly" } });
    await waitFor(() => expect(props.onSave).toHaveBeenCalled(), { timeout: 1800 });
    expect(props.onSave.mock.calls[0][0]).toMatchObject({
      item_name_snapshot: "Wrapped motor assembly",
      invoice_number: "",
      job_title: "",
      work_performed: "",
    });
  });
});
