import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createSupabasePublicClient} from "@/lib/supabase/public";
export const dynamic="force-dynamic";
export async function GET(_request,{params}){
 const {path}=await params;const key=path.join('/');
 if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(key))return new Response(null,{status:404});
 const publicCheck=await createSupabasePublicClient().rpc('cb_media_visible',{p_path:key});
 const publicImage=!publicCheck.error&&publicCheck.data===true;
 if(!publicImage){const client=await createSupabaseServerClient();const {data:allowed,error}=await client.rpc('cb_media_visible',{p_path:key});if(error||allowed!==true)return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
 const {data,error:downloadError}=await createSupabaseAdminClient().storage.from('article-covers').download(key);
 if(downloadError||!data)return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
 const type={jpg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'}[key.split('.').pop()];
 return new Response(data,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':publicImage?'private, max-age=60, must-revalidate':'private, no-store','Vary':'Cookie','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
