import Decimal from 'decimal.js';
import type { ServiceNote, Profile, Customer, Totals, Labor, Material, Charge } from './types';
function decimal(value:string,label:string){if(!/^(?:\d+\.?\d*|\.\d+)$/.test(value||'0'))throw new Error(`${label} must be a positive number.`);const d=new Decimal(value||0);if(!d.isFinite()||d.isNegative()||d.gt('9999999999'))throw new Error(`${label} is outside the allowed range.`);return d;}
const round=(n:Decimal)=>n.toDecimalPlaces(2,Decimal.ROUND_HALF_UP);
export function calculateTotals(input:{labor:Labor[];materials:Material[];charges:Charge[];discount_amount:string;tax_rate:string}):Totals {
 const labor=input.labor.reduce((s,l)=>s.plus(round(decimal(l.hours,'Hours').times(decimal(l.rate,'Rate')))),new Decimal(0));
 const materials=input.materials.reduce((s,m)=>s.plus(round(decimal(m.quantity,'Quantity').times(decimal(m.unit_amount,'Unit amount')))),new Decimal(0));
 const charges=input.charges.reduce((s,c)=>s.plus(round(decimal(c.amount,'Charge'))),new Decimal(0));
 const subtotal=labor.plus(materials).plus(charges),discount=round(decimal(input.discount_amount,'Discount')),rate=decimal(input.tax_rate,'Tax rate');
 if(discount.gt(subtotal))throw new Error('Discount cannot exceed the subtotal.');if(rate.gt(100))throw new Error('Tax rate cannot exceed 100%.');
 const tax=round(subtotal.minus(discount).times(rate).div(100)),total=subtotal.minus(discount).plus(tax);
 if(total.gt('9999999999.99'))throw new Error('Grand total exceeds the allowed amount.');
 return {labor_total:labor.toFixed(2),material_total:materials.toFixed(2),additional_charge_total:charges.toFixed(2),subtotal:subtotal.toFixed(2),discount_amount:discount.toFixed(2),tax_rate:rate.toString(),tax_amount:tax.toFixed(2),grand_total:total.toFixed(2)};
}
export function completionErrors(n:ServiceNote):string[]{
 const errors:string[]=[];
 const required:[string|undefined,string][]=[[n.job_title,'Job title'],[n.service_date,'Date'],[n.service_time,'Time'],[n.person_in_charge_id,'Person in charge'],[n.customer_id,'Customer'],[n.contact_mobile_snapshot||n.contact_office_snapshot,'Contact number'],[n.work_performed,'Work performed']];
 for(const [value,label] of required)if(!value?.trim())errors.push(`${label} is required before completing this Service Note.`);
 if(n.service_date&&!/^\d{4}-\d{2}-\d{2}$/.test(n.service_date))errors.push('Enter a valid service date.');
 if(n.service_time&&!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(n.service_time))errors.push('Enter a valid service time.');
 if(!['PAID','UNPAID'].includes(n.payment_status))errors.push('Payment status is required.');
 if(n.payment_status==='PAID'&&!n.payment_method?.trim())errors.push('Payment method is required when payment status is Paid.');
 if(!n.signature?.signer_name?.trim())errors.push('Signer name is required.');
 if(!n.signature?.image?.startsWith('data:image/png;base64,'))errors.push('Customer signature is required before completing this Service Note.');
 return errors;
}
export function canAccessNote(p:Profile,n:ServiceNote){return p.status==='ACTIVE'&&p.organization_id===n.organization_id&&(p.role==='ADMIN'||p.id===n.person_in_charge_id);}
export function customerSnapshot(c:Customer){return {customer_id:c.id,customer_name_snapshot:c.name,contact_name_snapshot:c.contact_name,contact_position_snapshot:c.contact_position||'',contact_mobile_snapshot:c.mobile||'',contact_office_snapshot:c.office||'',contact_email_snapshot:c.email||'',customer_address_snapshot:c.address||''};}
export function money(amount:string|number){return new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2}).format(Number(amount)||0);}
export function shortDate(date:string){return date?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date.length===10?`${date}T12:00:00`:date)):'—';}
export function initials(name:string){return name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();}
