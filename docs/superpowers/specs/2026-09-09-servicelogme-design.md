# ServiceLOGME implementation design

The authoritative product requirements are in `docs/master-product-plan.md`. This document resolves implementation choices without changing that scope.

## Repository inspection

On 9 September 2026 the project directory was empty and was not a Git repository. There is no framework, authentication, database, styling system, component library, or testing infrastructure to preserve. No ancestor AGENTS.md was found in the checked user and Developer directories.

## Approach

Use the requested Next.js App Router, React, TypeScript, Tailwind, Geist, Lucide, and Supabase stack. Keep one application with separate desktop and field navigation, shared domain logic, and a backend suitable for a later native client.

A browser-only implementation would make setup easier but would not satisfy authorization, permanent organization records, or authoritative completion. A custom authentication and database service would add operational work without improving this release's workflow. Supabase is the recommended approach.

## Application boundaries

- Presentation: desktop workspace, phone field workflow, printable report, PDF renderer.
- Domain: money calculations, input schemas, completion requirements, payment rules, permission predicates, immutable report types.
- Application services: authenticated draft creation and saving, customer operations, employee administration, photo registration, completion, report retrieval.
- Persistence: normalized PostgreSQL tables, organization-scoped row policies, transactional database functions, private object storage, audit events.

Use server-validated requests for every mutation. Never accept organization or person-in-charge identity from an untrusted client as authorization. Keep privileged Supabase credentials server-only. Server actions and route handlers call the same application services; browser clients never receive administrative credentials.

## Visual direction and first delivery gate

Visual thesis: a calm, precise operational workspace using white work surfaces, a pale gray canvas, restrained blue actions, fine separators, and dense readable typography.

Content hierarchy: navigation establishes location; the page header supplies the main action; the working surface contains the task; a secondary rail provides context and completion status. No marketing hero or decorative dashboard imagery.

Interaction direction: clear focus and hover feedback, short drawer transitions, and unobtrusive field-step transitions. Respect reduced-motion preferences.

Establish these seven surfaces before broad backend work:

1. Desktop shell with the specified navigation and role-dependent destinations.
2. Service Notes index with a compact table and purposeful empty, loading, and error states.
3. Desktop creation workspace with a continuous sectioned form and sticky summary rail.
4. Completed detail with static content and a record-context rail.
5. Report composition suitable for both screen and A4 output.
6. Phone field shell with three bottom-navigation destinations and seven creation steps.
7. Customer acceptance screen with employee navigation removed and a large touch signature area.

Fixtures belong only in development/test tooling. Screens under construction must not enter the normal product navigation until their visible actions work. Production starts with empty database-backed records. Visual inspection must cover 1440×900, 1280×800, 390×844, and 430×932.

## Authentication and organization boundaries

Use Supabase Auth with administrator-created invitations. Provision the first organization and administrator through a documented operator-only bootstrap process, with no public registration. Employee activation uses a real invitation and password setup flow.

Every protected request verifies the current authenticated user and an active profile. Administrators can access organization-wide records; employees can access their own notes and reports and search/select or quick-create organization customers. Customer master edits and organization-wide customer history are administrator-only; employee history views must contain only permitted notes.

RLS independently enforces organization membership, active status, ownership, and administrator operations. An inactive profile denies future protected operations even if an authentication session remains valid. Deactivation retains all existing records.

## Database and numbering

Use all normalized tables specified in the master plan, plus explicit constraints and organization-scoped foreign keys to prevent cross-organization references. Store timestamps in UTC and interpret service date/time using organization timezone, defaulting to Asia/Kuala_Lumpur. Default currency is MYR.

Number generation uses an organization/year counter updated atomically inside the draft-creation transaction. Format the returned counter as `SL-YYYY-NNNNNN`, allowing expansion beyond six digits. Numbers are assigned on first draft creation, never edited or recycled. Do not provide draft deletion in this release.

Resolve a conflict in the master plan: organization/year counters necessarily allow two organizations to have the same display number. Therefore enforce `UNIQUE (organization_id, service_number)` and use the internal UUID for globally unique identity, rather than a global unique constraint on the display number.

Create a real audit event in the same transaction as each successful creation, update, or completion. Add a revision field for optimistic concurrency so two open editors cannot silently overwrite one another.

## Draft editing and calculation

Drafts permit incomplete fields. Save the note and its structured labor, materials, and charges atomically; return the persisted revision and totals. Preserve unsaved form inputs if saving fails and display an actionable error.

