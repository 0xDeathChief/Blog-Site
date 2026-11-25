import {Fragment} from "react";

function href(value){if(typeof value!=="string"||value.length>2048)return null;try{const url=new URL(value);return ["http:","https:","mailto:"].includes(url.protocol)&&!url.username&&!url.password?value:null;}catch{return null;}}
function render(node,key,depth=0){
 if(!node||typeof node!=="object"||depth>32)return null;
 const children=Array.isArray(node.content)?node.content.map((child,i)=>render(child,`${key}-${i}`,depth+1)):null;
 const attrs=node.attrs??{};
 switch(node.type){
  case "doc":return <Fragment key={key}>{children}</Fragment>;
  case "text":{let text=typeof node.text==="string"?node.text:"";for(const mark of Array.isArray(node.marks)?node.marks:[]){switch(mark?.type){case "bold":text=<strong>{text}</strong>;break;case "italic":text=<em>{text}</em>;break;case "strike":text=<s>{text}</s>;break;case "code":text=<code>{text}</code>;break;case "link":{const url=href(mark.attrs?.href);if(url)text=<a href={url} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;break;}}}return <Fragment key={key}>{text}</Fragment>;}
  case "paragraph":return <p key={key}>{children}</p>;
  case "heading":{const Tag=`h${Math.min(6,Math.max(2,Number(attrs.level)||2))}`;return <Tag key={key} id={`cb-heading-${key}`}>{children}</Tag>;}
  case "bulletList":return <ul key={key}>{children}</ul>;
  case "orderedList":return <ol key={key} start={Number.isSafeInteger(attrs.start)?attrs.start:1}>{children}</ol>;
  case "listItem":return <li key={key}>{children}</li>;
  case "blockquote":return <blockquote key={key}>{children}</blockquote>;
  case "codeBlock":return <pre key={key}><code>{(node.content??[]).map(child=>child?.type==="text"?child.text:"").join("")}</code></pre>;
  case "hardBreak":return <br key={key}/>;
  case "horizontalRule":return <hr key={key}/>;
  case "image":return typeof attrs.src==="string"&&/^\/api\/article-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(attrs.src)?<figure key={key}><img src={attrs.src} alt={typeof attrs.alt==="string"?attrs.alt:"Article illustration"} loading="lazy" decoding="async"/></figure>:null;
  case "table":return <div className="cb-table-reader" key={key}><table><tbody>{children}</tbody></table></div>;
  case "tableRow":return <tr key={key}>{children}</tr>;
  case "tableCell":case "tableHeader":{const Tag=node.type==="tableHeader"?"th":"td";return <Tag key={key} colSpan={Math.max(1,Math.min(20,Number(attrs.colspan)||1))} rowSpan={Math.max(1,Math.min(20,Number(attrs.rowspan)||1))}>{children}</Tag>;}
  default:return null;
 }
}
export default function PublishedContent({content}){return <div className="article-reader-content"><div className="tiptap-content cb-published-content">{render(content,"doc")}</div></div>;}
