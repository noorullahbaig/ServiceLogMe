# ServiceLOGME — Master Product, UX and Implementation Plan

## Mission

Build **ServiceLOGME**, a premium digital Field Service Note platform for service businesses.

ServiceLOGME replaces handwritten service notes, disconnected photos, spreadsheets, WhatsApp messages, and manual paperwork with one structured digital workflow:

**Employee signs in → creates a Service Note → records customer and service information → records labor and materials → attaches supporting photos → records charges and payment information → customer reviews and signs → Service Note is completed → professional report becomes immediately available → record remains permanently searchable by the organization.**

The initial release must behave and present itself like credible commercial software.

It must never visually communicate:

* prototype
* proof of concept
* hackathon project
* unfinished system
* fake SaaS interface
* “vibe coded” application
* student project
* temporary demo

There should be no user-facing indication that functionality is intentionally limited for an initial release.

If a feature is not implemented, **do not show it**.

---

# 1. PRODUCT PRINCIPLE

The central domain object is:

# SERVICE NOTE

Do not restructure the product around:

* Jobs
* Work Orders
* Tickets
* Dispatches
* Appointments

unless future requirements explicitly introduce those concepts.

Core model:

```text
Organization
│
├── Employees
├── Customers
│
└── Service Notes
     │
     ├── Service Information
     ├── Labor
     ├── Materials
     ├── Photos
     ├── Additional Charges
     ├── Financial Summary
     ├── Payment
     ├── Customer Acceptance
     └── Service Report
```

Everything should reinforce this model.

---

# 2. PRODUCT POSTURE

ServiceLOGME should present itself as a complete product within its supported scope.

Never use user-facing language such as:

* Demo
* Preview
* Beta
* Prototype
* Mock
* Sample Mode
* Test Data
* Coming Soon
* Placeholder
* Not Implemented
* Future Feature

Do not display disabled buttons for functionality that does not exist.

Do not create fake integrations.

Do not create decorative controls with no behavior.

Do not display artificial charts or numbers that are not backed by stored application data.

Every visible action must do one of three things:

1. work correctly,
2. navigate somewhere meaningful,
3. be removed.

---

# 3. PLATFORM STRATEGY

Build one product with two intentionally designed surfaces.

## Primary Surface — Desktop Web

Used by:

* administrators
* office employees
* supervisors
* service employees working from desktop
* accounts/operations staff

Desktop establishes the primary information architecture and design language.

## Secondary Surface — Phone Field Experience

Used by technicians/employees while servicing customers.

Suggested route group:

```text
/field/*
```

The mobile experience must be intentionally designed for touch.

Do not simply collapse the desktop interface.

---

# 4. NATIVE APP STRATEGY

For this release, build a high-quality responsive web application/PWA.

It must function correctly on:

* desktop browsers
* iPhone Safari
* Android Chrome

Support:

* mobile camera input
* gallery/file selection
* touch signature capture
* installable PWA behavior where supported
* responsive layout

Do not maintain separate Swift, Kotlin, or React Native clients yet.

The architecture must remain compatible with a later native client using the same backend.

---

# 5. EXISTING REPOSITORY RULE

Before changing code:

1. inspect the repository
2. identify current framework
3. identify current authentication
4. identify current database
5. identify styling conventions
6. identify existing design components
7. identify testing infrastructure

If an application already exists, preserve sound existing architecture.

Do not rewrite a functioning codebase merely to match this document.

If greenfield, use the recommended stack below.

---

# 6. RECOMMENDED STACK

## Frontend

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* Radix primitives or shadcn primitives where useful

Important:

**Do not expose default shadcn styling as the product identity.**

Create a bespoke ServiceLOGME interface.

## Backend

Recommended:

* Supabase PostgreSQL
* Supabase Authentication
* Supabase Storage
* Row Level Security

## Forms

* React Hook Form
* Zod

## Tables

* TanStack Table

