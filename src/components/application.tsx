"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  FileCheck2,
  Plus,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Shell, Brand } from "./shell";
import { Overview, FieldHome } from "./overview";
import { NotesTable } from "./notes-table";
import NoteEditor from "./note-editor";
import { NoteDetail } from "./note-detail";
import { ServiceReport } from "./service-report";
import {
  Customers,
  CustomerDetail,
  Employees,
  Settings,
  FieldProfile,
} from "./directories";
import type { WorkspaceRepository } from "@/lib/repository";
import type { WorkspaceData, ServiceNote, Customer } from "@/lib/types";
import { isCompletedRecord } from "@/lib/domain";

function DraftCompletionRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      Returning to the draft…
    </div>
  );
}

export default function Application({
  localEnabled,
}: {
  localEnabled: boolean;
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const repository = useRef<WorkspaceRepository | null>(null),
    initialization = useRef<Promise<void> | null>(null),
    creation = useRef<Promise<ServiceNote> | null>(null),
    redirectingNewNote = useRef(false);
  const field = path.startsWith("/field"),
    base = field ? "/field" : "",
    relative = field ? path.slice(6) || "/" : path;
  useEffect(() => {
    initialization.current ??= (async () => {
      if (localEnabled) {
        const [{ LocalWorkspaceRepository }, { createDevelopmentWorkspace }] =
          await Promise.all([
            import("@/dev/local-repository"),
            import("@/dev/fixtures"),
          ]);
        repository.current = new LocalWorkspaceRepository(
          "servicelogme-local-v1",
          createDevelopmentWorkspace(),
        );
      } else {
        const { CloudflareWorkspaceRepository } = await import(
          "@/lib/cloudflare-repository"
        );
        repository.current = new CloudflareWorkspaceRepository();
      }
      setData(await repository.current.read());
    })();
    initialization.current.catch((e) => setError(e instanceof Error ? e.message : "Unable to open workspace"));
  }, [localEnabled]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (path === "/") router.replace("/dashboard");
  }, [path, router]);
  const refresh = useCallback(async () => {
    if (repository.current) setData(await repository.current.read());
  }, []);
  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, [refresh]);
  useEffect(() => {
    if (relative !== "/service-notes/new") {
      creation.current = null;
      redirectingNewNote.current = false;
      return;
    }
    if (!data || !repository.current || redirectingNewNote.current) return;
    creation.current ??= repository.current.createNote();
    void creation.current
      .then(async (n) => {
        await refresh();
        if (redirectingNewNote.current) return;
        redirectingNewNote.current = true;
        window.location.replace(`${base}/service-notes/${n.id}`);
      })
      .catch((e) => setError(e.message));
  }, [relative, data, refresh, base]);
  async function saveNote(n: ServiceNote, complete = false) {
    const saved = await repository.current!.saveNote(n, complete);
    await refresh();
    if (!complete) setToast("Service Note saved");
    return saved;
  }
  async function saveCustomer(
    c: Omit<Customer, "id" | "organization_id" | "created_at"> & {
      id?: string;
    },
  ) {
    const saved = await repository.current!.saveCustomer(c);
    await refresh();
    setToast("Customer saved");
    return saved;
  }
  if (!data)
    return (
      <div className="connection-screen">
        <div className="connection-panel">
          <Brand />
          {error ? (
            <>
              <h1>Unable to open workspace</h1>
              <p>{error}</p>
              <button
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </>
          ) : (
            <div className="loading-state">
              <span className="spinner" />
              Opening your workspace…
            </div>
          )}
        </div>
      </div>
    );
  const ownNotes =
    field || data.profile.role === "EMPLOYEE"
      ? data.notes.filter((n) => n.person_in_charge_id === data.profile.id)
      : data.notes;
  const parts = relative.split("/").filter(Boolean);
  const note = parts[1]
    ? data.notes.find(
        (n) =>
          n.id === parts[1] &&
          (data.profile.role === "ADMIN" ||
            n.person_in_charge_id === data.profile.id),
      )
    : undefined;
  let content: React.ReactNode;
  if (relative === "/" && field) content = <FieldHome data={data} />;
  else if (relative === "/dashboard" || path === "/")
    content = <Overview data={data} />;
  else if (relative === "/service-notes" || relative === "/reports") {
    const reports = relative === "/reports",
      status = params.get("status");
    content = (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {reports ? "Reports" : "Service Notes"}
            </h1>
            <p className="page-subtitle">
              {reports
                ? "Completed service records, ready to print and share."
                : "Document every service. Keep every detail."}
            </p>
          </div>
          {!reports && (
            <Link
              href={`${base}/service-notes/new`}
              className="btn btn-primary"
            >
              <Plus />
              New Service Note
            </Link>
          )}
        </div>
        {!reports && (
          <nav className="index-tabs" aria-label="Service Note status">
            {[
              { label: "All notes", status: "", count: ownNotes.length },
              {
                label: "Draft",
                status: "DRAFT",
                count: ownNotes.filter((n) => n.status === "DRAFT").length,
              },
              {
                label: "Completed",
                status: "COMPLETED",
                count: ownNotes.filter((n) => n.status === "COMPLETED").length,
              },
            ].map((t) => (
              <Link
                key={t.label}
                className={`index-tab ${(status ?? "") === t.status ? "active" : ""}`}
                href={`${base}/service-notes${t.status ? "?status=" + t.status : ""}`}
              >
                {t.label}
                <span>{t.count}</span>
              </Link>
            ))}
          </nav>
        )}
        <NotesTable
          notes={ownNotes}
          employees={data.employees}
          customers={data.customers}
          reports={reports}
          field={field}
        />
        {!field && (
          <p className="index-caption">
            <ShieldCheck />
            Completed Service Notes are signed records and cannot be edited.
          </p>
        )}
      </>
    );
  } else if (relative === "/service-notes/new")
    content = (
      <div className="loading-state">
        <span className="spinner" />
        Creating your Service Note…
      </div>
    );
  else if (parts[0] === "service-notes" && note) {
    if (parts[2] === "completed")
      content = isCompletedRecord(note) ? (
        <div className="completion-screen">
          <span className="completion-check">
            <Check />
          </span>
          <h1>Service Note Completed</h1>
          <p className="mono">{note.service_number}</p>
          <p>
            {note.finalization_type === "STAFF_ATTESTED"
              ? "Staff attestation recorded"
              : "Customer signature recorded"}
          </p>
          <div className="completion-actions">
            <Link
              className="btn btn-primary"
              href={`${base}/reports/${note.id}`}
            >
              <FileCheck2 />
              View Service Report
            </Link>
            <Link
              className="btn btn-secondary"
              href={field ? "/field" : "/service-notes"}
            >
              Done
            </Link>
          </div>
        </div>
      ) : (
        <DraftCompletionRedirect href={`${base}/service-notes/${note.id}`} />
      );
    else if (isCompletedRecord(note))
      content = (
        <NoteDetail
          note={note}
          organization={data.organization}
          field={field}
        />
      );
    else if (note.status === "DRAFT")
      content = (
        <NoteEditor
          key={note.id}
          note={note}
          customers={data.customers}
          employees={data.employees}
          trackedItems={data.tracked_items ?? []}
          field={field}
          onSave={(n) => saveNote(n)}
          onComplete={(n) => saveNote(n, true)}
          onCreateCustomer={saveCustomer}
          onCreateTrackedItem={async (item) => {
            const saved = await repository.current!.saveTrackedItem(item);
            await refresh();
            setToast("Item saved");
            return saved;
          }}
          onDone={(n) => {
            if (n.status === "COMPLETED")
              router.push(`${base}/service-notes/${n.id}/completed`);
          }}
        />
      );
    else content = null;
  } else if (parts[0] === "reports" && note && isCompletedRecord(note))
    content = (
      <ServiceReport
        note={note}
        organization={data.organization}
        field={field}
      />
    );
  else if (relative === "/customers" && !field)
    content = <Customers data={data} onSaveCustomer={saveCustomer} />;
  else if (parts[0] === "customers" && parts[1] && !field) {
    const customer = data.customers.find((c) => c.id === parts[1]);
    content = customer ? (
      <CustomerDetail
        customer={customer}
        data={data}
        onSaveCustomer={saveCustomer}
      />
    ) : null;
  } else if (
    relative === "/employees" &&
    data.profile.role === "ADMIN" &&
    !field
  )
    content = (
      <Employees
        data={data}
        onSaveEmployee={async (p) => {
          await repository.current!.saveEmployee(p);
          await refresh();
          setToast("Employee profile saved");
        }}
      />
    );
  else if (relative === "/settings" && data.profile.role === "ADMIN" && !field)
    content = (
      <Settings
        data={data}
        onSaveOrganization={async (o) => {
          await repository.current!.saveOrganization(o);
          await refresh();
          setToast("Organization settings saved");
        }}
      />
    );
  else if (relative === "/profile" && field)
    content = <FieldProfile data={data} />;
  else content = null;
  return (
    <Shell data={data}>
      {error && (
        <div
          className="error-message"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          {error}
          <button className="btn btn-ghost" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {content ?? (
        <div className="empty-state">
          <AlertCircle />
          <h1 className="page-title">Record not found</h1>
          <p>This record is not available in your workspace.</p>
          <Link
            className="btn btn-secondary"
            href={field ? "/field" : "/dashboard"}
          >
            Back to workspace
            <ChevronRight />
          </Link>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check />
          {toast}
        </div>
      )}
    </Shell>
  );
}
