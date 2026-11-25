import "server-only";
import {createHmac,randomUUID,timingSafeEqual,createHash} from "node:crypto";

const MAX_AGE=30*24*60*60;
export const GUEST_COOKIE="cb_guest_v1";
export const VISITOR_COOKIE="cb_visitor_v1";
function secret(){const value=process.env.CB_INTERACTION_SECRET;return typeof value==="string"&&value.length>=43?value:null;}
export function interactionConfigured(){return Boolean(secret())&&process.env.APP_MODE!=="preview";}
export function localDevelopment(request){return process.env.NODE_ENV!=="production"&&["localhost","127.0.0.1","[::1]"].includes(new URL(request.url).hostname);}
export function guestEnabled(request){return interactionConfigured()&&(localDevelopment(request)||Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&process.env.TURNSTILE_SECRET_KEY));}
export function sameOrigin(request){try{return new URL(request.headers.get("origin")||"").origin===new URL(request.url).origin;}catch{return false;}}
function mac(body){const key=secret();return key?createHmac("sha256",key).update(body).digest():null;}
export function readIdentity(request,kind){
 const token=request.cookies.get(kind==="guest"?GUEST_COOKIE:VISITOR_COOKIE)?.value;
 if(!token||token.length>1200)return null;
 const [body,sig,...extra]=token.split(".");if(!body||!sig||extra.length)return null;
 try{const expected=mac(body);const supplied=Buffer.from(sig,"base64url");if(!expected||supplied.length!==expected.length||!timingSafeEqual(expected,supplied))return null;
 const data=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));if(data.kind!==kind||typeof data.id!=="string"||!/^[0-9a-f-]{36}$/.test(data.id)||!Number.isSafeInteger(data.exp)||data.exp<=Date.now()||(kind==="guest"&&typeof data.name!=="string"))return null;return data;}catch{return null;}
}
export function newIdentity(kind,name){return {kind,id:randomUUID(),...(kind==="guest"?{name}:{}),exp:Date.now()+MAX_AGE*1000};}
export function setIdentity(response,data){const body=Buffer.from(JSON.stringify(data)).toString("base64url");const signed=mac(body);if(!signed)throw new Error("Interaction secret missing");response.cookies.set(data.kind==="guest"?GUEST_COOKIE:VISITOR_COOKIE,`${body}.${signed.toString("base64url")}`,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:MAX_AGE});}
export function identityHash(data){return createHash("sha256").update(`cipherbrief:${data.kind}:${data.id}`).digest("hex");}
export async function verifyGuestChallenge(request,token){
 if(localDevelopment(request)&&!process.env.TURNSTILE_SECRET_KEY)return true;
 if(typeof token!=="string"||!token||!process.env.TURNSTILE_SECRET_KEY)return false;
 try{const expectedHost=new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname;const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(8000),cache:"no-store"});const result=await response.json();return response.ok&&result.success===true&&result.hostname===expectedHost&&result.action==="cb-guest";}catch{return false;}
}
