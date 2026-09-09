import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Organization, ServiceNote } from './types';

type ReportDocumentProps = { note: ServiceNote; organization: Organization };

const colors = {
  ink: '#16211d',
  muted: '#66736d',
  line: '#dce3df',
  pale: '#f3f6f4',
  green: '#166147',
  greenPale: '#e8f2ed',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingRight: 38, paddingBottom: 48, paddingLeft: 38, fontFamily: 'Helvetica', fontSize: 8.5, color: colors.ink, lineHeight: 1.45 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.ink },
  brand: { maxWidth: '62%' },
  brandName: { fontFamily: 'Helvetica-Bold', fontSize: 16, marginBottom: 5 },
  brandLine: { color: colors.muted, fontSize: 7.5, marginBottom: 2 },
  identity: { alignItems: 'flex-end' },
  overline: { color: colors.green, fontFamily: 'Helvetica-Bold', fontSize: 6.5, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 },
  serviceNumber: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 3 },
  revision: { color: colors.muted, fontSize: 7 },
  meta: { flexDirection: 'row', backgroundColor: colors.pale, paddingVertical: 10, paddingHorizontal: 12, marginTop: 14, marginBottom: 16 },
  metaItem: { width: '25%', paddingRight: 8 },
  metaLabel: { color: colors.muted, fontSize: 6.3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  metaValue: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  twoColumn: { flexDirection: 'row', gap: 22, marginBottom: 18 },
  column: { width: '50%' },
  blockTitle: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 6 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { width: 54, color: colors.muted, fontSize: 7 },
  infoValue: { flex: 1, fontSize: 8 },
  section: { marginBottom: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6, marginBottom: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionNumber: { color: colors.green, fontFamily: 'Helvetica-Bold', fontSize: 6.5 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  narrative: { marginBottom: 9 },
  narrativeTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  narrativeText: { fontSize: 8.5, lineHeight: 1.55 },
  table: { borderWidth: 1, borderColor: colors.line },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.pale, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  tableFooter: { flexDirection: 'row', backgroundColor: colors.greenPale },
  cell: { paddingVertical: 6, paddingHorizontal: 7, fontSize: 7.3 },
  headCell: { color: colors.muted, fontFamily: 'Helvetica-Bold', fontSize: 6.2, textTransform: 'uppercase', letterSpacing: 0.35 },
  strongCell: { fontFamily: 'Helvetica-Bold' },
  numericCell: { textAlign: 'right' },
  cellMain: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  cellSub: { color: colors.muted, fontSize: 6.5 },
  empty: { paddingVertical: 10, textAlign: 'center', color: colors.muted },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', borderWidth: 1, borderColor: colors.line, padding: 5, marginBottom: 4 },
  photoImage: { width: '100%', height: 132, objectFit: 'cover', backgroundColor: colors.pale },
  photoCaption: { paddingTop: 5 },
  photoCategory: { color: colors.green, fontFamily: 'Helvetica-Bold', fontSize: 6.2, textTransform: 'uppercase', marginBottom: 2 },
  photoName: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginBottom: 2 },
  photoDate: { color: colors.muted, fontSize: 6.3 },
  financialArea: { flexDirection: 'row', gap: 24 },
  payment: { width: '50%' },
  totals: { width: '50%', backgroundColor: colors.pale, padding: 12 },
  paymentRow: { flexDirection: 'row', marginBottom: 5 },
  paymentLabel: { width: 52, color: colors.muted, fontSize: 7 },
  paymentValue: { flex: 1, fontSize: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabel: { color: colors.muted },
  totalValue: { fontFamily: 'Helvetica-Bold' },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.ink },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: colors.green },
  acceptance: { borderWidth: 1, borderColor: colors.line, padding: 14 },
  acceptanceCopy: { color: colors.muted, marginBottom: 13, lineHeight: 1.5 },
  signatureRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  signatureImage: { width: 145, height: 58, objectFit: 'contain', borderBottomWidth: 1, borderBottomColor: colors.ink },
  signatureMeta: { paddingBottom: 3 },
  signerName: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  signerSub: { color: colors.muted, fontSize: 7, marginBottom: 2 },
  noSignature: { color: colors.muted, fontStyle: 'italic' },
  footer: { position: 'absolute', left: 38, right: 38, bottom: 20, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line, color: colors.muted, fontSize: 6.5 },
});

