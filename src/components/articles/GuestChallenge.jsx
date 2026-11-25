"use client";
import Script from "next/script";
import {useEffect,useRef,useState} from "react";
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export default function GuestChallenge({onToken,resetCount}){
 const container=useRef(null);const [ready,setReady]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{if(!ready||!siteKey||!container.current||!window.turnstile)return;let widget;let mqGuestEffectActive=true;
  try{widget=window.turnstile.render(container.current,{sitekey:siteKey,action:"cb-guest",theme:"auto",callback:token=>onToken(token),"expired-callback":()=>onToken(""),"error-callback":()=>{onToken("");setError(true);}});}catch{queueMicrotask(()=>{if(mqGuestEffectActive)setError(true);});}
  return()=>{mqGuestEffectActive=false;if(widget!==undefined)window.turnstile?.remove(widget);onToken("");};
 },[ready,onToken,resetCount]);
 if(!siteKey)return null;
 return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={()=>setReady(true)} onError={()=>setError(true)}/><div ref={container}/>{error&&<p role="alert" className="form-error">Human verification could not load. Try again or sign in.</p>}</>;
}
