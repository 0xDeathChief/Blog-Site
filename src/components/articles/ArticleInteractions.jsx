"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {Bookmark,Heart,MessageCircle,Eye} from "lucide-react";
import GuestChallenge from "./GuestChallenge";

export default function ArticleInteractions({articleId,articlePath,isReader,comments,engagement={}}){
 const [items,setItems]=useState(comments??[]);
 const [liked,setLiked]=useState(false),[bookmarked,setBookmarked]=useState(false);
 const [likeCount,setLikeCount]=useState(Number(engagement.like_count)||0),[commentCount,setCommentCount]=useState(Math.max(Number(engagement.comment_count)||0,comments?.length||0));
 const [comment,setComment]=useState(""),[username,setUsername]=useState(""),[guest,setGuest]=useState(null),[guestAllowed,setGuestAllowed]=useState(false),[loaded,setLoaded]=useState(false),[ready,setReady]=useState(false);
 const [captchaToken,setCaptchaToken]=useState(""),[challengeReset,setChallengeReset]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const canInteract=isReader||Boolean(guest);
 const endpoint=isReader?"/api/reader/activity":"/api/guest/activity";
 useEffect(()=>{let active=true;const controller=new AbortController();
  // Defer the GET so Strict Mode setup/cleanup does not issue two requests.
  const loadTimer=setTimeout(()=>{
  fetch(`${endpoint}?articleId=${encodeURIComponent(articleId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to load activity.");if(active){setLiked(Boolean(result.liked));setBookmarked(Boolean(result.bookmarked));setGuestAllowed(Boolean(result.enabled));setGuest(result.name??null);setReady(true);}}).catch(()=>{if(active)setError("Activity is temporarily unavailable.");}).finally(()=>{if(active)setLoaded(true);});
  },0);
  const timer=setTimeout(()=>{if(document.visibilityState!=="visible")return;
    fetch("/api/guest/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"view",articleId}),keepalive:true}).catch(()=>{});
    if(isReader)fetch("/api/reader/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"read",articleId})}).catch(()=>{});
  },2500);
  return()=>{active=false;clearTimeout(loadTimer);clearTimeout(timer);controller.abort();};
 },[articleId,isReader,endpoint]);
 async function request(url,payload,method="POST"){
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=response.status===204?{}:await response.json();if(!response.ok)throw new Error(data.error||"Please try again.");return data;
 }
 async function perform(fn){if(busy)return;setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function identify(event){event.preventDefault();await perform(async()=>{try{const data=await request("/api/guest/activity",{action:"identify",username,captchaToken});setGuest(data.name);setNotice("Guest profile ready. You can now react or comment.");}finally{setChallengeReset(n=>n+1);}});}
 async function toggleLike(){if(!canInteract||!ready)return;await perform(async()=>{const next=!liked;const result=await request(endpoint,{action:isReader?"like":next?"like":"unlike",articleId},isReader&&!next?"DELETE":"POST");const confirmed=isReader?next:result.liked===true;setLiked(confirmed);if(confirmed!==liked)setLikeCount(n=>Math.max(0,n+(confirmed?1:-1)));});}
 async function toggleBookmark(){await perform(async()=>{await request("/api/reader/activity",{action:"bookmark",articleId},bookmarked?"DELETE":"POST");setBookmarked(!bookmarked);});}
 async function submitComment(event){event.preventDefault();if(!comment.trim()||!canInteract)return;await perform(async()=>{const result=await request(endpoint,{action:"comment",articleId,body:comment});if(result.comment){setItems(old=>[result.comment,...old.filter(c=>c.id!==result.comment.id)]);setCommentCount(n=>n+1);setNotice("Comment posted.");}else if(result.status==="pending"){setNotice("Comment submitted. It will appear after moderation.");}else{setNotice("Comment saved. Reopen this article to view the latest discussion.");}setComment("");});}
 return <section className="article-interactions cb-discussion" aria-label="Article engagement">
  <div className="cb-engagement-meta"><span title="Approximate browser-day views over the last 30 days"><Eye size={16}/> {Number(engagement.view_count)||0} views / 30d</span><span><MessageCircle size={16}/> {commentCount} comments</span></div>
  <div className="article-interaction-actions">
   <button type="button" disabled={busy||!canInteract||!ready} aria-pressed={liked} onClick={toggleLike}><Heart size={17} fill={liked?"currentColor":"none"}/> {likeCount} {liked?"Liked":"Like"}</button>
   {isReader&&<button type="button" disabled={busy||!ready} aria-pressed={bookmarked} onClick={toggleBookmark}><Bookmark size={17}/> {bookmarked?"Bookmarked":"Bookmark"}</button>}
  </div>
  {!isReader&&!guest&&loaded&&guestAllowed&&<form className="cb-guest-form" onSubmit={identify}><div><strong>Join the conversation</strong><p>Choose a guest username. No email or password needed. Guest comments are moderated.</p></div><label htmlFor="cb-guest-name">Guest username</label><div className="cb-guest-input"><input id="cb-guest-name" autoComplete="nickname" maxLength={32} minLength={3} required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your display name"/><button type="submit" className="primary-button" disabled={busy||username.trim().length<3||(Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)&&!captchaToken)}>Continue as guest</button></div><GuestChallenge onToken={setCaptchaToken} resetCount={challengeReset}/><p><Link href={`/sign-in?next=${encodeURIComponent(articlePath)}`}>Sign in instead</Link> to keep a permanent profile and bookmarks.</p></form>}
  {!isReader&&!guest&&loaded&&!guestAllowed&&<p><Link href={`/sign-in?next=${encodeURIComponent(articlePath)}`}>Sign in</Link> to comment or react. Guest interactions are not available at the moment.</p>}
  {!isReader&&guest&&<p className="cb-guest-status">Participating as <strong>{guest}</strong> · Guest</p>}
  <div className="article-comments"><h2><MessageCircle size={18}/> Discussion <span>{commentCount}</span></h2>
   {canInteract&&<form onSubmit={submitComment}><label htmlFor="article-comment">Add a comment</label><textarea id="article-comment" rows={3} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} required placeholder="Share a constructive thought or question…"/><button className="primary-button" type="submit" disabled={busy||!comment.trim()}>{busy?"Please wait…":"Post comment"}</button></form>}
   {items.length?<ol>{items.map(item=><li key={item.id}><div className="cb-comment-byline"><strong>{item.display_name||"Member"}</strong>{item.is_guest&&<span className="cb-guest-pill">Guest</span>}<time dateTime={item.created_at}>{formatDate(item.created_at)}</time></div><p>{item.body}</p></li>)}</ol>:<p className="muted-copy">No public comments yet. Start the discussion.</p>}
   {commentCount>items.length&&<p className="muted-copy">Showing the latest {items.length} comments.</p>}
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
 </section>;
}
function formatDate(value){return new Intl.DateTimeFormat("en",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value));}
