import type {WorkspaceData,ServiceNote,Customer,Profile,Organization,StoredMediaRef} from './types';
export interface WorkspaceRepository {
 read():Promise<WorkspaceData>;
 createNote():Promise<ServiceNote>;
 saveNote(note:ServiceNote,complete?:boolean):Promise<ServiceNote>;
 saveCustomer(input:Omit<Customer,'id'|'organization_id'|'created_at'> & {id?:string}):Promise<Customer>;
 saveEmployee(input:Profile):Promise<void>;
 saveOrganization(input:Organization):Promise<void>;
 uploadMedia?(data: ArrayBuffer, contentType: string, purpose: 'photo'|'signature'): Promise<StoredMediaRef>;
 deleteMedia?(id: string): Promise<void>;
}