## Icons

* Lucide

Use one icon family only.

## Signature

Use a lightweight signature canvas implementation.

Store finalized signatures securely in object storage.

## PDF

Create a real Service Report PDF implementation.

Use:

* React PDF

or:

* reliable server-side PDF generation

Also support high-quality browser printing.

## Testing

* Vitest
* React Testing Library
* Playwright

---

# 7. AUTHENTICATION

Roles:

```text
ADMIN
EMPLOYEE
```

## Admin capabilities

* access organization overview
* create Service Notes
* view all organization Service Notes
* manage customers
* manage employees
* access reports
* view financial information
* manage organization settings

## Employee capabilities

* create Service Notes
* save drafts
* edit own drafts
* complete own Service Notes
* search/select customers
* view own historical Service Notes
* view generated reports for permitted records

Employees must not manage:

* employees
* organization settings
* other organizations' information

Authorization must be enforced server-side.

Do not rely only on hiding menu items.

---

# 8. EMPLOYEE ACCOUNTS

No unrestricted public employee registration.

Flow:

```text
Admin creates/invites employee
        ↓
Employee activates account
        ↓
Employee signs in
```

Employee fields:

```text
Full Name
Employee ID
Job Title / Classification
Email
Mobile Number
Role
Status
```

Statuses:

```text
ACTIVE
INACTIVE
```

Deactivating an employee must preserve historical Service Notes.

---

# 9. PERSON IN CHARGE

When an employee creates a Service Note:

**Person In Charge must automatically derive from the authenticated employee.**

Example:

```text
Amir Malik
Service Technician
EMP-0018
```

Do not present this as an ordinary editable text input.

Display it as authenticated identity.

Store snapshots:

```text
person_in_charge_name_snapshot
person_in_charge_job_title_snapshot
person_in_charge_employee_id_snapshot
```

Historical reports must remain unchanged if the employee's profile changes later.

---

# 10. CUSTOMERS

Customer records exist to support service operations.

Customer fields:

```text
Company / Customer Name
Primary Contact
Contact Position
Mobile Number
Office Number
Email
Address
Notes
```

Support:

* create
* edit
* search
* select
* customer history

During Service Note creation, permit quick customer creation without abandoning the current workflow.

Do not build:

* lead scoring
* sales pipeline
* opportunities
* campaigns
* marketing automation

ServiceLOGME is not a CRM.

---

# 11. SERVICE NOTE NUMBERING

Service Notes require human-readable sequential numbers.

Format:

```text
SL-2026-000001
SL-2026-000002
SL-2026-000003
```

Requirements:

* server-generated
* automatic
* atomic
* unique
* not editable by user
* never reused
* safe under concurrent creation

Store an internal UUID separately.

Use organization/year-based atomic counters.

---

# 12. SERVICE NOTE STATES

Supported states:

```text
DRAFT
COMPLETED
```

Do not expose artificial operational statuses that the system does not genuinely support.

No:

* Scheduled
* En Route
* Assigned
* Arrived
* In Progress
* Awaiting Dispatch

A note is either being prepared or formally completed.

---

# 13. SERVICE NOTE STRUCTURE

Each Service Note contains:

## Identity

```text
Service Note Number
Status
Date
Time
Person In Charge
```

## Customer

```text
Customer
Contact Person
Contact Position
Mobile
Office
Email
Address
```

## Service

```text
Job Title
Job Description / Reported Issue
Work Performed
Result / Remarks
Additional Notes
```

## Labor

```text
Worker
Classification
Hours
Rate
Total
Notes
```

## Materials

```text
Description
Part Number
Quantity
Unit Amount
Total
Optional Photo
```

## Photos

```text
Image
Category
Caption
Timestamp
```

## Additional Charges

```text
Description
Amount
```

## Financial Summary

```text
Labor Total
Material Total
Additional Charges
Subtotal
Discount
Tax
Grand Total
```

## Payment

