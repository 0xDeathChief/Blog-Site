"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "@tiptap/markdown";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Code2,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Table2,
} from "lucide-react";

const initialContent = { type: "doc", content: [{ type: "paragraph" }] };

export default function ArticleEditor({ content, onChange, onTextSelection, readOnly = false, coverCount = 0, onBusyChange, onMarkdownChange, disabled = false }) {
  const [uploadError,setUploadError]=useState("");
  const [uploading,setUploading]=useState(false);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdownText, setMarkdownText] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("bash");
  const lowlight = useMemo(() => createLowlight(common), []);
  const extensions = useMemo(() => [
    StarterKit.configure({ codeBlock: false, link: false }),
    Link.configure({
      openOnClick: false,
      autolink: false,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
    Image.configure({ allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    Markdown,
  ], [lowlight]);

  const editor = useEditor({
    extensions,
    content: content ?? initialContent,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChange?.(currentEditor.getJSON()),
  });

  useEffect(() => { if (editor) editor.setEditable(!readOnly && !disabled); }, [editor, readOnly, disabled]);
  useEffect(() => { onBusyChange?.(uploading); }, [uploading, onBusyChange]);
  useEffect(() => { onMarkdownChange?.(showMarkdown); }, [showMarkdown, onMarkdownChange]);

  function addLink() {
    const href = window.prompt("Enter an HTTPS, HTTP, or mailto link");
    if (href) editor?.chain().focus().setLink({ href }).run();
  }

  async function addImage(event) {
    const file=event.target.files?.[0]; event.target.value=""; if(!file||!editor||uploading)return;
    let count=coverCount;editor.state.doc.descendants(node=>{if(node.type.name==="image")count++;});
    if(count>=3){setUploadError("Maximum three images including cover.");return;}
    setUploading(true);setUploadError("");try{const body=new FormData();body.set("file",file);const response=await fetch("/api/article-covers",{method:"POST",body});const result=await response.json();if(!response.ok)throw new Error(result.error||"Upload failed");editor.chain().focus().setImage({src:result.url,alt:file.name.slice(0,120)}).run();}catch(e){setUploadError(e.message);}finally{setUploading(false);}
  }

  function addCodeBlock() {
    editor?.chain().focus().toggleCodeBlock({ language: codeLanguage }).run();
  }

  function toggleMarkdown() {
    if (showMarkdown) {
      applyMarkdown();
      return;
    }
    setMarkdownText(editor?.getMarkdown() ?? "");
    setShowMarkdown((value) => !value);
  }

  function applyMarkdown() {
    editor?.commands.setContent(markdownText, { contentType: "markdown" });
    setShowMarkdown(false);
  }

  if (readOnly) {
    return (
      <div className="article-reader-content" onMouseUp={publishSelection} onKeyUp={publishSelection}>
        <EditorContent editor={editor} className="tiptap-content" />
      </div>
    );
  }

  function publishSelection(event) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    if (selectedText && event.currentTarget.contains(selection.anchorNode)) {
      onTextSelection?.(selectedText);
    } else {
      onTextSelection?.("");
    }
  }

  return (
    <section className="rich-editor" aria-label="Article content editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" title="Undo" aria-label="Undo" disabled={disabled || !editor || showMarkdown || uploading} onClick={()=>editor?.chain().focus().undo().run()}>↶</button>
        <button type="button" title="Redo" aria-label="Redo" disabled={disabled || !editor || showMarkdown || uploading} onClick={()=>editor?.chain().focus().redo().run()}>↷</button>
        <button type="button" title="Paragraph" aria-label="Paragraph" disabled={disabled || !editor || showMarkdown || uploading} onClick={()=>editor?.chain().focus().setParagraph().run()}>P</button>
        <button type="button" title="Subheading" aria-label="Subheading" disabled={disabled || !editor || showMarkdown || uploading} onClick={()=>editor?.chain().focus().toggleHeading({level:3}).run()}>H3</button>
        <button type="button" aria-label="Bold" title="Bold" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button type="button" aria-label="Italic" title="Italic" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button type="button" aria-label="Heading" title="Heading" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></button>
        <span className="editor-divider" />
        <button type="button" aria-label="Bulleted list" title="Bulleted list" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17} /></button>
        <button type="button" aria-label="Numbered list" title="Numbered list" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></button>
        <button type="button" aria-label="Blockquote" title="Blockquote" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
        <button type="button" aria-label="Inline code" title="Inline code" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().toggleCode().run()}><Code2 size={16} /></button>
        <label className="code-language-picker">
          <span className="sr-only">Code language</span>
          <select value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value)} aria-label="Code language">
            {["bash", "javascript", "python", "sql", "json", "yaml", "plaintext"].map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Code block" title={`${codeLanguage} code block`} disabled={disabled || !editor || showMarkdown || uploading} onClick={addCodeBlock}><span className="code-toolbar-mark">&lt;/&gt;</span></button>
        <span className="editor-divider" />
        <button type="button" aria-label="Add link" title="Add link" disabled={disabled || !editor || showMarkdown || uploading} onClick={addLink}><Link2 size={16} /></button>
        <label className="cb-inline-upload" title="Upload image"><ImagePlus size={16}/><input aria-label="Upload inline image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled || !editor||uploading||showMarkdown} onChange={addImage}/></label>
        <button type="button" aria-label="Insert table" title="Insert table" disabled={disabled || !editor || showMarkdown || uploading} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></button>
        <button
          className="markdown-toggle"
          type="button"
          disabled={disabled || !editor}
          aria-pressed={showMarkdown}
          onClick={toggleMarkdown}
        >
          {showMarkdown ? "Rich text" : "Markdown"}
        </button>
      </div>
      {showMarkdown ? (
        <div className="markdown-source">
          <textarea
            className="markdown-preview"
            aria-label="Markdown source"
            value={markdownText}
            onChange={(event) => setMarkdownText(event.target.value)}
          />
          <button type="button" className="secondary-button" disabled={disabled || !editor || uploading} onClick={applyMarkdown}>Apply Markdown</button>
        </div>
      ) : (
        <EditorContent editor={editor} className="tiptap-content" />
      )}
      {uploadError&&<p className="form-error" role="alert">{uploadError}</p>}
      {uploading&&<p role="status">Uploading image…</p>}
      <p className="cb-editor-metrics" aria-live="polite">{editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0} words · Images are optional</p>
      <p className="editor-hint">Maximum 3 images including cover. 
        Use code blocks for terminal commands and samples. Switch to Markdown to edit or paste source, then apply it to the draft.
      </p>
    </section>
  );
}