Use one decimal-safe domain calculation module for frontend totals and the server's authoritative calculation. Parse decimal strings with a decimal library; never calculate currency with binary floating-point arithmetic. Round each line to two decimal places with half-up rounding, sum rounded lines, subtract the fixed currency discount, and calculate percentage tax on the discounted subtotal. Reject negative quantities, rates, charges, or discounts and discounts above subtotal. Persist two-decimal totals and a tax rate supporting three decimal places.

Paid requires an allowed payment method. Unpaid does not. Payment recording never implies processing. The completed record, including its payment information, is immutable for this release; subsequent settlement recording would require a separately designed audited workflow.

## Customer and employee snapshots

Derive person in charge from the authenticated employee when creating the note and retain their creation-time identity snapshot. Selecting a customer copies contact data into the draft for review. At completion, freeze the reviewed customer fields and existing employee identity snapshots so the signed report matches what the customer accepted. Later edits to master records never update a completed note.

## Photos and signatures

Use private storage with organization/note-scoped paths, bounded file sizes, and validated image formats. Authorize both upload and retrieval. Track genuine upload progress and errors, permit retry, and register metadata only after storage success. Compress large camera photos where practical and retain captured timestamps and categories. Material photos reference the relevant material entry.

Draft photo deletion removes both the authorized metadata and associated object with failure recovery. Completed objects cannot be replaced or deleted through normal user permissions. Report rendering uses short-lived authorized URLs or server-fetched image bytes.

Capture signatures with pointer events that support touch and mouse, device-pixel-ratio-aware rendering, clear, and confirm. Require actual strokes; reject blank submissions. Upload the confirmed signature to private storage before completion. Server time supplies the signing timestamp. Editing accepted content invalidates the signature confirmation and requires signing again.

## Completion transaction

The server validates the active user, ownership, draft state, revision, required fields, payment rules, and a stored confirmed signature bound to the accepted draft revision. It recalculates totals and calls a transactional database function restricted to the trusted server role.

The function locks the row, rechecks state and revision, freezes snapshots and totals, saves acceptance and completion timestamps, changes status to COMPLETED, and writes the audit event. A repeated completion request returns the already completed record without duplicating events. Database guards protect the note and all child records from later editing, including administrator edits.

Storage is not transactional with PostgreSQL: required assets must exist before completion begins. Failed completion leaves an editable draft and reusable uploaded assets. Orphan cleanup must never remove referenced completed assets.

## Reports and field experience

Build one authorized report-data projection consumed by read-only detail, browser printing, and React PDF. It includes immutable identity/contact snapshots, service narrative, line items, photos, totals, payment, signature, and timestamps. Check multi-page content, repeated table headings, long captions, and image sizing.

The field workflow reuses domain validation and services but has independent touch layouts and step navigation. Draft saving is available throughout. The acceptance step displays a concise reviewed summary and total. Successful completion navigates to a stable confirmation with report access.

Provide a manifest, application icons, and installable behavior where supported. Cache only safe static assets. This release requires connectivity for persisted edits, uploads, and completion; do not imply offline synchronization or cache private reports indiscriminately.

## Verification and delivery sequence

1. Initialize repository and application tooling; establish design tokens and the seven-screen visual gate.
2. Implement migrations, RLS, invitation/activation, active profiles, numbering, and audit events.
3. Connect drafts, customers, line items, photos, charges, totals, and payment to real persistence.
4. Implement signature acceptance, transactional completion, locking, report view, printing, and PDF.
5. Finish phone workflow, employee administration, organization settings, real overview/activity, and PWA assets.
6. Run accessibility, visual, security, integration, and critical workflow verification.

Unit tests cover decimal calculations, validation, permissions, and snapshots. Database integration tests cover concurrent numbering, cross-organization denial, deactivation, immutable parent/child records, atomic saving, stale revisions, and completion retries. Playwright covers the full employee-to-administrator acceptance workflow in the master plan, including an actual uploaded image and rendered signature/PDF.

A production-readiness claim requires a configured Supabase environment, exercised authentication/invitations, applied migrations, storage policies, successful tests, and inspected screens and reports. Provisioning remote infrastructure or publishing a deployment requires an available authorized account and target; missing credentials are an environment dependency, not a reason to substitute simulated backend behavior.

## Review status

Repository inspection and implementation design are complete. Application scaffolding and implementation have not started. This design is ready for the required design review.
