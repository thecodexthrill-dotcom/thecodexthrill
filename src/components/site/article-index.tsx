"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { articles } from "@/lib/public-content";
import type { PublicArticle } from "@/lib/cms-public";

export function ArticleIndex({ initialArticles }: { initialArticles?: PublicArticle[] }) {
  const allArticles = initialArticles && initialArticles.length > 0 ? initialArticles : articles;
  const categories = ["All", ...new Set(allArticles.map((article) => article.category))];
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => allArticles.filter((article) => {
      const matchesCategory = category === "All" || article.category === category;
      const matchesQuery = `${article.title} ${article.excerpt}`.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    }),
    [allArticles, category, query],
  );

  return (
    <div className="article-index">
      <div className="article-controls">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search articles</span>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search insights" value={query} />
        </label>
        <div aria-label="Filter articles by topic" className="filter-list" role="group">
          {categories.map((item) => (
            <button aria-pressed={category === item} className="filter-chip" key={item} onClick={() => setCategory(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className="article-grid">
          {visible.map((article, index) => (
            <Link className="article-card" href={`/blog/${article.slug}`} key={article.slug}>
              <span className="article-card-meta"><span>{article.category}</span><span>{article.readingTime}</span></span>
              <span className="article-number">0{index + 1}</span>
              <h2>{article.title}</h2>
              <p>{article.excerpt}</p>
              <span className="text-link">Read perspective <ArrowRight aria-hidden="true" size={15} /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-work article-empty"><div><Search aria-hidden="true" size={25} /><h2>No matching articles</h2><p>Try a different search or choose another topic.</p></div></div>
      )}
    </div>
  );
}
