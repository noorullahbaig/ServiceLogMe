import type {WorkspaceData,ServiceNote,Customer,Profile,Organization} from './types';
export interface WorkspaceRepository {
 read():Promise<WorkspaceData>;
 createNote():Promise<ServiceNote>;
 saveNote(note:ServiceNote,complete?:boolean):Promise<ServiceNote>;
 saveCustomer(input:Omit<Customer,'id'|'organization_id'|'created_at'> & {id?:string}):Promise<Customer>;
 saveEmployee(input:Profile):Promise<void>;
 saveOrganization(input:Organization):Promise<void>;
}
