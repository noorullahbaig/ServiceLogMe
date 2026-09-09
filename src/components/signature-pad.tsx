'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, PenLine } from 'lucide-react';

type Point = { x:number; y:number };
export function SignaturePad({ value, onConfirm, onClear }: { value:string|null; onConfirm:(image:string)=>void; onClear:()=>void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const [hasInk,setHasInk] = useState(false);
  const [error,setError] = useState('');
  const previousValue = useRef(value);
  const draw = () => {
    const el = canvas.current;
    if (!el) return;
    const ctx=el.getContext('2d'); if (!ctx) return;
    const box=el.getBoundingClientRect();
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,el.width,el.height);
    const ratio=window.devicePixelRatio||1; ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.strokeStyle='#111318';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';
    for (const stroke of strokes.current) { ctx.beginPath(); stroke.forEach((p,i)=> { if(i===0)ctx.moveTo(p.x*box.width,p.y*box.height);else ctx.lineTo(p.x*box.width,p.y*box.height); });ctx.stroke(); }
  };
  useEffect(()=> {
    const el=canvas.current;if(!el||value)return;
    const observer=new ResizeObserver(()=>{const box=el.getBoundingClientRect();const ratio=window.devicePixelRatio||1;el.width=Math.round(box.width*ratio);el.height=Math.round(box.height*ratio);draw();});observer.observe(el);return()=>observer.disconnect();
  },[value]);
  useEffect(()=> { if(previousValue.current && !value){strokes.current=[];setHasInk(false);draw();}previousValue.current=value; },[value]);
  function point(event:React.PointerEvent<HTMLCanvasElement>) { const box=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))}; }
  function clear() {strokes.current=[];drawing.current=false;setHasInk(false);setError('');onClear();draw();}
  function confirm() {
    const el=canvas.current;const box=el?.getBoundingClientRect();
    const length=strokes.current.reduce((total,stroke)=>total+stroke.reduce((sum,p,i)=>i?sum+Math.hypot((p.x-stroke[i-1].x)*(box?.width||1),(p.y-stroke[i-1].y)*(box?.height||1)):sum,0),0);
    if(!el||length<16){setError('Please draw your signature before confirming.');return;}
    setError('');onConfirm(el.toDataURL('image/png'));
  }
  return <div className="signature-pad">
    {value ? <div className="signature-confirmed"><img src={value} alt="Confirmed customer signature"/><span><Check size={14}/> Signature confirmed</span></div> : <div className="signature-canvas-wrap"><canvas ref={canvas} aria-label="Draw your signature" onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drawing.current=true;strokes.current.push([point(event)]);setError('');}} onPointerMove={event=>{if(!drawing.current)return;strokes.current[strokes.current.length-1].push(point(event));setHasInk(true);draw();}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/>{!hasInk&&<span className="signature-placeholder"><PenLine size={22}/>Sign here using your finger or mouse</span>}<span className="signature-baseline"/></div>}
    {error&&<p className="editor-error" role="alert">{error}</p>}
    <div className="signature-actions"><button type="button" className="btn btn-ghost" onClick={clear}><Eraser size={15}/>Clear</button>{!value&&<button type="button" className="btn btn-secondary" onClick={confirm}><Check size={15}/>Confirm signature</button>}</div>
  </div>;
}