```text
Payment Status
Payment Method
Payment Terms
Reference
Remarks
```

## Customer Acceptance

```text
Signer Name
Signer Position
Signature
Signed Timestamp
```

---

# 14. SERVICE INFORMATION

Use structured fields.

## Job Title

Example:

```text
Air Compressor Service
```

## Job Description / Reported Issue

Example:

```text
Customer reported abnormal compressor pressure and intermittent pressure loss during operation.
```

## Work Performed

Example:

```text
Inspected the compressor and identified a faulty pressure regulator. Replaced the regulator and seal kit, then pressure-tested the system.
```

## Result / Remarks

Example:

```text
System operating normally. Pressure remained stable during testing.
```

## Additional Notes

Optional.

Do not collapse all of this into one generic textarea.

---

# 15. LABOR

Support multiple labor entries.

Fields:

```text
Employee optional
Name
Classification
Hours
Hourly Rate
Total
Notes optional
```

Registered employees may be selected.

Manual entries must also be permitted for subcontractors or external specialists.

Calculate:

```text
hours × hourly rate = labor entry total
```

Then:

```text
sum(all labor entries) = labor total
```

---

# 16. MATERIALS

Materials document what was used during service.

They do not represent warehouse inventory.

Fields:

```text
Description
Part Number optional
Quantity
Unit Amount optional
Total
Photo optional
```

Support multiple entries.

Do not add:

* stock levels
* warehouses
* reorder alerts
* purchase orders

unless separately requested.

---

# 17. PHOTOS

Support:

* mobile camera
* phone gallery
* desktop upload
* multiple images
* thumbnail preview
* categories
* captions
* deletion while draft
* retry after upload failure

Categories:

```text
BEFORE
SERVICE
MATERIAL
AFTER
OTHER
```

Do not build unnecessary image editing or AI analysis.

---

# 18. PHOTO UPLOAD EXPERIENCE

Image upload must behave like a real product.

Show local state such as:

```text
Uploading…
```

then:

```text
Uploaded
```

On failure:

```text
Upload failed
Retry
```

Use client-side compression for excessively large photos where practical.

Do not freeze the entire Service Note form while unrelated photos upload.

Do not fake successful upload states.

---

# 19. ADDITIONAL CHARGES

Support generic charges:

```text
Description
Amount
```

Examples:

```text
Travel
Parking
Site access fee
Other service charge
```

Do not hard-code a specialized travel system unless the business later requires it.

---

# 20. FINANCIAL SUMMARY

Financial totals and payment state are separate concepts.

Calculate:

```text
Labor                       RM200
Materials                   RM325
Additional Charges           RM50
────────────────────────────────
Subtotal                     RM575

Discount                       RM0
Tax                            RM0
────────────────────────────────
Grand Total                  RM575
```

All calculations must derive from shared business logic.

Do not duplicate calculation logic across:

* desktop
* mobile
* PDF

Use decimal-safe calculations.

---

# 21. TAX

Support an optional percentage tax field.

Example:

```text
Tax Rate
6%
```

Compute tax from the discounted subtotal.

Do not build a tax engine.

---

# 22. PAYMENT

Payment recording only.

No fake card processor.

No fake DuitNow integration.

No fake FPX checkout.

Statuses:

```text
PAID
UNPAID
```

Methods:

```text
Cash
Card
DuitNow
FPX / Online Banking
Bank Transfer
Credit
Other
```

Terms:

```text
Immediate
7 Days
14 Days
30 Days
Custom
```

Fields:

```text
Payment Status
Payment Method
Payment Terms
Reference Number
Remarks
```

Rules:

If `UNPAID`, method is not required.

If `PAID`, payment method is required.

The system records the payment information; it does not claim to have processed the payment.

---

# 23. CUSTOMER ACCEPTANCE

Completion requires customer acceptance.

Capture:

```text
Signer Name
Signer Position
Signature
Signed Timestamp
```

