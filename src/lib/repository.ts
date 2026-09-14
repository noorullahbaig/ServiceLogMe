import type {WorkspaceData,ServiceNote,Customer,Profile,Organization,StoredMediaRef,TrackedItem,Photo,EvidencePhotoUploadMetadata,ReportPage,ReportQuery} from './types';
export interface WorkspaceRepository {
 read():Promise<WorkspaceData>;
 createNote():Promise<ServiceNote>;
 saveNote(note:ServiceNote,complete?:boolean):Promise<ServiceNote>;
  saveCustomer(input:Omit<Customer,'id'|'organization_id'|'created_at'> & {id?:string}):Promise<Customer>;
  saveTrackedItem(input: Omit<TrackedItem, 'id'|'organization_id'|'created_at'|'updated_at'> & {id?:string}): Promise<TrackedItem>;
 saveEmployee(input:Profile):Promise<void>;
 saveOrganization(input:Organization):Promise<void>;
 uploadMedia?(data: ArrayBuffer, contentType: string, purpose: 'photo'|'signature'): Promise<StoredMediaRef>;
 deleteMedia?(id: string): Promise<void>;
 uploadEvidencePhoto?(reportId:string,file:File,metadata:EvidencePhotoUploadMetadata):Promise<Photo>;
 deleteEvidencePhoto?(reportId:string,photoId:string):Promise<void>;
 listReports?(query:ReportQuery):Promise<ReportPage>;
}
