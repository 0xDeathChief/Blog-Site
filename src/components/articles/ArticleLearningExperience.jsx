import Link from "next/link";
import PublishedContent from "@/components/articles/PublishedContent";
import ReaderPreferences from "./ReaderPreferences";
import ArticleInteractions from "@/components/articles/ArticleInteractions";

export default function ArticleLearningExperience({
  cover,
  articleId,
  articlePath,
  isReader,
  comments,
  engagement,
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
  return (
    <>
      <header className="published-article-header">
        <Link className="article-category" href={categorySlug ? `/categories/${categorySlug}` : "/categories"}>{category}</Link>
        <h1>{title}</h1>
        <p className="published-article-summary">{summary}</p>
        <div className="published-article-meta">
          <span>By {authorId ? <Link href={`/authors/${authorId}`}>{authorName}</Link> : authorName}</span>
          <span>{publishedDate}</span>
          <span>{readingTime} min read</span>
          <span>{capitalize(difficulty)}</span>
        </div>
        {tags.filter(tag => tag.name?.toLowerCase() !== category?.toLowerCase() && tag.name?.toLowerCase() !== difficulty?.toLowerCase()).length > 0 && (
          <div className="published-article-tags">
            {tags.filter(tag => tag.name?.toLowerCase() !== category?.toLowerCase() && tag.name?.toLowerCase() !== difficulty?.toLowerCase()).map((tag) => <Link href={`/tags/${tag.slug}`} key={tag.slug}>{tag.name}</Link>)}
          </div>
        )}
      </header>
      <ReaderPreferences key={articleId}>
      {cover}
      <div className="article-learning-layout">
        <div className="article-reading-column">
          <PublishedContent content={content} />
        </div>
      </div>
      </ReaderPreferences>
      <ArticleInteractions
        articleId={articleId}
        articlePath={articlePath}
        isReader={isReader}
        comments={comments}
        engagement={engagement}
      />
    </>
  );
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}
