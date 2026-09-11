"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Files,
  X,
  ArrowUpRight,
} from "lucide-react";
import { money, shortDate, initials, searchableNoteText } from "@/lib/domain";
import type { ServiceNote, Profile, Customer } from "@/lib/types";
import "./workspace.css";
export function NoteBadge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}
export function NotesTable({
  notes,
  employees = [],
  customers = [],
  compact = false,
  reports = false,
  field = false,
}: {
  notes: ServiceNote[];
  employees?: Profile[];
  customers?: Customer[];
  compact?: boolean;
  reports?: boolean;
  field?: boolean;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: reports ? "completed_at" : "service_date", desc: true },
  ]);
  const query = compact ? "" : (params.get("q") ?? ""),
    status = compact ? "" : (params.get("status") ?? ""),
    payment = compact ? "" : (params.get("payment") ?? ""),
    employee = compact ? "" : (params.get("employee") ?? ""),
    customer = compact ? "" : (params.get("customer") ?? ""),
    from = compact ? "" : (params.get("from") ?? ""),
    to = compact ? "" : (params.get("to") ?? ""),
    createdFrom = compact ? "" : (params.get("createdFrom") ?? ""),
    createdTo = compact ? "" : (params.get("createdTo") ?? "");
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${path}${next.size ? "?" + next : ""}`, { scroll: false });
  }
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) =>
          (!reports || n.status === "COMPLETED") &&
          (!status || n.status === status) &&
          (!payment || n.payment_status === payment) &&
          (!employee || n.person_in_charge_id === employee) &&
          (!customer || n.customer_id === customer) &&
          (!from || n.service_date >= from) &&
          (!to || n.service_date <= to) &&
          (!createdFrom || n.created_at.slice(0, 10) >= createdFrom) &&
          (!createdTo || n.created_at.slice(0, 10) <= createdTo) &&
          (!query || searchableNoteText(n).includes(query.toLowerCase())),
      ),
    [
      notes,
      reports,
      status,
      payment,
      employee,
      customer,
      from,
      to,
      createdFrom,
      createdTo,
      query,
    ],
  );
  const activeFilters =
    [status, payment, employee, customer, from, to].filter(Boolean).length +
    (createdFrom || createdTo ? 1 : 0);
  const prefix = field ? "/field" : "";
  const columns = useMemo<ColumnDef<ServiceNote>[]>(
    () => [
      {
        accessorKey: "service_number",
        header: "Service #",
        cell: ({ row }) => (
          <Link
            href={`${prefix}/${reports ? "reports" : "service-notes"}/${row.original.id}`}
            className="note-number mono"
          >
            {row.original.service_number}
          </Link>
        ),
      },
      {
        accessorKey: reports ? "completed_at" : "service_date",
        header: reports ? "Completed" : "Date",
        cell: ({ row }) => (
          <span className="table-date">
            {shortDate(
              reports
                ? (row.original.completed_at ?? row.original.service_date)
                : row.original.service_date,
            )}
          </span>
        ),
      },
      {
        accessorKey: "customer_name_snapshot",
        header: "Customer",
        cell: ({ getValue }) => (
          <span className="table-customer" title={String(getValue() || "")}>
            {String(getValue() || "Customer not selected")}
          </span>
        ),
      },
      {
        accessorKey: "job_title",
        header: "Job title",
        cell: ({ row }) => (
          <Link
            className="table-job"
            href={`${prefix}/service-notes/${row.original.id}`}
            title={row.original.job_title}
          >
            {row.original.job_title || "Untitled Service Note"}
          </Link>
        ),
      },
      {
        accessorKey: "person_in_charge_name_snapshot",
        header: "Person in charge",
        cell: ({ getValue }) => (
          <div className="cell-person">
            <span className="avatar">{initials(String(getValue()))}</span>
            <span className="table-person">{String(getValue())}</span>
          </div>
        ),
      },
      {
        accessorKey: "grand_total",
        header: "Total",
        sortingFn: (a, b) =>
          Number(a.original.grand_total) - Number(b.original.grand_total),
        cell: ({ getValue }) => (
          <span className="table-amount">{money(String(getValue()))}</span>
        ),
        meta: { numeric: true },
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ getValue }) => <NoteBadge value={String(getValue())} />,
      },
      ...(reports
        ? [
            {
              id: "report",
              header: "",
              enableSorting: false,
              cell: ({ row }: { row: { original: ServiceNote } }) => (
                <Link
                  className="table-report-link"
                  href={`${prefix}/reports/${row.original.id}`}
                >
                  View <ArrowUpRight size={12} />
                </Link>
              ),
            },
          ]
        : [
            {
              accessorKey: "status",
              header: "Status",
              cell: ({ getValue }: { getValue: () => unknown }) => (
                <NoteBadge value={String(getValue())} />
              ),
            },
          ]),
    ],
    [reports, prefix],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: compact ? 6 : 10 } },
  });
  return (
    <div className={`notes-surface ${compact ? "notes-compact" : ""}`}>
      {!compact && (
        <>
          <div className="notes-toolbar">
            <label className="search-input">
              <Search size={15} />
              <input
                aria-label="Search service notes"
                placeholder="Search service #, customer, employee…"
                value={query}
                onChange={(e) => filter("q", e.target.value)}
              />
              {query && (
                <button
                  aria-label="Clear search"
                  onClick={() => filter("q", "")}
                >
                  <X size={13} />
                </button>
              )}
            </label>
            <div className="toolbar-actions">
              {!reports && (
                <label className="toolbar-select">
                  <span className="sr-only">Status</span>
                  <select
                    aria-label="Status"
                    value={status}
                    onChange={(e) => filter("status", e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <ChevronDown size={13} />
                </label>
              )}
              <button
                className={`btn btn-secondary filter-button ${filtersOpen ? "is-open" : ""}`}
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal />
                Filters
                {activeFilters > 0 && (
                  <span className="filter-count">{activeFilters}</span>
                )}
              </button>
            </div>
          </div>
          {(createdFrom || createdTo) && (
            <div className="applied-filter" role="status">
              Created {createdFrom || "any time"}
              {createdTo && createdTo !== createdFrom ? ` to ${createdTo}` : ""}
              <button
                type="button"
                aria-label="Clear creation date filter"
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  next.delete("createdFrom");
                  next.delete("createdTo");
                  router.replace(`${path}${next.size ? `?${next}` : ""}`, {
                    scroll: false,
                  });
                }}
              >
                <X size={13} /> Clear
              </button>
            </div>
          )}
          {filtersOpen && (
            <div className="filter-panel">
              <label className="field">
                From date
                <input
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => filter("from", e.target.value)}
                />
              </label>
              <label className="field">
                To date
                <input
                  className="input"
                  type="date"
                  value={to}
                  onChange={(e) => filter("to", e.target.value)}
                />
              </label>
              <label className="field">
                Employee
                <select
                  aria-label="Employee"
                  className="select"
                  value={employee}
                  onChange={(e) => filter("employee", e.target.value)}
                >
                  <option value="">All employees</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Payment
                <select
                  aria-label="Payment"
                  className="select"
                  value={payment}
                  onChange={(e) => filter("payment", e.target.value)}
                >
                  <option value="">All payments</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </label>
              {reports && (
                <label className="field">
                  Customer
                  <select
                    aria-label="Customer"
                    className="select"
                    value={customer}
                    onChange={(e) => filter("customer", e.target.value)}
                  >
                    <option value="">All customers</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => router.replace(path, { scroll: false })}
              >
                <X size={14} />
                Clear
              </button>
            </div>
          )}
        </>
      )}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Files />
          <h3>
            {notes.length
              ? "No matching Service Notes"
              : "No Service Notes yet"}
          </h3>
          <p>
            {notes.length
              ? "Try a different search or adjust your filters."
              : "Create a Service Note to begin documenting service visits."}
          </p>
          {notes.length > 0 ? (
            <button
              className="btn btn-secondary"
              onClick={() => router.replace(path)}
            >
              Clear filters
            </button>
          ) : (
            !reports && (
              <Link
                className="btn btn-primary"
                href={`${prefix}/service-notes/new`}
              >
                New Service Note
              </Link>
            )
          )}
        </div>
      ) : field ? (
        <div className="field-notes-list">
          {table.getRowModel().rows.map(({ original: n }) => (
            <Link
              className="field-note"
              key={n.id}
              href={`${prefix}/${reports ? "reports" : "service-notes"}/${n.id}`}
            >
              <div className="field-note-head">
                <span className="mono">{n.service_number}</span>
                <NoteBadge value={n.status} />
              </div>
              <h3>{n.job_title || "Untitled Service Note"}</h3>
              <p>{n.customer_name_snapshot || "Customer not selected"}</p>
              <div className="field-note-foot">
                <span>{shortDate(n.service_date)}</span>
                <strong>{money(n.grand_total)}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table notes-table">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      className={header.id === "grand_total" ? "numeric" : ""}
                    >
                      <button
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() && (
                          <ArrowUpDown size={10} />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a,button"))
                      router.push(
                        `${prefix}/${reports ? "reports" : "service-notes"}/${row.original.id}`,
                      );
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={
                        cell.column.id === "grand_total" ? "numeric" : ""
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && filtered.length > 0 && (
        <div className="table-footer">
          <span>
            Showing {table.getState().pagination.pageIndex * 10 + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 10,
              filtered.length,
            )}{" "}
            of {filtered.length} Service Notes
          </span>
          <div className="pagination">
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={15} />
            </button>
            <span>{table.getState().pagination.pageIndex + 1}</span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
