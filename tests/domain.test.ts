import {describe,it,expect} from 'vitest';
import {calculateTotals,completionErrors,canAccessNote,customerSnapshot} from '../src/lib/domain';
import type {ServiceNote,Profile,Customer} from '../src/lib/types';
describe('financial rules',()=>{
 it('calculates rounded lines then discount and tax',()=>{expect(calculateTotals({labor:[{id:'1',name:'Amir',classification:'Technician',hours:'2.5',rate:'80',notes:''}],materials:[{id:'1',description:'Regulator',part_number:'',quantity:'1',unit_amount:'325'}],charges:[{id:'1',description:'Travel',amount:'50'}],discount_amount:'25',tax_rate:'6'})).toEqual({labor_total:'200.00',material_total:'325.00',additional_charge_total:'50.00',subtotal:'575.00',discount_amount:'25.00',tax_rate:'6',tax_amount:'33.00',grand_total:'583.00'});});
 it('avoids binary currency rounding errors',()=>{expect(calculateTotals({labor:[],materials:[{id:'1',description:'Parts',part_number:'',quantity:'3',unit_amount:'0.335'}],charges:[],discount_amount:'0',tax_rate:'0'}).grand_total).toBe('1.01');});
 it('rejects discount above subtotal',()=>expect(()=>calculateTotals({labor:[],materials:[],charges:[],discount_amount:'1',tax_rate:'0'})).toThrow());
 it('rejects negative charges',()=>expect(()=>calculateTotals({labor:[],materials:[],charges:[{id:'x',description:'X',amount:'-1'}],discount_amount:'0',tax_rate:'0'})).toThrow());
});
describe('completion',()=>{
 const note={job_title:'Compressor inspection',service_date:'2026-09-09',service_time:'09:00',person_in_charge_id:'p',customer_id:'c',customer_name_snapshot:'Engineering Co',contact_mobile_snapshot:'+60123456789',work_performed:'Inspected regulator and pressure tested assembly.',payment_status:'UNPAID',payment_method:'',signature:{signer_name:'Ahmad',signer_position:'Manager',image:'data:image/png;base64,a',signed_at:'2026-09-09T09:00:00Z'}} as ServiceNote;
 it('accepts a complete unpaid note without a payment method or optional lines',()=>expect(completionErrors(note)).toEqual([]));
 it('requires a method for paid records',()=>expect(completionErrors({...note,payment_status:'PAID'}).join(' ')).toMatch(/Payment method/));
 it('requires a real signature',()=>expect(completionErrors({...note,signature:null}).join(' ')).toMatch(/signature/i));
 it('rejects missing core service information',()=>expect(completionErrors({...note,job_title:' ',work_performed:''})).toHaveLength(2));
});
it('restricts employees to own organization and own records',()=>{const p={id:'p',organization_id:'o',role:'EMPLOYEE',status:'ACTIVE'} as Profile;const n={person_in_charge_id:'p',organization_id:'o'} as ServiceNote;expect(canAccessNote(p,n)).toBe(true);expect(canAccessNote(p,{...n,organization_id:'other'})).toBe(false);expect(canAccessNote(p,{...n,person_in_charge_id:'other'})).toBe(false);expect(canAccessNote({...p,status:'INACTIVE'},n)).toBe(false);expect(canAccessNote({...p,role:'ADMIN'},{...n,person_in_charge_id:'other'})).toBe(true);});
it('copies customer values without retaining a mutable master reference',()=>{const c={id:'1',name:'Atlas',contact_name:'Ali',mobile:'123',address:'Kuala Lumpur'} as Customer;const snapshot=customerSnapshot(c);c.name='Renamed';expect(snapshot).toMatchObject({customer_name_snapshot:'Atlas',contact_mobile_snapshot:'123'});});