function money(value: string, organization: Organization) {
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: organization.currency || 'MYR', minimumFractionDigits: 2 }).format(Number(value) || 0);
  } catch {
    return `${organization.currency || 'MYR'} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function date(value: string, withTime = false) {
  if (!value) return '-';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(parsed);
}

function amount(quantity: string, rate: string) {
  return String((Number(quantity) || 0) * (Number(rate) || 0));
}

function SectionHeading({ number, children }: { number: string; children: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionNumber}>{number}</Text><Text style={styles.sectionTitle}>{children}</Text></View>;
}

function Narrative({ title, children }: { title: string; children: string }) {
  return <View style={styles.narrative}><Text style={styles.narrativeTitle}>{title}</Text><Text style={styles.narrativeText}>{children || '-'}</Text></View>;
}

export function ReportDocument({ note, organization }: ReportDocumentProps) {
  return (
    <Document title={`Service Report ${note.service_number}`} author={organization.name} subject={note.job_title} creator="ServiceLOGME">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandName}>{organization.name}</Text>
            <Text style={styles.brandLine}>{organization.address || '-'}</Text>
            <Text style={styles.brandLine}>{[organization.phone, organization.email].filter(Boolean).join(' | ') || '-'}</Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.overline}>Service report</Text>
            <Text style={styles.serviceNumber}>{note.service_number}</Text>
            <Text style={styles.revision}>Revision {note.revision}</Text>
          </View>
        </View>

        <View style={styles.meta} wrap={false}>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Service date</Text><Text style={styles.metaValue}>{date(note.service_date)}</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Service time</Text><Text style={styles.metaValue}>{note.service_time || '-'}</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Person in charge</Text><Text style={styles.metaValue}>{note.person_in_charge_name_snapshot || '-'}</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaLabel}>Employee ID</Text><Text style={styles.metaValue}>{note.person_in_charge_employee_id_snapshot || '-'}</Text></View>
        </View>

        <View style={styles.twoColumn} wrap={false}>
          <View style={styles.column}>
            <Text style={styles.overline}>Customer</Text>
            <Text style={styles.blockTitle}>{note.customer_name_snapshot || '-'}</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Contact</Text><Text style={styles.infoValue}>{[note.contact_name_snapshot, note.contact_position_snapshot].filter(Boolean).join(', ') || '-'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Telephone</Text><Text style={styles.infoValue}>{[note.contact_mobile_snapshot, note.contact_office_snapshot].filter(Boolean).join(' / ') || '-'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{note.contact_email_snapshot || '-'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{note.customer_address_snapshot || '-'}</Text></View>
          </View>
          <View style={styles.column}>
            <Text style={styles.overline}>Service</Text>
            <Text style={styles.blockTitle}>{note.job_title || '-'}</Text>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Handled by</Text><Text style={styles.infoValue}>{note.person_in_charge_name_snapshot || '-'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>Position</Text><Text style={styles.infoValue}>{note.person_in_charge_job_title_snapshot || '-'}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading number="01">Service record</SectionHeading>
          <Narrative title="Reported issue">{note.job_description}</Narrative>
          <Narrative title="Work performed">{note.work_performed}</Narrative>
          <Narrative title="Result / remarks">{note.result_remarks}</Narrative>
          <Narrative title="Additional notes">{note.additional_notes}</Narrative>
        </View>

        <View style={styles.section}>
          <SectionHeading number="02">Labor</SectionHeading>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.cell, styles.headCell, { width: '23%' }]}>Employee</Text><Text style={[styles.cell, styles.headCell, { width: '29%' }]}>Classification / notes</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '12%' }]}>Hours</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '18%' }]}>Rate</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '18%' }]}>Amount</Text>
            </View>
            {note.labor.length ? note.labor.map(item => <View key={item.id} style={styles.tableRow} wrap={false}><View style={[styles.cell, { width: '23%' }]}><Text style={styles.cellMain}>{item.name}</Text></View><View style={[styles.cell, { width: '29%' }]}><Text style={styles.cellMain}>{item.classification || '-'}</Text><Text style={styles.cellSub}>{item.notes}</Text></View><Text style={[styles.cell, styles.numericCell, { width: '12%' }]}>{item.hours}</Text><Text style={[styles.cell, styles.numericCell, { width: '18%' }]}>{money(item.rate, organization)}</Text><Text style={[styles.cell, styles.numericCell, { width: '18%' }]}>{money(amount(item.hours, item.rate), organization)}</Text></View>) : <Text style={styles.empty}>No labor recorded</Text>}
            <View style={styles.tableFooter} wrap={false}><Text style={[styles.cell, styles.strongCell, { width: '82%' }]}>Labor total</Text><Text style={[styles.cell, styles.strongCell, styles.numericCell, { width: '18%' }]}>{money(note.labor_total, organization)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading number="03">Materials</SectionHeading>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed><Text style={[styles.cell, styles.headCell, { width: '30%' }]}>Material</Text><Text style={[styles.cell, styles.headCell, { width: '18%' }]}>Part number</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '12%' }]}>Qty</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '20%' }]}>Unit amount</Text><Text style={[styles.cell, styles.headCell, styles.numericCell, { width: '20%' }]}>Amount</Text></View>
            {note.materials.length ? note.materials.map(item => <View key={item.id} style={styles.tableRow} wrap={false}><Text style={[styles.cell, styles.strongCell, { width: '30%' }]}>{item.description}</Text><Text style={[styles.cell, { width: '18%' }]}>{item.part_number || '-'}</Text><Text style={[styles.cell, styles.numericCell, { width: '12%' }]}>{item.quantity}</Text><Text style={[styles.cell, styles.numericCell, { width: '20%' }]}>{money(item.unit_amount, organization)}</Text><Text style={[styles.cell, styles.numericCell, { width: '20%' }]}>{money(amount(item.quantity, item.unit_amount), organization)}</Text></View>) : <Text style={styles.empty}>No materials recorded</Text>}
            <View style={styles.tableFooter} wrap={false}><Text style={[styles.cell, styles.strongCell, { width: '80%' }]}>Materials total</Text><Text style={[styles.cell, styles.strongCell, styles.numericCell, { width: '20%' }]}>{money(note.material_total, organization)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading number="04">Additional charges</SectionHeading>
          <View style={styles.table}>
            {note.charges.length ? note.charges.map(item => <View key={item.id} style={styles.chargeRow} wrap={false}><Text>{item.description}</Text><Text style={styles.strongCell}>{money(item.amount, organization)}</Text></View>) : <Text style={styles.empty}>No additional charges</Text>}
            <View style={styles.tableFooter} wrap={false}><Text style={[styles.cell, styles.strongCell, { width: '80%' }]}>Additional charges total</Text><Text style={[styles.cell, styles.strongCell, styles.numericCell, { width: '20%' }]}>{money(note.additional_charge_total, organization)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading number="05">Service photos</SectionHeading>
          {note.photos.length ? <View style={styles.photoGrid}>{note.photos.map(photo => <View key={photo.id} style={styles.photoCard} wrap={false}><Image src={photo.url} style={styles.photoImage} /><View style={styles.photoCaption}><Text style={styles.photoCategory}>{photo.category}</Text><Text style={styles.photoName}>{photo.caption || photo.name || 'Service photo'}</Text><Text style={styles.photoDate}>{date(photo.created_at, true)}</Text></View></View>)}</View> : <Text style={styles.empty}>No service photos recorded.</Text>}
        </View>

        <View style={styles.section} wrap={false}>
          <SectionHeading number="06">Financial summary and payment</SectionHeading>
          <View style={styles.financialArea}>
            <View style={styles.payment}>
              <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Status</Text><Text style={[styles.paymentValue, styles.strongCell]}>{note.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}</Text></View>
              <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Method</Text><Text style={styles.paymentValue}>{note.payment_method || '-'}</Text></View>
              <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Terms</Text><Text style={styles.paymentValue}>{note.payment_terms || '-'}</Text></View>
              <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Reference</Text><Text style={styles.paymentValue}>{note.payment_reference || '-'}</Text></View>
              <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Remarks</Text><Text style={styles.paymentValue}>{note.payment_remarks || '-'}</Text></View>
            </View>
            <View style={styles.totals}>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Labor</Text><Text style={styles.totalValue}>{money(note.labor_total, organization)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Materials</Text><Text style={styles.totalValue}>{money(note.material_total, organization)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Additional charges</Text><Text style={styles.totalValue}>{money(note.additional_charge_total, organization)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{money(note.subtotal, organization)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Discount</Text><Text style={styles.totalValue}>- {money(note.discount_amount, organization)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Tax ({Number(note.tax_rate) || 0}%)</Text><Text style={styles.totalValue}>{money(note.tax_amount, organization)}</Text></View>
              <View style={styles.grandTotal}><Text style={styles.grandLabel}>Grand total</Text><Text style={styles.grandValue}>{money(note.grand_total, organization)}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <SectionHeading number="07">Customer acceptance</SectionHeading>
          <View style={styles.acceptance}>
            <Text style={styles.acceptanceCopy}>The customer acknowledged the recorded service information and reviewed the completed work.</Text>
            {note.signature ? <View style={styles.signatureRow}><Image src={note.signature.image} style={styles.signatureImage} /><View style={styles.signatureMeta}><Text style={styles.signerName}>{note.signature.signer_name}</Text><Text style={styles.signerSub}>{note.signature.signer_position || 'Customer representative'}</Text><Text style={styles.signerSub}>Signed {date(note.signature.signed_at, true)}</Text></View></View> : <Text style={styles.noSignature}>No customer signature recorded.</Text>}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{organization.name}</Text>
          <Text>{note.service_number}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReport(note: ServiceNote, organization: Organization) {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(<ReportDocument note={note} organization={organization} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeNumber = (note.service_number || 'service-report').replace(/[^a-z0-9_-]+/gi, '-');
  link.href = url;
  link.download = `${safeNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
