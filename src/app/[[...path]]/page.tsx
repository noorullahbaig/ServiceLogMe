import {Suspense} from 'react';
import Application from '@/components/application';
export default function Page(){return <Suspense><Application localEnabled={process.env.NODE_ENV==='development'||process.env.NEXT_PUBLIC_LOCAL_WORKSPACE==='1'}/></Suspense>;}
