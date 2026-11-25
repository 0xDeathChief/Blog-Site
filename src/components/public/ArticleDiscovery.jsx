"use client";
import Link from "next/link";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {SlidersHorizontal,Search} from "lucide-react";
import ArticleCards from "@/components/public/ArticleCards";

const difficultyOptions = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
  ["expert", "Expert"],
];

export default function ArticleDiscovery({
  results,
  filters,
  options,
  action,
  emptyMessage,
}) {
  const router = useRouter();
  const [open,setOpen] = useState(false);
  const [list,setList] = useState(false);
  const [pending,startTransition] = useTransition();
  const activeCount = [filters.categorySlug, filters.tagSlug, filters.difficulty, filters.authorId].filter(Boolean).length;
  function submitFilters(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name,value] of new FormData(event.currentTarget)) if(typeof value === "string" && value.trim()) params.set(name,value.trim());
    if(!params.get("q") && params.get("sort")==="relevance") params.delete("sort");
    startTransition(()=>router.push(`${action}${params.size ? `?${params}` : ""}`, {scroll:false}));
    setOpen(false);
  }
  const pageHref = (page) => buildPageHref(action, filters, page);
  const pages = getVisiblePages(results.page, results.totalPages);
  const firstResult = results.total ? (results.page - 1) * results.pageSize + 1 : 0;
  const lastResult = Math.min(results.page * results.pageSize, results.total);

  return (
    <>
      <form className="cb-discovery-form" action={action} method="get" onSubmit={submitFilters} key={JSON.stringify(filters)}>
        <div className="cb-discovery-bar">
        <label className="discovery-query">
          Search
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={filters.query}
            placeholder="Search titles, topics, and article text"
          />
        </label>
          <button type="submit" className="primary-button" disabled={pending}><Search size={16}/> Search</button>
          <button type="button" className="secondary-button cb-filter-toggle" aria-expanded={open} aria-controls="cb-filter-panel" onClick={()=>setOpen(v=>!v)}><SlidersHorizontal size={16}/> Filters{activeCount ? ` (${activeCount})` : ""}</button>
        </div>
        <div className="discovery-filters cb-filter-panel" id="cb-filter-panel" hidden={!open}>
        <label>
          Category
          <select name="category" defaultValue={filters.categorySlug}>
            <option value="">All categories</option>
            {options.categories.map((category) => (
              <option value={category.slug} key={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select name="tag" defaultValue={filters.tagSlug}>
            <option value="">All tags</option>
            {options.tags.map((tag) => (
              <option value={tag.slug} key={tag.id}>{tag.name}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select name="difficulty" defaultValue={filters.difficulty}>
            <option value="">All levels</option>
            {difficultyOptions.map(([value, name]) => <option value={value} key={value}>{name}</option>)}
          </select>
        </label>
        <label>
          Author
          <select name="author" defaultValue={filters.authorId}>
            <option value="">All authors</option>
            {options.authors.map((author) => (
              <option value={author.author_id} key={author.author_id}>{author.full_name}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select name="sort" defaultValue={filters.sort === "newest" && !filters.query ? "" : filters.sort}>
            <option value="">Automatic (relevant / latest)</option>
            <option value="relevance">Most relevant</option>
            <option value="newest">Newest</option>
            <option value="popularity">Trending</option>
          </select>
        </label>
        <div className="discovery-filter-actions">
          <button className="primary-button" type="submit" disabled={pending}>Apply filters</button>
          <Link href={action}>Clear all</Link>
        </div>
        </div>
      </form>
      {activeCount > 0 && <div className="cb-filter-summary"><span>{activeCount} active filter{activeCount===1?"":"s"}</span><Link href={action}>Clear all</Link></div>}
      {pending && <p className="muted-copy" role="status">Updating results…</p>}

      <div className="discovery-results-summary" aria-live="polite">
        <span>{results.total ? `Showing ${firstResult}–${lastResult} of ${results.total} articles` : "0 articles found"}</span>
        {results.total > 0 && <span>Page {results.page} of {results.totalPages}</span>}
      </div>

      <div className="cb-discovery-layout-toggle"><button className="secondary-button" type="button" aria-pressed={list} onClick={()=>setList(v=>!v)}>{list?"Grid view":"List view"}</button></div>
      <div className={list?"cb-discovery-list":undefined}><ArticleCards articles={results.articles} emptyMessage={emptyMessage} /></div>

      {results.totalPages > 1 && (
        <nav className="discovery-pagination" aria-label="Article pages">
          {results.page > 1
            ? <Link href={pageHref(results.page - 1)} rel="prev">Previous</Link>
            : <span aria-disabled="true">Previous</span>}
          <div className="discovery-page-numbers">
            {pages[0] > 1 && <><Link href={pageHref(1)}>1</Link>{pages[0] > 2 && <span aria-hidden="true">…</span>}</>}
            {pages.map((page) => page === results.page
              ? <span aria-current="page" key={page}>{page}</span>
              : <Link href={pageHref(page)} key={page}>{page}</Link>)}
            {pages[pages.length - 1] < results.totalPages && (
              <>
                {pages[pages.length - 1] < results.totalPages - 1 && <span aria-hidden="true">…</span>}
                <Link href={pageHref(results.totalPages)}>{results.totalPages}</Link>
              </>
            )}
          </div>
          {results.page < results.totalPages
            ? <Link href={pageHref(results.page + 1)} rel="next">Next</Link>
            : <span aria-disabled="true">Next</span>}
        </nav>
      )}
    </>
  );
}

function getVisiblePages(page, totalPages) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildPageHref(action, filters, page) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.tagSlug) params.set("tag", filters.tagSlug);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.authorId) params.set("author", filters.authorId);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${action}?${query}` : action;
}