Acceptance copy:

> I confirm that the service described above has been performed and acknowledge the information recorded in this Service Note.

Signature canvas must be touch-friendly.

Controls:

```text
Clear
Confirm Signature
```

---

# 24. COMPLETION VALIDATION

Draft Service Notes may be incomplete.

Completion requires:

```text
Job Title
Date
Time
Person In Charge
Customer
Contact Number
Work Performed
Payment Status
Signer Name
Signature
```

Labor optional.

Materials optional.

Photos optional.

Additional Charges optional.

Validation must show precise missing information.

Do not allow meaningless completion through placeholder values.

---

# 25. COMPLETION TRANSACTION

When `Complete Service Note` is selected:

1. validate required fields
2. verify signature exists
3. recalculate authoritative totals
4. persist customer and employee snapshots
5. set state to `COMPLETED`
6. save `completed_at`
7. write audit event
8. lock normal editing
9. make report available immediately

This must happen reliably server-side.

---

# 26. COMPLETED RECORDS

Completed Service Notes are read-only.

Do not expose editable form controls.

Do not silently mutate historical snapshots.

This gives the completed record an authoritative quality.

A future amendment/versioning system may be implemented separately.

---

# 27. REPORTS

Every completed Service Note has a professional customer-facing Service Report.

The report must contain:

```text
Organization branding
Service Note number
Date / time
Person In Charge

Customer
Contact
Address

Job Title
Reported Issue
Work Performed
Result / Remarks

Labor
Materials
Additional Charges

Photos

Financial Summary
Payment Information

Customer Acceptance
Signature
Signed Timestamp
```

Provide real:

* report view
* print
* PDF download

Do not show a fake Download button if PDF generation is unavailable.

---

# 28. DESKTOP NAVIGATION

Use:

```text
ServiceLOGME

Overview
Service Notes
Customers
Employees
Reports

────────────

Settings

Sarah Lim
Operations Manager
```

Do not fill the sidebar with modules simply to make the application look larger.

---

# 29. DESKTOP OVERVIEW

Route:

```text
/dashboard
```

Purpose:

Fast operational visibility.

Header:

```text
Overview
```

Primary action:

```text
+ New Service Note
```

Use real calculated metrics:

```text
Created Today
Draft
Completed
Unpaid
```

These values must derive from application data.

Do not hard-code impressive numbers.

Do not create meaningless charts.

Primary content:

# Recent Service Notes

Columns:

```text
Service #
Date
Customer
Job
Person In Charge
Total
Payment
Status
```

Secondary:

Recent Activity.

---

# 30. SERVICE NOTES INDEX

Route:

```text
/service-notes
```

Header:

```text
Service Notes
+ New Service Note
```

Search:

```text
Search service #, customer, employee…
```

Filters:

```text
Date
Status
Employee
Payment
```

Table:

```text
Service #
Date
Customer
Job Title
Person In Charge
Total
Payment
Status
```

Requirements:

* real filtering
* real search
* sorting where useful
* pagination if needed
* clickable rows
* good hover/focus states
* URL-based filters where practical

Do not implement fake filter controls.

---

# 31. DESKTOP NEW SERVICE NOTE

Route:

```text
/service-notes/new
```

This is the core creation workspace.

Use:

```text
Main Workspace + Sticky Summary Rail
```

Do not use card soup.

Use one continuous work surface with:

* section titles
* whitespace
* separators
* deliberate grouping

Sections:

```text
Service Information
Customer
Service Details
Labor
Materials
Photos
Additional Charges
Financial Summary
Payment
Customer Acceptance
```

---

# 32. STICKY SUMMARY RAIL

Show real note state.

Example:

```text
SERVICE NOTE

SL-2026-000125

Draft

Completion

✓ Service Information
✓ Customer
○ Service Details
○ Payment
○ Customer Signature

Total
RM575

[Save Draft]

[Complete Service Note]
```

