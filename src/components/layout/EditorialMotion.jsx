"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
const cards=".article-card,.article-list-card,.directory-card,.home-topic-card,.home-contributor-card,.popular-article-row,.featured-card,.home-newsletter-card,.portal-card,.portal-table-card,.dashboard-card,.stat-card,.auth-card,.editor-card,.workspace-card,.workflow-card,.history-card,.contact-card,.error-card,.loading-card,.portal-stats article,.article-stats article,.workflow-step,.learning-feature,.home-beginner-steps article,.home-featured-card,.cb-filter-panel";
const reveal=cards+",.home-section-heading,.section-heading,.public-page-heading,.portal-page-heading";
export default function EditorialMotion(){
 const pathname=usePathname();
 useEffect(()=>{
 const html=document.documentElement;
 if(/^\/articles\/[^/]+\/?$/.test(pathname||""))return;
 const reduced=matchMedia("(prefers-reduced-motion: reduce)");
 const fine=matchMedia("(hover: hover) and (pointer: fine)");
 html.dataset.cbMotion="on";html.dataset.cbRain="on";
 const canvas=document.createElement("canvas");canvas.className="cb-rain-canvas";canvas.setAttribute("aria-hidden","true");document.body.prepend(canvas);
 const ctx=canvas.getContext("2d");let width=0,height=0,columns=[],raf=0,last=0,clock=0,mx=-999,my=-999,light=html.dataset.theme==="light";
 const animations=new Set(),seen=new WeakSet();
 function paint(){if(!ctx)return;ctx.clearRect(0,0,width,height);if(reduced.matches)return;ctx.font="12px monospace";ctx.textBaseline="top";const step=width<650?34:27;
 for(const c of columns){const x=c.x;for(let j=0;j<c.length;j++){const y=c.y-j*19;if(y<0||y>height)continue;const near=Math.max(0,1-Math.hypot(x-mx,y-my)/155);const alpha=(j===0?.32:.19*(1-j/c.length))*(light?.75:1)+near*.025;ctx.fillStyle=light?`rgba(37,85,115,${alpha})`:`rgba(125,184,218,${alpha})`;ctx.fillText((Math.floor(clock/430)+c.seed+j)%3===0?"1":"0",x,y);}}
 }
 function resize(){if(!ctx)return;width=innerWidth;height=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);const step=width<650?34:27;columns=Array.from({length:Math.ceil(width/step)},(_,i)=>({x:i*step+6,y:Math.random()*(height+200),speed:25+Math.random()*35,length:5+Math.floor(Math.random()*7),seed:i*13}));paint();}
 function tick(now){raf=0;if(reduced.matches||document.hidden)return;if(!last)last=now;const dt=Math.min(now-last,100);if(dt>=32){last=now;clock+=dt;for(const c of columns){c.y+=c.speed*dt/1000;if(c.y-c.length*19>height)c.y=-Math.random()*140;}paint();}raf=requestAnimationFrame(tick);}
 function sync(){cancelAnimationFrame(raf);raf=0;last=0;if(reduced.matches){ctx?.clearRect(0,0,width,height);animations.forEach(a=>a.cancel());return;}if(!document.hidden&&ctx)raf=requestAnimationFrame(tick);}
 function pointer(e){mx=e.clientX;my=e.clientY;const el=e.target instanceof Element?e.target.closest(cards):null;if(el){const b=el.getBoundingClientRect();el.style.setProperty("--cb-card-x",`${e.clientX-b.left}px`);el.style.setProperty("--cb-card-y",`${e.clientY-b.top}px`);}}
 function leave(){mx=my=-999;}
 function animate(el,delay=0,hero=false){if(reduced.matches||!el.animate||el.contains(document.activeElement))return;const a=el.animate([{opacity:hero ? .2 : .72,transform:`translateY(${hero?12:10}px)`},{opacity:1,transform:"translateY(0)"}],{duration:hero?540:400,delay,easing:"cubic-bezier(.2,.75,.25,1)",fill:"backwards"});animations.add(a);a.onfinish=a.oncancel=()=>animations.delete(a);}
 const observer=typeof IntersectionObserver!=="undefined"?new IntersectionObserver(items=>{for(const item of items){if(!item.isIntersecting)continue;observer.unobserve(item.target);animate(item.target);}}, {threshold:.10}):null;
 function scan(){if(!observer||reduced.matches)return;document.querySelectorAll(reveal).forEach(el=>{if(seen.has(el))return;seen.add(el);if(el.getBoundingClientRect().top>innerHeight)observer.observe(el);});}
 if(pathname==="/"&&!reduced.matches){document.querySelectorAll(".home-hero-copy > .eyebrow,.home-hero-copy > h1,.home-hero-copy > p,.home-hero-copy > form,.home-hero-actions,.home-hero-note,.home-featured-card").forEach((el,i)=>animate(el,Math.min(i*65,325),true));}
 scan();const mutations=new MutationObserver(scan);mutations.observe(document.body,{childList:true,subtree:true});const theme=new MutationObserver(()=>{light=html.dataset.theme==="light";if(!reduced.matches)paint();});theme.observe(html,{attributes:true,attributeFilter:["data-theme"]});
 resize();sync();window.addEventListener("resize",resize,{passive:true});if(fine.matches)window.addEventListener("pointermove",pointer,{passive:true});html.addEventListener("pointerleave",leave);document.addEventListener("visibilitychange",sync);reduced.addEventListener("change",sync);
 return()=>{cancelAnimationFrame(raf);observer?.disconnect();mutations.disconnect();theme.disconnect();animations.forEach(a=>a.cancel());canvas.remove();delete html.dataset.cbMotion;delete html.dataset.cbRain;window.removeEventListener("resize",resize);window.removeEventListener("pointermove",pointer);html.removeEventListener("pointerleave",leave);document.removeEventListener("visibilitychange",sync);reduced.removeEventListener("change",sync);};
 },[pathname]);return null;
}
