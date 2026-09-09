import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it} from 'vitest';
import {LocalWorkspaceRepository} from '../src/dev/local-repository';
import {createDevelopmentWorkspace} from '../src/dev/fixtures';
let repo:LocalWorkspaceRepository;
beforeEach(()=>{repo=new LocalWorkspaceRepository(`test-${crypto.randomUUID()}`,createDevelopmentWorkspace());});
describe('local persisted note workflow',()=>{
 it('allocates distinct numbers concurrently and keeps drafts across repository instances',async()=>{const [a,b]=await Promise.all([repo.createNote(),repo.createNote()]);expect(a.service_number).not.toBe(b.service_number);const loaded=await repo.read();expect(loaded.notes.find(n=>n.id===a.id)?.status).toBe('DRAFT');});
 it('rejects stale edits rather than overwriting',async()=>{const n=await repo.createNote();await repo.saveNote({...n,job_title:'Inspection'});await expect(repo.saveNote({...n,job_title:'Old tab'})).rejects.toThrow(/changed/i);});
 it('locks completed snapshots and records real audit events',async()=>{let n=await repo.createNote();const data=await repo.read();const c=data.customers[0];n={...n,job_title:'Inspection',customer_id:c.id,customer_name_snapshot:c.name,contact_mobile_snapshot:c.mobile,work_performed:'Pressure tested all fittings.',signature:{image:'data:image/png;base64,AA==',signer_name:'Ahmad',signer_position:'Manager',signed_at:new Date().toISOString()}};const completed=await repo.saveNote(n,true);expect(completed.status).toBe('COMPLETED');await expect(repo.saveNote({...completed,job_title:'Changed'})).rejects.toThrow(/read.only/i);await repo.saveCustomer({...c,name:'Renamed company'});const after=await repo.read();expect(after.notes.find(x=>x.id===n.id)?.customer_name_snapshot).toBe(c.name);expect(after.events.filter(e=>e.note_id===n.id).map(e=>e.type)).toEqual(['SERVICE_NOTE_CREATED','SERVICE_NOTE_COMPLETED']);});
 it('rejects incomplete completion without writing an event',async()=>{const n=await repo.createNote();await expect(repo.saveNote(n,true)).rejects.toThrow(/required/);expect((await repo.read()).events.filter(e=>e.note_id===n.id)).toHaveLength(1);});
});
