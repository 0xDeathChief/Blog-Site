import { z } from "zod";

const allowedNodes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);
const allowedMarks = new Set(["bold", "italic", "strike", "code", "link"]);
const allowedChildren = {
  doc: new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule", "image", "table"]),
  paragraph: new Set(["text", "hardBreak"]),
  heading: new Set(["text", "hardBreak"]),
  bulletList: new Set(["listItem"]),
  orderedList: new Set(["listItem"]),
  listItem: new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule", "image"]),
  blockquote: new Set(["paragraph", "heading", "bulletList", "orderedList", "codeBlock"]),
  codeBlock: new Set(["text"]),
  table: new Set(["tableRow"]),
  tableRow: new Set(["tableCell", "tableHeader"]),
  tableCell: new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule"]),
  tableHeader: new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule"]),
};
const minimumChildren = {
  doc: 1,
  bulletList: 1,
  orderedList: 1,
  listItem: 1,
  blockquote: 1,
  table: 1,
  tableRow: 1,
  tableCell: 1,
  tableHeader: 1,
};
const articleContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).max(5000),
}).strict();

export const saveArticleSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(5).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  summary: z.string().trim().min(20).max(280),
  content: z.unknown(),
  categoryId: z.string().uuid(),
  coverImagePath: z.string().max(256).nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  tagIds: z.array(z.string().uuid()).max(10).refine((ids) => new Set(ids).size === ids.length),
}).strict();

export const articleActionSchema = z.object({
  action: z.enum([
    "submit",
    "start_review",
    "request_revision",
    "reject",
    "approve",
    "publish",
    "unpublish",
  ]),
  feedback: z.string().trim().max(4000).optional(),
}).strict();

function safeUrl(value, { image = false } = {}) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const allowedProtocols = image ? ["https:"] : ["https:", "http:", "mailto:"];
    if (!allowedProtocols.includes(url.protocol) || url.username || url.password) return null;
    return value;
  } catch {
    return null;
  }
}

function sanitizeMark(mark) {
  if (!mark || typeof mark !== "object" || !allowedMarks.has(mark.type)) return null;
  if (mark.type === "link") {
    const href = safeUrl(mark.attrs?.href);
    return href ? { type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } } : null;
  }
  return { type: mark.type };
}

function sanitizeNode(node, depth, state) {
  if (!node || typeof node !== "object" || Array.isArray(node) || depth > 30) return null;
  if (!allowedNodes.has(node.type) || (node.type === "doc" && depth > 1)) return null;
  if (node.content !== undefined && !Array.isArray(node.content)) return null;
  state.count += 1;
  if (state.count > 5000) return null;

  if (node.type === "text") {
    if (typeof node.text !== "string") return null;
    if (node.marks !== undefined && !Array.isArray(node.marks)) return null;
    if (node.marks?.length > 5) return null;
    state.textSize += node.text.length;
    if (state.textSize > 500_000) return null;
    const marks = Array.isArray(node.marks)
      ? node.marks.map(sanitizeMark).filter(Boolean)
      : undefined;
    return { type: "text", text: node.text, ...(marks?.length ? { marks } : {}) };
  }

  const result = { type: node.type };
  if (node.type === "heading") {
    const level = Number(node.attrs?.level);
    if (![1, 2, 3].includes(level)) return null;
    result.attrs = { level };
  } else if (node.type === "orderedList" && node.attrs?.start !== undefined) {
    const start = Number(node.attrs.start);
    if (!Number.isInteger(start) || start < 1 || start > 100_000) return null;
    result.attrs = { start };
  } else if (node.type === "codeBlock" && node.attrs?.language) {
    const language = String(node.attrs.language);
    if (!/^[\w#+.-]{1,30}$/.test(language)) return null;
    result.attrs = { language };
  } else if (node.type === "image") {
    const src = safeUrl(node.attrs?.src, { image: true });
    if (!src) return null;
    result.attrs = {
      src,
      alt: typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 300) : "",
      title: typeof node.attrs?.title === "string" ? node.attrs.title.slice(0, 300) : null,
    };
  } else if (node.type === "tableCell" || node.type === "tableHeader") {
    const attrs = {};
    for (const key of ["colspan", "rowspan"]) {
      if (node.attrs?.[key] !== undefined) {
        const value = Number(node.attrs[key]);
        if (!Number.isInteger(value) || value < 1 || value > 20) return null;
        attrs[key] = value;
      }
    }
    if (node.attrs?.colwidth !== undefined && node.attrs.colwidth !== null) {
      if (
        !Array.isArray(node.attrs.colwidth)
        || node.attrs.colwidth.length > 20
        || node.attrs.colwidth.some((value) => !Number.isInteger(value) || value < 1 || value > 2000)
      ) return null;
      attrs.colwidth = node.attrs.colwidth;
    }
    if (Object.keys(attrs).length) result.attrs = attrs;
  }

  if (Array.isArray(node.content)) {
    const content = node.content.map((child) => sanitizeNode(child, depth + 1, state));
    if (content.some((child) => child === null)) return null;
    if (content.some((child) => !allowedChildren[node.type]?.has(child.type))) return null;
    if (content.length < (minimumChildren[node.type] ?? 0)) return null;
    result.content = content;
  } else if (
    ["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem",
      "blockquote", "codeBlock", "table", "tableRow", "tableCell", "tableHeader"].includes(node.type)
  ) {
    if ((minimumChildren[node.type] ?? 0) > 0) return null;
    result.content = [];
  }
  return result;
}

export function sanitizeArticleContent(input) {
  const parsed = articleContentSchema.safeParse(input);
  if (!parsed.success) return { success: false };
  const state = { count: 0, textSize: 0 };
  const content = parsed.data.content.map((node) => sanitizeNode(node, 1, state));
  if (content.some((node) => node === null)) return { success: false };
  const document = { type: "doc", content };
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > 500_000) {
    return { success: false };
  }
  return { success: true, document };
}