Only required sections should count as incomplete.

Optional sections must not produce misleading warning states.

Buttons must be functional.

---

# 33. LABOR EDITOR

Use compact structured rows.

Example:

```text
LABOR

Worker              Hours       Rate        Total

Amir Malik            2.5       RM80        RM200
Service Technician

Daniel Wong            1.0       RM70         RM70

                                   Labor Total RM270

+ Add Labor
```

Editing may use a drawer or compact dialog.

The dialog must support real save/cancel behavior.

---

# 34. MATERIAL EDITOR

Example:

```text
MATERIALS

Material               Part       Qty       Amount

Pressure Regulator     PR-438      1         RM280
Seal Kit               SK-20       1          RM45

                                    Total    RM325

+ Add Material
```

Keep it compact.

---

# 35. COMPLETED SERVICE NOTE DETAIL

Route:

```text
/service-notes/[id]
```

This is the authoritative record.

Main content:

```text
Service
Labor
Materials
Photos
Financial Summary
Payment
Customer Acceptance
```

Context rail:

```text
Customer
Person In Charge
Date / Time
Created
Completed
Report
```

Actions:

```text
View Report
Download PDF
Print
```

Only show actions that actually work.

---

# 36. CUSTOMERS

Route:

```text
/customers
```

Provide:

* search
* create
* edit
* customer table

Columns:

```text
Customer
Primary Contact
Phone
Location
Service Notes
Last Service
```

---

# 37. CUSTOMER DETAIL

Route:

```text
/customers/[id]
```

Show:

```text
Customer Identity
Contact Information
Address
Notes
Service History
```

Service History:

```text
Service #
Date
Job
Person In Charge
Total
Payment
Status
```

This history must come from real Service Note records.

---

# 38. EMPLOYEES

Admin only.

Route:

```text
/employees
```

Features:

* employee list
* create/invite
* edit
* activate/deactivate

Columns:

```text
Employee
Employee ID
Job Title
Email
Role
Status
```

Do not present self-service registration.

---

# 39. REPORTS INDEX

Route:

```text
/reports
```

Show completed Service Notes.

Search:

```text
Service #
Customer
Employee
```

Filters:

```text
Date
Customer
Employee
Payment
```

Columns:

```text
Service #
Completed
Customer
Job Title
Person In Charge
Total
Payment
View Report
```

---

# 40. MOBILE NAVIGATION

Route group:

```text
/field
```

Bottom navigation:

```text
Home
Service Notes
Profile
```

Primary action:

```text
+ New Service Note
```

Do not expose desktop administration concepts on field navigation.

---

# 41. MOBILE HOME

Show:

```text
ServiceLOGME

Hello, Amir

+ New Service Note
```

Then:

## Drafts

Employee's real draft records.

## Recent Service Notes

Employee's recent completed records.

Do not show fake assignments or schedules.

---

# 42. MOBILE NEW SERVICE NOTE

Route:

```text
/field/service-notes/new
```

Use a guided workflow:

```text
1 Details
2 Customer
3 Service
4 Labor & Materials
5 Photos
6 Payment
7 Sign
```

The step indicator should remain subtle.

Allow draft saving during the workflow.

---

# 43. MOBILE DETAILS

Fields:

```text
Job Title
Date
Time
```

Person In Charge:

```text
Amir Malik
Service Technician
```

Read-only authenticated identity.

Primary:

```text
Continue
```

---

# 44. MOBILE CUSTOMER

Support:

```text
Search customers…
```

and:

```text
+ Add Customer
```

The Add Customer flow must actually create a reusable customer record.

After selection:

```text
ABC Engineering Sdn Bhd

Ahmad Rahman
Maintenance Manager
+60 12 345 6789
```

---

# 45. MOBILE SERVICE

Fields:

```text
Reported Issue
Work Performed
Result / Remarks
Additional Notes
```

Provide comfortable textarea sizing.

