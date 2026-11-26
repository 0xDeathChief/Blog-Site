import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import RegisterForm from "@/components/auth/RegisterForm";
export const metadata={title:"Join MadQuill",robots:{index:false,follow:false}};
export default function RegisterPage(){return <main className="auth-page"><Link className="brand auth-brand" href="/"><span className="brand-mark"><img src="/branding/madquill-icon-v2.webp" alt="" width={36} height={36} /></span><span>Mad<span>Quill</span></span></Link><div className="cb-auth-theme"><ThemeToggle/></div><section className="auth-card"><span className="section-kicker">COMMUNITY ACCESS</span><h1>Write. Share. Learn.</h1><p>Create your account to submit stories for editorial review.</p><RegisterForm/><div className="auth-page-links"><Link href="/sign-in">Already a member? Sign in</Link></div></section></main>}
