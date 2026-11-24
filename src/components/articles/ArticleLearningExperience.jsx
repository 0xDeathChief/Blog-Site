"use client";

import { useState } from "react";
import ArticleEditor from "@/components/articles/ArticleEditor";
import AssistantChat from "@/components/ai/AssistantChat";

export default function ArticleLearningExperience({ articleSlug, content }) {
  const [selection, setSelection] = useState("");

  return (
    <div className="article-learning-layout">
      <ArticleEditor
        content={content}
        readOnly
        onTextSelection={setSelection}
      />
      <aside className="article-assistant-sidebar" aria-label="Ask about this article">
        <AssistantChat articleSlug={articleSlug} selection={selection} />
      </aside>
    </div>
  );
}