---

# 46. MOBILE LABOR & MATERIALS

Labor may prefill the logged-in employee as the first suggested worker but must not invent hours/rate.

Support:

```text
+ Add Labor
+ Add Material
```

Use sheets/dialogs optimized for touch.

---

# 47. MOBILE PHOTOS

Primary:

```text
Take Photo
```

Secondary:

```text
Choose From Library
```

Display real uploaded thumbnails.

Categories:

```text
Before
Service
Material
After
Other
```

Show real upload status.

---

# 48. MOBILE PAYMENT

Show calculated total.

Then:

```text
Paid
Unpaid
```

Conditional fields based on payment status.

No payment-processing UI.

No fake payment success screens.

---

# 49. MOBILE CUSTOMER SIGNATURE

Temporarily remove normal employee navigation.

Present a clean customer-facing screen.

Show:

```text
ServiceLOGME

SERVICE COMPLETION

SL-2026-000125

ABC Engineering Sdn Bhd

Air Compressor Service

Total
RM575
```

Then:

* concise service summary
* acceptance statement
* signer name
* position
* signature canvas

Primary:

```text
CONFIRM & SIGN
```

This is a customer-facing moment and must look particularly polished.

---

# 50. COMPLETION

After successful server completion:

```text
✓

Service Note Completed

SL-2026-000125

Customer signature recorded
```

Actions:

```text
View Service Report
Done
```

No fake celebratory animation.

No “demo completed” language.

---

# 51. DESIGN CONCEPT

The product visual concept is:

# MODERN OPERATIONAL WORKSPACE

It should feel:

* premium
* precise
* calm
* dependable
* contemporary
* commercially credible

Avoid:

* generic shadcn
* generic Tailwind SaaS
* Bootstrap admin
* old ERP
* industrial control panel
* glassmorphism
* AI-dashboard aesthetic
* student-project composition

---

# 52. VISUAL SYSTEM

Recommended palette:

```text
Canvas             #F7F8FA
Surface            #FFFFFF

Primary Text       #111318
Secondary Text     #687386
Muted Text         #8B95A5

Border             #E4E8EE

Primary Blue       #2856E8
Primary Hover      #2148C7

Success            #16803A
Success Surface    #ECF8F0

Warning            #A96700
Warning Surface    #FFF7E6

Danger             #C63B38
Danger Surface     #FFF0EF
```

Use blue sparingly.

Do not paint the whole application blue.

Typography:

```text
Geist
```

Optional identifiers:

```text
Geist Mono
```

Use mono selectively for:

```text
SL-2026-000124
EMP-0018
```

---

# 53. DESIGN RULES

Use:

* excellent typography
* clear hierarchy
* compact professional tables
* whitespace
* separators
* strong alignment
* subtle backgrounds
* restrained radii

Avoid:

* excessive cards
* excessive pills
* thick shadows
* gradients
* huge metrics
* decorative charts
* oversized page headers
* excessive empty space

Desktop should look designed for desktop.

Mobile should look designed for mobile.

---

# 54. REAL PRODUCT RULE

Never hard-code visible operational data into production components.

Application records must come from the database.

Development fixtures/seed scripts are allowed for local development and automated testing.

They must not appear to users as:

```text
Demo Account
Sample Customer
Test Record
Demo Data
```

Development data should use normal realistic business names and records without labels announcing that it is artificial.

Production environments should not automatically seed illustrative records.

---

# 55. NO FAKE FEATURES

Strict rule:

Do not add:

* buttons without handlers
* menu items without pages
* filters that don't filter
* search that doesn't search
* upload controls that don't upload
* PDF buttons that don't generate PDF
* print buttons that don't print
* invitation actions that don't persist/send expected account behavior
* fake payment processing
* fake notifications
* fake live-sync indicators

If functionality is not ready:

**remove the visible control.**

---

# 56. EMPTY STATES

