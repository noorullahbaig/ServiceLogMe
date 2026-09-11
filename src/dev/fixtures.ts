import type { WorkspaceData, ServiceNote, Customer } from "@/lib/types";
import { calculateTotals, customerSnapshot } from "@/lib/domain";
export function emptyNote(
  profile: WorkspaceData["profile"],
  number: string,
): ServiceNote {
  const now = new Date(),
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  return {
    id: crypto.randomUUID(),
    organization_id: profile.organization_id,
    service_number: number,
    status: "DRAFT",
    revision: 0,
    record_type: "SERVICE",
    item_name_snapshot: "",
    item_reference_snapshot: "",
    location_snapshot: "",
    billing_enabled: true,
    finalization_type: "CUSTOMER_ACKNOWLEDGED",
    job_title: "",
    job_description: "",
    work_performed: "",
    result_remarks: "",
    additional_notes: "",
    service_date: parts,
    service_time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
    person_in_charge_id: profile.id,
    person_in_charge_name_snapshot: profile.full_name,
    person_in_charge_job_title_snapshot: profile.job_title,
    person_in_charge_employee_id_snapshot: profile.employee_id,
    customer_id: "",
    customer_name_snapshot: "",
    contact_name_snapshot: "",
    contact_position_snapshot: "",
    contact_mobile_snapshot: "",
    contact_office_snapshot: "",
    contact_email_snapshot: "",
    customer_address_snapshot: "",
    labor: [],
    materials: [],
    charges: [],
    photos: [],
    signature: null,
    payment_status: "UNPAID",
    payment_method: "",
    payment_terms: "Immediate",
    payment_reference: "",
    payment_remarks: "",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    completed_at: null,
    ...calculateTotals({
      labor: [],
      materials: [],
      charges: [],
      discount_amount: "0",
      tax_rate: "0",
    }),
  };
}
export function createDevelopmentWorkspace(): WorkspaceData {
  const org = "org-meridian";
  const now = new Date().toISOString();
  const seededSignature =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA8AgMAAABeNR0CAAAADFBMVEVMaXEQEhcQEhcQEhcxjKKgAAAABHRSTlMA+UmeP4pkygAAAAlwSFlzAAALEwAACxMBAJqcGAAAAXRJREFUSMftVTtug0AQHS9ysUEolY+wJUpFnyO48BgXCHEEl1YqLrFK6zJKClf0XGJTcwlLrqLs10GALKYO06zEztvZ92b2AbDEEku4eLlRERFiTYQIxCMRojq+pyFWOl/RbrbWtxKvJIhsAfiWBMmNaAWJis3+pkASK/CGAsla25uWAHl3tar5CLZzjOZIFpcu9+CQcyTL3GAlfrx244zPj8GF8Lr/Yx8o9ROuiLdBO5gy2TIUDRuXzq0N6ugG7RCaBgszHFTmmPu1PH+pctCOSG/yQzjCD6ZEtHrb7Bj72pt2ywqa8I0f/QutTXFI3UPN+mXMUKX55f6EI1cuKYDlNTB18if0IIVVDe/t8I3ZaMLyBE1eD1QJh6Y9SewsM8M9wUkzWB0nZ43b4grLqZEfjWFmriLsSfHPlBWsR4/dNkY+sA1RT9Vlj8zpecxu22vsTJvVzEVFs0C6A2rqVJ8F8dZQ3ZzT/xmgCioCnshFlvgX8QuXblWyw6TTfQAAAABJRU5ErkJggg==";
  const profile = {
    id: "employee-sarah",
    organization_id: org,
    full_name: "Sarah Lim",
    employee_id: "EMP-0001",
    job_title: "Operations Manager",
    email: "sarah@meridian.example",
    mobile: "+60 12 380 4820",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  const employees = [
    profile,
    {
      ...profile,
      id: "employee-amir",
      full_name: "Amir Malik",
      employee_id: "EMP-0018",
      job_title: "Service Technician",
      email: "amir@meridian.example",
      mobile: "+60 12 558 0913",
      role: "EMPLOYEE" as const,
    },
    {
      ...profile,
      id: "employee-daniel",
      full_name: "Daniel Wong",
      employee_id: "EMP-0021",
      job_title: "Senior Technician",
      email: "daniel@meridian.example",
      mobile: "+60 16 213 9920",
      role: "EMPLOYEE" as const,
    },
    {
      ...profile,
      id: "employee-nur",
      full_name: "Nur Aisyah",
      employee_id: "EMP-0024",
      job_title: "Service Engineer",
      email: "nur@meridian.example",
      mobile: "+60 17 562 1904",
      role: "EMPLOYEE" as const,
    },
  ];
  const entries = [
    [
      "Atlas Engineering Sdn Bhd",
      "Ahmad Rahman",
      "Maintenance Manager",
      "Shah Alam, Selangor",
    ],
    [
      "Pavilion Facilities Management",
      "Michelle Tan",
      "Facilities Manager",
      "Bukit Bintang, Kuala Lumpur",
    ],
    [
      "Oakwood Manufacturing",
      "Jason Lee",
      "Production Manager",
      "Petaling Jaya, Selangor",
    ],
    [
      "Sunway Medical Centre",
      "Farah Hassan",
      "Operations Executive",
      "Bandar Sunway, Selangor",
    ],
    [
      "Nexus Industrial Solutions",
      "Ravi Kumar",
      "Site Supervisor",
      "Puchong, Selangor",
    ],
    [
      "Vista Commercial Properties",
      "Rachel Ong",
      "Building Manager",
      "Mont Kiara, Kuala Lumpur",
    ],
    [
      "Greenfield Food Industries",
      "Hafiz Ismail",
      "Maintenance Lead",
      "Subang Jaya, Selangor",
    ],
  ];
  const customers: Customer[] = entries.map((c, i) => ({
    id: `customer-${i + 1}`,
    organization_id: org,
    name: c[0],
    contact_name: c[1],
    contact_position: c[2],
    mobile: `+60 12 345 67${80 + i}`,
    office: `+60 3 5561 22${10 + i}`,
    email: `operations@${["atlas", "pavilion", "oakwood", "sunway", "nexus", "vista", "greenfield"][i]}.example`,
    address: `${[18, 42, 7, 25, 16, 8, 35][i]}, Jalan ${["Perindustrian U1", "Sultan Ismail", "Teknologi 3", "Lagoon Selatan", "Puteri 5/8", "Kiara", "Industri USJ"][i]}\n${c[3]}\nMalaysia`,
    notes:
      i === 0
        ? "Check in at the security office on arrival. Contact Ahmad for access to the compressor room."
        : "",
    created_at: now,
  }));
  const titles = [
    "Air compressor service",
    "HVAC preventive maintenance",
    "Hydraulic pump inspection",
    "Chilled water system service",
    "Electrical panel inspection",
    "Air handling unit service",
    "Conveyor motor replacement",
    "Pressure regulator replacement",
    "Cooling tower maintenance",
    "Fire pump inspection",
    "Water pump service",
    "Ventilation system inspection",
  ];
  const notes: ServiceNote[] = titles.map((title, i) => {
    const person = employees[1 + (i % 3)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(i / 3));
    const n = emptyNote(
      person,
      `SL-${date.getFullYear()}-${String(128 - i).padStart(6, "0")}`,
    );
    const draft = [1, 4, 8].includes(i);
    const c = customers[i % customers.length];
    const labor = [
      {
        id: `l-${i}`,
        employee_id: person.id,
        name: person.full_name,
        classification: person.job_title,
        hours: i === 0 ? "2.5" : String(1 + (i % 3)),
        rate: "80",
        notes: "",
      },
    ];
    const materials = [
      {
        id: `m-${i}`,
        description: i === 0 ? "Pressure regulator" : "Service consumables",
        part_number: i === 0 ? "PR-438" : "SC-102",
        quantity: "1",
        unit_amount: i === 0 ? "280" : String(45 + i * 25),
      },
      {
        id: `m2-${i}`,
        description: "Seal kit",
        part_number: "SK-20",
        quantity: "1",
        unit_amount: "45",
      },
    ];
    const charges = [{ id: `c-${i}`, description: "Travel", amount: "50" }];
    return {
      ...n,
      id: `note-${128 - i}`,
      ...customerSnapshot(c),
      job_title: title,
      service_date: new Intl.DateTimeFormat("en-CA").format(date),
      service_time: `${String(9 + (i % 7)).padStart(2, "0")}:30`,
      job_description:
        i === 0
          ? "Customer reported abnormal compressor pressure and intermittent pressure loss during operation."
          : "Routine service and inspection requested by the facilities team.",
      work_performed: draft
        ? ""
        : i === 0
          ? "Inspected the compressor and identified a faulty pressure regulator. Replaced the regulator and seal kit, then pressure-tested the system."
          : "Inspected the equipment, completed preventive maintenance and verified operation against the service requirements.",
      result_remarks: draft
        ? ""
        : "System operating normally. Pressure remained stable during testing.",
      additional_notes: "",
      labor,
      materials,
      charges,
      ...calculateTotals({
        labor,
        materials,
        charges,
        discount_amount: "0",
        tax_rate: "0",
      }),
      status: draft ? "DRAFT" : "COMPLETED",
      payment_status: i % 3 === 0 ? "PAID" : "UNPAID",
      payment_method: i % 3 === 0 ? "Bank Transfer" : "",
      payment_terms: i % 3 === 0 ? "Immediate" : "30 Days",
      payment_reference:
        i % 3 === 0 ? `BT-${date.getFullYear()}-0${421 + i}` : "",
      signature: draft
        ? null
        : {
            signer_name: c.contact_name,
            signer_position: c.contact_position,
            image: seededSignature,
            signed_at: date.toISOString(),
          },
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      completed_at: draft ? null : date.toISOString(),
    };
  });
  return {
    organization: {
      id: org,
      name: "Meridian Technical Services",
      email: "hello@meridian.example",
      phone: "+60 3 7728 4600",
      address:
        "18, Jalan SS 21/35, Damansara Utama\n47400 Petaling Jaya, Selangor",
      currency: "MYR",
      timezone: "Asia/Kuala_Lumpur",
    },
    profile,
    employees,
    customers,
    tracked_items: [
      {
        id: "item-eng-cum-4821",
        organization_id: org,
        customer_id: customers[0].id,
        name: "Cummins QSK19 engine",
        reference: "ENG-CUM-4821",
        created_at: now,
        updated_at: now,
      },
    ],
    notes,
    events: [],
  };
}
