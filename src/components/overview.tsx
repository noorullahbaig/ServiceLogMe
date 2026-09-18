"use client";
import Link from "next/link";
import {
  Plus,
  FilePlus2,
  FilePenLine,
  FileCheck2,
  Camera,
  ArrowUpRight,
} from "lucide-react";
import { NotesTable, NoteBadge } from "./notes-table";
import type { WorkspaceData } from "@/lib/types";
import { shortDate } from "@/lib/domain";
export function Overview({ data }: { data: WorkspaceData }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.organization.timezone,
  }).format(new Date());
  const metrics = [
    {
      label: "Created today",
      value: data.notes.filter(
        (n) =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: data.organization.timezone,
          }).format(new Date(n.created_at)) === today,
      ).length,
      caption: "Evidence reports created today",
      icon: FilePlus2,
      href: `/service-notes?createdFrom=${today}&createdTo=${today}`,
    },
    {
      label: "Draft",
      value: data.notes.filter((n) => n.status === "DRAFT").length,
      caption: "Ready to pick up where you left off",
      icon: FilePenLine,
      href: "/service-notes?status=DRAFT",
    },
    {
      label: "Completed",
      value: data.notes.filter((n) => n.status === "COMPLETED").length,
      caption: "Submitted and read-only",
      icon: FileCheck2,
      href: "/service-notes?status=COMPLETED",
    },
    {
      label: "Evidence photos",
      value: data.notes.reduce((total, note) => total + note.photos.length, 0),
      caption: "Photos attached to reports",
      icon: Camera,
      href: "/service-notes",
    },
  ];
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            A clear view of warehouse evidence and item condition.
          </p>
        </div>
        <Link href="/service-notes/new" className="btn btn-primary dashboard-create-btn">
          <Plus />
          Create Report
        </Link>
      </div>
      <div className="metric-grid">
        {metrics.map((m) => (
          <Link
            className="metric"
            href={m.href}
            key={m.label}
            aria-label={`View ${m.label.toLowerCase()} Reports`}
          >
            <div className="metric-top">
              <span>{m.label}</span>
              <m.icon />
            </div>
            <div className="metric-value">
              {m.value.toString().padStart(2, "0")}
            </div>
            <div className="metric-bottom">{m.caption}</div>
          </Link>
        ))}
      </div>
      <section className="overview-surface">
        <div className="surface-heading">
          <div>
            <h2>Recent Reports</h2>
            <p>Your latest warehouse evidence records.</p>
          </div>
          <Link className="surface-link" href="/service-notes">
            View all reports
            <ArrowUpRight />
          </Link>
        </div>
        <NotesTable notes={data.notes} compact />
      </section>
      <div className="overview-bottom">
        <section className="activity-panel">
          <div className="surface-heading">
            <h2>Recent activity</h2>
            <span className="eyebrow">Workspace</span>
          </div>
          {data.events.length ? (
            <div className="activity-list">
              {[...data.events]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 3)
                .map((e) => (
                  <div className="activity-row" key={e.id}>
                    <span className="activity-icon">
                      {e.type === "SERVICE_NOTE_COMPLETED" ? (
                        <FileCheck2 />
                      ) : e.type === "SERVICE_NOTE_CREATED" ? (
                        <FilePlus2 />
                      ) : (
                        <FilePenLine />
                      )}
                    </span>
                    <div className="activity-copy">
                      <strong>{e.actor_name}</strong>{" "}
                      {e.type === "SERVICE_NOTE_COMPLETED"
                        ? "completed"
                        : e.type === "SERVICE_NOTE_CREATED"
                          ? "created"
                          : "updated"}{" "}
                      <Link
                        className="mono"
                        href={`/service-notes/${e.note_id}`}
                      >
                        {e.service_number}
                      </Link>
                      <span className="activity-time">
                        {shortDate(e.created_at)} ·{" "}
                        {new Date(e.created_at).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="activity-empty">
              New activity will appear here as your team creates and completes
              Reports.
            </p>
          )}
        </section>
        <aside className="workspace-note">
          <span className="eyebrow">Built for warehouse teams</span>
          <h3>Evidence at the point of receipt.</h3>
          <p>
            Record an item, its storage location and visible condition from your phone.
          </p>
          <Link href="/field">
            Open field workspace
            <ArrowUpRight />
          </Link>
        </aside>
      </div>
    </>
  );
}
export function FieldHome({ data }: { data: WorkspaceData }) {
  const notes = data.notes.filter(
      (n) => n.person_in_charge_id === data.profile.id,
    ),
    drafts = notes.filter((n) => n.status === "DRAFT"),
    completed = notes.filter((n) => n.status === "COMPLETED");
  return (
    <>
      <div className="field-date">
        {new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
      </div>
      <div className="field-heading">
        <h1>Hello, {data.profile.full_name.split(" ")[0]}</h1>
        <span className="avatar">
          {data.profile.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </span>
      </div>
      <Link
        className="btn btn-primary field-create"
        href="/field/service-notes/new"
      >
        <Plus />
        Create Report
      </Link>
      {[
        { label: "Drafts", rows: drafts },
        { label: "Recent Reports", rows: completed },
      ].map((section) => (
        <section className="field-section" key={section.label}>
          <div className="field-section-header">
            <h2>
              {section.label}{" "}
              {section.label === "Drafts" && (
                <span
                  className="muted"
                  style={{ fontWeight: 400, fontSize: 12 }}
                >
                  ({drafts.length})
                </span>
              )}
            </h2>
            <Link
              href={`/field/service-notes${section.label === "Drafts" ? "?status=DRAFT" : ""}`}
            >
              View all
            </Link>
          </div>
          {section.rows.length ? (
            section.rows.slice(0, 3).map((n) => (
              <Link
                className="field-note"
                href={`/field/service-notes/${n.id}`}
                key={n.id}
              >
                <div className="field-note-head">
                  <span className="mono">{n.service_number}</span>
                  <NoteBadge value={n.status} />
                </div>
                <h3>{n.item_name_snapshot || "Item not described"}</h3>
                <p>{n.customer_name_snapshot || "Customer not selected"}</p>
                <div className="field-note-foot">
                  <span>{shortDate(n.created_at)}</span>
                  <strong>{n.location_snapshot || "Location pending"}</strong>
                </div>
              </Link>
            ))
          ) : (
            <div className="field-note">
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
                {section.label === "Drafts"
                  ? "You have no draft Reports."
                  : "Your completed Reports will appear here."}
              </p>
            </div>
          )}
        </section>
      ))}
    </>
  );
}
