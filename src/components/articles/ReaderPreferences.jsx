"use client";
import {useEffect,useRef,useState} from "react";
import {Maximize2,Minimize2} from "lucide-react";
export default function ReaderPreferences({children}){
 const ref=useRef(null),bar=useRef(null);
 const [focus,setFocus]=useState(false),[headings,setHeadings]=useState([]),[active,setActive]=useState("");
 useEffect(()=>{const el=ref.current;if(!el)return;const body=el.querySelector(".cb-published-content");if(!body)return;
 const nodes=Array.from(body.querySelectorAll("h2[id],h3[id]")).filter(h=>h.textContent.trim());
 setHeadings(nodes.map(h=>({id:h.id,text:h.textContent,sub:h.tagName==="H3"})));let frame=0;
 const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const rect=body.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(innerHeight-rect.top)/Math.max(1,rect.height)));if(bar.current)bar.current.style.transform=`scaleX(${progress})`;let current=nodes[0];for(const h of nodes){if(h.getBoundingClientRect().top<=120)current=h;else break;}setActive(current?.id||"");});};
 window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;ro?.observe(body);update();return()=>{cancelAnimationFrame(frame);ro?.disconnect();window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};},[]);
 useEffect(()=>{if(!focus)return;const exit=e=>{if(e.key==="Escape")setFocus(false);};window.addEventListener("keydown",exit);return()=>window.removeEventListener("keydown",exit);},[focus]);
 return <section ref={ref} className="cb-reading-preferences cb-reader-v6" data-contrast="balanced" data-warm="false" data-focus={focus} data-family="serif" data-has-toc={headings.length>0} style={{"--reader-size":"19px","--reader-leading":1.85}}>
 <div className="cb-reading-progress" aria-hidden="true"><span ref={bar}/></div>
 <div className="cb-focus-row"><button className="cb-focus-button" type="button" aria-pressed={focus} onClick={()=>setFocus(x=>!x)}>{focus?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {focus?"Exit focus":"Focus mode"}</button></div>
 <div className="cb-reader-main">{children}</div>
 {!focus&&headings.length>0&&<aside className="cb-reader-rail"><nav aria-label="On this page"><div className="cb-rail-label">On this page</div>{headings.map((h,i)=><a key={h.id} className={h.sub?"cb-toc-sub":undefined} aria-current={active===h.id?"location":undefined} href={`#${h.id}`}><span>{String(i+1).padStart(2,"0")} · </span>{h.text}</a>)}</nav></aside>}
 </section>;
}
