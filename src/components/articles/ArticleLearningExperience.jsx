"use client";

import { useState } from "react";
import Link from "next/link";
import ArticleEditor from "@/components/articles/ArticleEditor";
import AssistantChat from "@/components/ai/AssistantChat";
import ArticleInteractions from "@/components/articles/ArticleInteractions";
import ArticleTranslationTools from "@/components/articles/ArticleTranslationTools";

export default function ArticleLearningExperience({
  articleSlug,
  articleId,
  articlePath,
  isReader,
  comments,
  category,
  categorySlug,
  title,
  summary,
  authorName,
  authorId,
  publishedDate,
  readingTime,
  difficulty,
  tags,
  content,
}) {
  const [selection, setSelection] = useState("");
  const [translatedArticle, setTranslatedArticle] = useState(null);
  const [translationMeta, setTranslationMeta] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const displayedArticle = showTranslation && translatedArticle ? translatedArticle : null;

  return (
    <>
      <header className="published-article-header">
        <Link className="article-category" href={categorySlug ? `/categories/${categorySlug}` : "/categories"}>{category}</Link>
        <h1>{displayedArticle?.title ?? title}</h1>
        <p className="published-article-summary">{displayedArticle?.summary ?? summary}</p>
        <div className="published-article-meta">
          <span>By {authorId ? <Link href={`/authors/${authorId}`}>{authorName}</Link> : authorName}</span>
          <span>{publishedDate}</span>
          <span>{readingTime} min read</span>
          <span>{capitalize(difficulty)}</span>
        </div>
        {tags.length > 0 && (
          <div className="published-article-tags">
            {tags.map((tag) => <Link href={`/tags/${tag.slug}`} key={tag.slug}>{tag.name}</Link>)}
          </div>
        )}
      </header>
      <div className="article-learning-layout">
        <div className="article-reading-column">
          <ArticleTranslationTools
            articleSlug={articleSlug}
            translatedContent={translatedArticle}
            translationMeta={translationMeta}
            showTranslation={showTranslation}
            onTranslatedContent={(articleTranslation, metadata) => {
              setTranslatedArticle(articleTranslation);
              setTranslationMeta(metadata);
            }}
            onShowTranslation={setShowTranslation}
          />
          <ArticleEditor
            key={displayedArticle ? "translated-article" : "original-article"}
            content={displayedArticle?.content ?? content}
            readOnly
            onTextSelection={setSelection}
          />
        </div>
        <aside className="article-assistant-sidebar" aria-label="Ask about this article">
          <AssistantChat articleSlug={articleSlug} selection={selection} />
        </aside>
      </div>
      <ArticleInteractions
        articleId={articleId}
        articlePath={articlePath}
        isReader={isReader}
        comments={comments}
      />
    </>
  );
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