Empty states must make the product still feel complete.

Example:

```text
No Service Notes yet

Create a Service Note to begin documenting service visits.

[New Service Note]
```

Do not say:

```text
Nothing here in this demo
Feature coming soon
```

---

# 57. ERRORS

Use precise messages:

```text
Customer signature is required before completing this Service Note.
```

```text
Payment method is required when payment status is Paid.
```

```text
Photo upload failed. Try again.
```

Errors should be actionable and professional.

---

# 58. DATABASE

Use normalized tables:

```text
organizations
profiles
customers
service_note_counters
service_notes
service_note_labor
service_note_materials
service_note_charges
service_note_photos
service_note_signatures
audit_events
```

All business records require organization scoping.

---

# 59. SERVICE NOTE DATABASE FIELDS

`service_notes` should contain:

```text
id UUID PK
organization_id UUID FK

service_number TEXT UNIQUE
status ENUM DRAFT | COMPLETED

job_title TEXT
job_description TEXT nullable
work_performed TEXT
result_remarks TEXT nullable
additional_notes TEXT nullable

service_date DATE
service_time TIME

person_in_charge_id UUID

person_in_charge_name_snapshot TEXT
person_in_charge_job_title_snapshot TEXT
person_in_charge_employee_id_snapshot TEXT

customer_id UUID nullable

customer_name_snapshot TEXT
contact_name_snapshot TEXT
contact_position_snapshot TEXT nullable
contact_mobile_snapshot TEXT
contact_office_snapshot TEXT nullable
contact_email_snapshot TEXT nullable
customer_address_snapshot TEXT nullable

labor_total NUMERIC(12,2)
material_total NUMERIC(12,2)
additional_charge_total NUMERIC(12,2)

subtotal NUMERIC(12,2)
discount_amount NUMERIC(12,2)
tax_rate NUMERIC(6,3)
tax_amount NUMERIC(12,2)
grand_total NUMERIC(12,2)

payment_status ENUM PAID | UNPAID
payment_method TEXT nullable
payment_terms TEXT nullable
payment_reference TEXT nullable
payment_remarks TEXT nullable

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
completed_at TIMESTAMPTZ nullable
```

---

# 60. CALCULATIONS

Centralize:

```text
laborTotal
materialTotal
additionalTotal
subtotal
discount
tax
grandTotal
```

The server remains authoritative.

Client calculations may provide immediate previews, but final persisted totals must be server-validated.

---

# 61. SNAPSHOTS

Completed historical records must not change when master data changes.

Snapshot:

* employee identity
* employee job title
* customer name
* customer contact
* customer address

on the Service Note.

---

# 62. AUDIT EVENTS

Support at minimum:

```text
SERVICE_NOTE_CREATED
SERVICE_NOTE_UPDATED
SERVICE_NOTE_COMPLETED
```

Do not expose a fake activity feed based on timestamps inferred client-side.

Activity must derive from real events.

---

# 63. DESIGN-FIRST BUILD GATE

Before broad backend implementation, visually establish:

1. desktop application shell
2. Service Notes index
3. desktop New Service Note workspace
4. completed Service Note detail
5. Service Report
6. mobile creation shell
7. customer signature screen

These must establish the product's design quality.

Do not build dozens of pages and defer visual quality until the end.

---

# 64. IMPLEMENTATION ORDER

Execute in this order:

```text
1. Repository inspection
2. Design system
3. Desktop shell
4. Mobile field shell
5. Database/auth
6. Employee identity
7. Sequential numbering
8. Core Service Note drafts
9. Customers
10. Labor
11. Materials
12. Photos
13. Additional charges
14. Financial calculations
15. Payment
16. Signature
17. Completion locking
18. Service Report/PDF
19. Full mobile creation workflow
20. Employee administration
21. Overview
22. PWA behavior
23. Visual polish
24. Accessibility review
25. E2E hardening
26. Production-readiness verification
```

---

