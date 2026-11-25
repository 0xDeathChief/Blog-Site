"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {LayoutDashboard,FileText,ClipboardCheck,Users,Tags,Settings,ChevronRight,PenLine,Bookmark} from "lucide-react";
export default function PortalNav({links}){const path=usePathname();return <nav aria-label="Workspace navigation">{links.map(([label,href])=>{const active=path===href;const Icon=/review|feedback|submitted/i.test(label)?ClipboardCheck:/user|role|account/i.test(label)?Users:/category|tag/i.test(label)?Tags:/settings/i.test(label)?Settings:/article|draft|published/i.test(label)?FileText:/bookmark/i.test(label)?Bookmark:/write/i.test(label)?PenLine:LayoutDashboard;return <Link key={href} href={href} aria-current={active?"page":undefined}><Icon size={17}/><span>{label}</span>{active&&<ChevronRight size={14}/>}</Link>})}</nav>}
