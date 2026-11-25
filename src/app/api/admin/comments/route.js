import {NextResponse} from "next/server";
import {z} from "zod";
import {requireOwnerApi,readJsonBody} from "@/lib/auth/api";
import {createSupabaseServerClient} from "@/lib/supabase/server";
const schema=z.object({id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),action:z.enum(["approve","hide","delete"])}).strict();
export async function POST(request){
 const owner=await requireOwnerApi(request,{mutating:true});if(owner.response)return owner.response;
 const input=await readJsonBody(request,{maxBytes:2048});if(input.response)return input.response;
 const parsed=schema.safeParse(input.body);if(!parsed.success)return NextResponse.json({error:"Invalid moderation action."},{status:400});
 const supabase=await createSupabaseServerClient();const {error}=await supabase.rpc("cb_moderate_comment",{p_comment_id:parsed.data.id,p_action:parsed.data.action});
 if(error)return NextResponse.json({error:"Unable to moderate this comment."},{status:error.code==="42501"?403:400});
 return NextResponse.json({status:parsed.data.action==="delete"?"deleted":parsed.data.action==="approve"?"published":"hidden"});
}
