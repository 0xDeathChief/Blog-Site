"use client";

import { useMemo, useState } from "react";
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

export default function ArticleEditor({ content, onChange, onTextSelection, readOnly = false }) {
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdownText, setMarkdownText] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("bash");
  const lowlight = useMemo(() => createLowlight(common), []);
  const extensions = useMemo(() => [
    StarterKit.configure({ codeBlock: false }),
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

  function addLink() {
    const href = window.prompt("Enter an HTTPS, HTTP, or mailto link");
    if (href) editor?.chain().focus().setLink({ href }).run();
  }

  function addImage() {
    const src = window.prompt("Enter an HTTPS image URL");
    if (src) editor?.chain().focus().setImage({ src, alt: "" }).run();
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
        <button type="button" aria-label="Bold" title="Bold" disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button type="button" aria-label="Italic" title="Italic" disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button type="button" aria-label="Heading" title="Heading" disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></button>
        <span className="editor-divider" />
        <button type="button" aria-label="Bulleted list" title="Bulleted list" disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17} /></button>
        <button type="button" aria-label="Numbered list" title="Numbered list" disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></button>
        <button type="button" aria-label="Blockquote" title="Blockquote" disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
        <button type="button" aria-label="Inline code" title="Inline code" disabled={!editor} onClick={() => editor?.chain().focus().toggleCode().run()}><Code2 size={16} /></button>
        <label className="code-language-picker">
          <span className="sr-only">Code language</span>
          <select value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value)} aria-label="Code language">
            {["bash", "javascript", "python", "sql", "json", "yaml", "plaintext"].map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>
        <button type="button" aria-label="Code block" title={`${codeLanguage} code block`} disabled={!editor} onClick={addCodeBlock}><span className="code-toolbar-mark">&lt;/&gt;</span></button>
        <span className="editor-divider" />
        <button type="button" aria-label="Add link" title="Add link" disabled={!editor} onClick={addLink}><Link2 size={16} /></button>
        <button type="button" aria-label="Add image" title="Add image" disabled={!editor} onClick={addImage}><ImagePlus size={16} /></button>
        <button type="button" aria-label="Insert table" title="Insert table" disabled={!editor} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></button>
        <button
          className="markdown-toggle"
          type="button"
          disabled={!editor}
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
          <button type="button" className="secondary-button" disabled={!editor} onClick={applyMarkdown}>Apply Markdown</button>
        </div>
      ) : (
        <EditorContent editor={editor} className="tiptap-content" />
      )}
      <p className="editor-hint">
        Use code blocks for terminal commands and samples. Switch to Markdown to edit or paste source, then apply it to the draft.
      </p>
    </section>
  );
}