# 65. TESTING

## Unit tests

Cover:

* sequential numbering
* labor calculations
* material calculations
* subtotal
* discount
* tax
* total
* payment validation
* completion validation
* permission rules
* snapshot behavior

## Integration tests

Cover:

* draft creation
* draft editing
* customer selection
* customer quick creation
* labor persistence
* materials persistence
* photo metadata
* payment
* signature
* completion transaction
* completed locking

## Playwright critical workflow

```text
Employee login
↓
Create Service Note
↓
Verify Person In Charge
↓
Select/create customer
↓
Enter service details
↓
Add labor
↓
Add materials
↓
Upload photo
↓
Record payment
↓
Capture customer signature
↓
Complete Service Note
↓
Verify generated number
↓
View Service Report
↓
Admin login
↓
Locate completed record
↓
Verify customer
↓
Verify employee
↓
Verify totals
↓
Verify payment
↓
Verify signature
↓
Verify customer history
```

This is the critical end-to-end acceptance test.

---

# 66. VISUAL REVIEW

Render and inspect at:

Desktop:

```text
1440×900
1280×800
```

Mobile:

```text
390×844
430×932
```

Check:

* spacing
* alignment
* hierarchy
* line wrapping
* table density
* form rhythm
* primary-action visibility
* image behavior
* touch targets
* signature ergonomics
* responsive overflow
* report layout

Never claim a screen is polished without viewing it.

---

# 67. PRODUCT QUALITY FAILURES

A screen is not complete if it resembles:

* raw shadcn
* generic admin template
* default Tailwind components
* student dashboard
* old ERP
* excessive card grid
* obviously generated SaaS template
* fake operational dashboard

Refine until hierarchy and composition feel intentional.

---

# 68. OUT OF SCOPE

Do not implement or expose UI for:

```text
AI
Chatbots
Voice AI
Predictive Maintenance
Scheduling
Dispatch
Assigned Jobs
Route Planning
GPS
Maps
Live Technician Tracking
Warehouse Inventory
Asset Management
Recurring Maintenance
Payroll
Sales CRM
Marketing
Customer Portal
Real Payment Processing
MyInvois
General Ledger Accounting
Quotes
Purchase Orders
Technician Leaderboards
Gamification
Advanced Analytics
```

Out-of-scope functionality should be absent, not displayed as unavailable.

---

# 69. PRODUCTION-QUALITY ACCEPTANCE CRITERIA

The release is complete when:

## Authentication

* Admin login works
* Employee login works
* route protection works
* role enforcement works

## Employees

* Admin can create/manage employees
* deactivation works
* historical records remain intact

## Customers

* create
* edit
* search
* select
* quick-create
* service history

all work.

## Service Notes

* sequential numbering works
* draft save/reopen works
* employee identity auto-populates
* service details persist
* labor persists and calculates
* materials persist and calculate
* photos upload and render
* charges calculate
* payment validation works
* signature works
* completion works
* completed records lock

## Reports

* report view works
* print works
* PDF download works
* customer signature appears
* photos appear
* totals are correct

## Desktop

* intentional desktop composition
* excellent tables
* no overflow
* no placeholder controls
* no dead actions

## Mobile

* field workflow works at phone sizes
* camera/gallery flow works
* signature is touch-friendly
* no horizontal overflow
* completion and report are accessible

## Product Credibility

* no “demo” wording
* no “beta” wording
* no “coming soon”
* no fake features
* no disabled future modules
* no placeholder UI
* no obvious development labels
* no default template look

---

# 70. DEFINITION OF SUCCESS

A user should be able to understand the product without explanation:

> **ServiceLOGME turns a field-service visit into a structured, professional, signed and permanently searchable digital Service Note.**

The product should feel deliberately limited to a clear scope, not incomplete.

The correct impression is:

**“This application does Service Notes extremely well.”**

Not:

**“This is an unfinished field-service platform.”**
