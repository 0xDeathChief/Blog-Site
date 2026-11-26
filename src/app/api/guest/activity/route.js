import {NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {readJsonBody} from "@/lib/auth/api";
import {guestEnabled,interactionConfigured,sameOrigin,readIdentity,newIdentity,setIdentity,identityHash,verifyGuestChallenge} from "@/lib/community/guest-session";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const json=(data,status=200)=>NextResponse.json(data,{status,headers});
const idSchema=z.string().uuid();
const username=z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u);
const mutation=z.discriminatedUnion("action",[
 z.object({action:z.literal("identify"),username,captchaToken:z.string().max(2048).optional()}).strict(),
 z.object({action:z.literal("comment"),articleId:idSchema,body:z.string().trim().min(1).max(2000)}).strict(),
 z.object({action:z.enum(["like","unlike","view"]),articleId:idSchema}).strict()
]);
async function allowed(admin,key,limit,windowSeconds){const {data,error}=await admin.rpc("consume_rate_limit",{p_bucket_key:key,p_request_limit:limit,p_window_seconds:windowSeconds});return !error&&data===true;}
export async function GET(request){
 const url=new URL(request.url);
 if(url.searchParams.get("stats")==="views"){
   const id=idSchema.safeParse(url.searchParams.get("articleId"));if(!id.success)return json({error:"Invalid article"},400);
   const {data,error}=await createSupabaseAdminClient().from("cb_article_engagement").select("view_count").eq("article_id",id.data).maybeSingle();
   if(error){console.warn("[MadQuill views] Aggregate unavailable",error.code);return json({error:"View count unavailable"},503);}
   if(!data)return json({error:"Article not found"},404);
   return json({viewCount:Number(data.view_count)});
 }
 const enabled=guestEnabled(request);if(!enabled)return json({enabled:false,name:null,liked:false});
 const guest=readIdentity(request,"guest");if(!guest)return json({enabled:true,name:null,liked:false});
 const articleId=idSchema.safeParse(new URL(request.url).searchParams.get("articleId"));
 if(!articleId.success)return json({error:"Invalid article"},400);
 const {data,error}=await createSupabaseAdminClient().from("cb_guest_reactions").select("article_id").eq("article_id",articleId.data).eq("guest_hash",identityHash(guest)).maybeSingle();
 if(error)return json({error:"Unable to load guest activity."},503);
 return json({enabled:true,name:guest.name,liked:Boolean(data)});
}
export async function POST(request){
 if(!sameOrigin(request))return json({error:"Invalid request origin."},403);
 if(!interactionConfigured())return json({error:"Guest activity is not configured."},503);
 const input=await readJsonBody(request,{maxBytes:8192});if(input.response)return input.response;
 const parsed=mutation.safeParse(input.body);if(!parsed.success)return json({error:"Check the username, article or comment and try again."},400);
 const payload=parsed.data;const admin=createSupabaseAdminClient();
 if(payload.action==="view"){
   if(!await allowed(admin,"cb-view-global",1000,300))return json({status:"skipped"},429);
   const old=readIdentity(request,"visitor");const visitor=old??newIdentity("visitor");
   const {error}=await admin.rpc("cb_record_article_view",{p_article_id:payload.articleId,p_visitor_hash:identityHash(visitor)});
   if(error){console.warn("[MadQuill views] Recording unavailable",error.code);return json({error:"View recording unavailable"},503);}
   const {data,error:countError}=await admin.from("cb_article_engagement").select("view_count").eq("article_id",payload.articleId).maybeSingle();
   if(countError)console.warn("[MadQuill views] Aggregate unavailable",countError.code);
   const response=json({status:"recorded",viewCount:data?Number(data.view_count):null});if(!old)setIdentity(response,visitor);return response;
 }
 if(!guestEnabled(request))return json({error:"Guest interactions are temporarily unavailable. Sign in to participate."},503);
 if(payload.action==="identify"){
   const existing=readIdentity(request,"guest");if(existing)return json({name:existing.name});
   if(!await allowed(admin,"cb-guest-create-global",100,300))return json({error:"Guest registration is busy. Try again later."},429);
   if(!await verifyGuestChallenge(request,payload.captchaToken))return json({error:"Complete the human verification and try again."},403);
   const guest=newIdentity("guest",payload.username);const response=json({name:guest.name},201);setIdentity(response,guest);return response;
 }
 const guest=readIdentity(request,"guest");if(!guest)return json({error:"Choose a guest username first."},401);
 const hash=identityHash(guest);const isComment=payload.action==="comment";
 if(!await allowed(admin,isComment?"cb-guest-comment-global":"cb-guest-like-global",isComment?150:1000,3600)||!await allowed(admin,`cb-guest-${isComment?"comment":"reaction"}:${hash}`,isComment?5:30,isComment?3600:600))return json({error:"Too many interactions. Please try later."},429);
 if(isComment){const {error}=await admin.rpc("cb_guest_comment",{p_article_id:payload.articleId,p_display_name:guest.name,p_content:payload.body});if(error)return json({error:"Unable to submit this comment."},400);return json({status:"pending"},201);}
 const {data,error}=await admin.rpc("cb_guest_react",{p_article_id:payload.articleId,p_guest_hash:hash,p_liked:payload.action==="like"});
 if(error)return json({error:"Unable to save reaction."},400);
 return json({liked:data===true});
}
