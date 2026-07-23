"use client";

import {
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MarkdownDocument } from "./MarkdownDocument";
import { RunResultsBrowser } from "./RunResultsBrowser";
import { TestCaseBrowser } from "./TestCaseBrowser";

type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  category: string;
  isInternal: boolean;
  wordCount: number;
};

type AudienceFilter = "all" | "internal" | "customer";
type AppView = "documents" | "tests" | "results";

const CATEGORY_LABELS: Record<string, string> = {
  "Bank accounts": "银行账户",
  "Checking accounts": "个人支票",
  "Savings accounts": "个人储蓄",
  "Credit cards": "个人信用卡",
  "Business checking": "企业支票",
  "Business savings": "企业储蓄",
  "Business credit cards": "企业信用卡",
  "Everyone Pay": "Everyone Pay",
  "Buy now, pay later": "先买后付",
  Subscriptions: "订阅服务",
  Support: "客户支持",
  Other: "其他",
};

function SearchIcon() {
  return <span aria-hidden="true">⌕</span>;
}

function LibraryMark() {
  return (
    <span className="library-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedText(text: string, query: string): ReactNode {
  const normalized = query.trim();
  if (!normalized) return text;

  const expression = new RegExp(`(${escapeRegExp(normalized)})`, "ig");
  return text.split(expression).map((part, index) =>
    part.toLowerCase() === normalized.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
}

function documentSnippet(document: KnowledgeDocument, query: string) {
  const compact = document.content.replace(/\s+/g, " ").trim();
  if (!query.trim()) return compact.slice(0, 150);

  const position = compact.toLowerCase().indexOf(query.trim().toLowerCase());
  if (position < 0) return compact.slice(0, 150);
  const start = Math.max(0, position - 55);
  const end = Math.min(compact.length, position + query.length + 95);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${
    end < compact.length ? "…" : ""
  }`;
}

export function KnowledgeBrowser() {
  const [view, setView] = useState<AppView>("documents");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/documents.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<KnowledgeDocument[]>;
      })
      .then((loadedDocuments) => {
        setDocuments(loadedDocuments);
        setSelectedId(loadedDocuments[0]?.id ?? "");
      })
      .catch(() => {
        setLoadError("无法读取知识库，请先运行 npm run generate:documents。");
      })
      .finally(() => setLoading(false));
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((document) => {
      counts.set(document.category, (counts.get(document.category) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesCategory =
        category === "All" || document.category === category;
      const matchesAudience =
        audience === "all" ||
        (audience === "internal" && document.isInternal) ||
        (audience === "customer" && !document.isInternal);
      const matchesQuery =
        !normalizedQuery ||
        document.title.toLowerCase().includes(normalizedQuery) ||
        document.content.toLowerCase().includes(normalizedQuery) ||
        document.id.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesAudience && matchesQuery;
    });
  }, [audience, category, documents, query]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const selectedDocument =
    filteredDocuments.find((document) => document.id === selectedId) ??
    filteredDocuments[0];
  const selectedIndex = selectedDocument
    ? filteredDocuments.findIndex(
        (document) => document.id === selectedDocument.id,
      )
    : -1;

  const moveSelection = (direction: -1 | 1) => {
    if (!filteredDocuments.length) return;
    const nextIndex = Math.min(
      filteredDocuments.length - 1,
      Math.max(0, selectedIndex + direction),
    );
    setSelectedId(filteredDocuments[nextIndex].id);
  };

  const handleListKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
  };

  const copyDocument = async () => {
    if (!selectedDocument) return;
    await navigator.clipboard.writeText(
      `${selectedDocument.title}\n\n${selectedDocument.content}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("All");
    setAudience("all");
    searchRef.current?.focus();
  };

  const openRequiredDocument = (documentId: string) => {
    setView("documents");
    setQuery("");
    setCategory("All");
    setAudience("all");
    setSelectedId(documentId);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <LibraryMark />
          <div>
            <p>RHO / τ-BENCH</p>
            <h1>Knowledge Library</h1>
          </div>
        </div>
        <nav className="view-menu" aria-label="内容类型">
          <button
            className={view === "documents" ? "active" : ""}
            onClick={() => {
              setView("documents");
              setQuery("");
            }}
          >
            知识文档
          </button>
          <button
            className={view === "tests" ? "active" : ""}
            onClick={() => {
              setView("tests");
              setQuery("");
            }}
          >
            测试用例
          </button>
          <button
            className={view === "results" ? "active" : ""}
            onClick={() => {
              setView("results");
              setQuery("");
            }}
          >
            运行结果
          </button>
        </nav>
        <div className="search-wrap">
          <SearchIcon />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              view === "documents"
                ? "搜索标题、正文或文档 ID"
                : view === "tests"
                  ? "搜索场景、动作或测试 ID"
                  : "搜索对话、工具或任务 ID"
            }
            aria-label={
              view === "documents"
                ? "搜索知识库"
                : view === "tests"
                  ? "搜索测试用例"
                  : "搜索运行结果"
            }
          />
          {query ? (
            <button className="clear-search" onClick={() => setQuery("")}>
              清除
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        <div className="collection-meta">
          <span className="live-dot" />
          <span>
            {view === "documents"
              ? `${documents.length || "—"} 篇文档`
              : view === "tests"
                ? "97 个测试用例"
                : "5 个运行结果"}
          </span>
        </div>
      </header>

      {view === "documents" ? (
        <section className="workspace">
        <aside className="sidebar" aria-label="知识库筛选">
          <div className="side-heading">
            <span>COLLECTIONS</span>
            <span>{categoryCounts.length}</span>
          </div>
          <nav className="category-list">
            <button
              className={category === "All" ? "active" : ""}
              onClick={() => setCategory("All")}
            >
              <span className="category-glyph all">A</span>
              <span>全部文档</span>
              <b>{documents.length}</b>
            </button>
            {categoryCounts.map(([categoryName, count], index) => (
              <button
                key={categoryName}
                className={category === categoryName ? "active" : ""}
                onClick={() => setCategory(categoryName)}
              >
                <span className={`category-glyph hue-${index % 5}`}>
                  {(CATEGORY_LABELS[categoryName] ?? categoryName).slice(0, 1)}
                </span>
                <span>{CATEGORY_LABELS[categoryName] ?? categoryName}</span>
                <b>{count}</b>
              </button>
            ))}
          </nav>

          <div className="audience-filter">
            <span>DOCUMENT TYPE</span>
            <div>
              {(
                [
                  ["all", "全部"],
                  ["customer", "客户"],
                  ["internal", "内部"],
                ] as [AudienceFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={audience === value ? "active" : ""}
                  onClick={() => setAudience(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-foot">
            <div>
              <span>客户文档</span>
              <strong>{documents.filter((doc) => !doc.isInternal).length}</strong>
            </div>
            <div>
              <span>内部文档</span>
              <strong>{documents.filter((doc) => doc.isInternal).length}</strong>
            </div>
          </div>
        </aside>

        <section className="document-index">
          <div className="index-heading">
            <div>
              <span>DOCUMENT INDEX</span>
              <strong>{filteredDocuments.length} results</strong>
            </div>
            <p>↑↓ 浏览</p>
          </div>

          <div
            className="document-list"
            tabIndex={0}
            onKeyDown={handleListKeys}
            aria-label="文档列表"
          >
            {loading && <div className="state-message">正在整理知识库…</div>}
            {loadError && <div className="state-message error">{loadError}</div>}
            {!loading &&
              !loadError &&
              filteredDocuments.map((document, index) => (
                <button
                  key={document.id}
                  className={
                    selectedDocument?.id === document.id ? "selected" : ""
                  }
                  onClick={() => setSelectedId(document.id)}
                >
                  <div className="result-topline">
                    <span>{String(index + 1).padStart(3, "0")}</span>
                    <span
                      className={
                        document.isInternal ? "tag internal" : "tag customer"
                      }
                    >
                      {document.isInternal ? "INTERNAL" : "CUSTOMER"}
                    </span>
                  </div>
                  <h2>{highlightedText(document.title, query)}</h2>
                  <p>
                    {highlightedText(documentSnippet(document, query), query)}
                  </p>
                  <div className="result-footer">
                    <span>
                      {CATEGORY_LABELS[document.category] ?? document.category}
                    </span>
                    <span>{document.wordCount} words</span>
                  </div>
                </button>
              ))}

            {!loading && !loadError && !filteredDocuments.length && (
              <div className="empty-state">
                <span>∅</span>
                <h2>没有匹配的文档</h2>
                <p>试试更短的关键词，或清除当前分类筛选。</p>
                <button onClick={resetFilters}>重置搜索</button>
              </div>
            )}
          </div>
        </section>

        <article className="reader">
          {selectedDocument ? (
            <>
              <div className="reader-toolbar">
                <div className="breadcrumbs">
                  <span>KNOWLEDGE</span>
                  <i>/</i>
                  <span>
                    {CATEGORY_LABELS[selectedDocument.category] ??
                      selectedDocument.category}
                  </span>
                </div>
                <div className="reader-actions">
                  <button
                    onClick={() => moveSelection(-1)}
                    disabled={selectedIndex <= 0}
                    aria-label="上一篇文档"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => moveSelection(1)}
                    disabled={selectedIndex >= filteredDocuments.length - 1}
                    aria-label="下一篇文档"
                  >
                    →
                  </button>
                  <button className="copy-button" onClick={copyDocument}>
                    {copied ? "已复制" : "复制正文"}
                  </button>
                </div>
              </div>

              <div className="reader-scroll">
                <div className="document-hero">
                  <div className="eyebrow">
                    <span
                      className={
                        selectedDocument.isInternal
                          ? "tag internal"
                          : "tag customer"
                      }
                    >
                      {selectedDocument.isInternal ? "INTERNAL" : "CUSTOMER"}
                    </span>
                    <span>
                      {CATEGORY_LABELS[selectedDocument.category] ??
                        selectedDocument.category}
                    </span>
                  </div>
                  <h1>{selectedDocument.title}</h1>
                  <div className="document-id">
                    <span>ID</span>
                    <code>{selectedDocument.id}</code>
                    <span>·</span>
                    <span>{selectedDocument.wordCount} words</span>
                  </div>
                </div>
                <MarkdownDocument content={selectedDocument.content} />
                <footer className="document-end">
                  <span>END OF DOCUMENT</span>
                  <b>{String(selectedIndex + 1).padStart(3, "0")}</b>
                </footer>
              </div>
            </>
          ) : (
            <div className="reader-placeholder">选择一篇文档开始阅读</div>
          )}
        </article>
        </section>
      ) : view === "tests" ? (
        <TestCaseBrowser
          query={query}
          onOpenDocument={openRequiredDocument}
        />
      ) : (
        <RunResultsBrowser query={query} />
      )}
    </main>
  );
}
