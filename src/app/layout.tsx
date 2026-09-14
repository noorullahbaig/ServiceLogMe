import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'ServiceLOGME — Evidence Reports',description:'Evidence-backed warehouse reports for item condition and storage.',appleWebApp:{capable:true,statusBarStyle:'default',title:'ServiceLOGME'},icons:{icon:'/icon.svg',apple:'/apple-icon.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f7f8fa'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
