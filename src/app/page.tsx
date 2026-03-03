"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PaperResult {
  id: string;
  title: string;
  authorsYear: string;
  vectorized: boolean;
}

interface SemanticSearchResult {
  paperId: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  url: string;
  score: number;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// ── Toast Container ────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>
            {toast.type === "success" ? (
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            )}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaperResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [vectorizingIds, setVectorizingIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticSearched, setSemanticSearched] = useState(false);
  const toastIdRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Toast helpers ──────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/papers/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data: PaperResult[] = await res.json();
        setResults(data);
        setShowDropdown(true);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // ── Click outside to close dropdown ────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Vectorize handler ──────────────────────────────────────────────────

  const handleVectorize = async (paperId: string) => {
    setVectorizingIds((prev) => new Set(prev).add(paperId));

    try {
      const res = await fetch(`/api/papers/${paperId}/vectorize`, {
        method: "POST",
      });

      if (res.status === 409) {
        // Already vectorized — update badge anyway
        setResults((prev) =>
          prev.map((p) => (p.id === paperId ? { ...p, vectorized: true } : p))
        );
        addToast("Paper is already vectorized.", "success");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error || `Vectorization failed (status ${res.status})`
        );
      }

      // Success — update the result in place
      setResults((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, vectorized: true } : p))
      );
      addToast("Paper vectorized successfully!", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Vectorization failed";
      addToast(message, "error");
    } finally {
      setVectorizingIds((prev) => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    }
  };

  // ── Semantic search handler ──────────────────────────────────────────

  const handleSemanticSearch = async () => {
    const trimmed = semanticQuery.trim();
    if (!trimmed) return;

    setIsSemanticSearching(true);
    setSemanticSearched(true);
    try {
      const res = await fetch(
        `/api/papers/semantic-search?q=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) throw new Error("Semantic search failed");
      const data: SemanticSearchResult[] = await res.json();
      setSemanticResults(data);
    } catch {
      setSemanticResults([]);
      addToast("Semantic search failed. Please try again.", "error");
    } finally {
      setIsSemanticSearching(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-24 pb-12">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <h1 className="text-4xl font-bold tracking-tight text-gray-900">
        Research7
      </h1>
      <p className="mt-3 text-lg text-gray-500">
        Discover, vectorize, and semantically search research papers.
      </p>

      {/* Search Input */}
      <div className="relative mt-10 w-full max-w-2xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            placeholder="Search for research papers..."
            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-12 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
              <svg
                className="h-5 w-5 animate-spin text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Results Dropdown */}
        {showDropdown && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {results.map((paper) => {
                const isVectorizing = vectorizingIds.has(paper.id);

                return (
                  <li
                    key={paper.id}
                    className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50"
                  >
                    {/* Paper info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 leading-snug">
                        {paper.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {paper.authorsYear}
                      </p>
                    </div>

                    {/* Status badge + Vectorize button */}
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Badge */}
                      {paper.vectorized ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset">
                          Vectorized
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset">
                          Not vectorized
                        </span>
                      )}

                      {/* Vectorize button */}
                      <button
                        onClick={() => handleVectorize(paper.id)}
                        disabled={paper.vectorized || isVectorizing}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          paper.vectorized
                            ? "cursor-not-allowed bg-gray-100 text-gray-400"
                            : isVectorizing
                              ? "cursor-wait bg-blue-600 text-white"
                              : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                        }`}
                      >
                        {isVectorizing && <Spinner />}
                        {isVectorizing ? "Vectorizing..." : "Vectorize"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Empty state when search returns no results */}
        {showDropdown && results.length === 0 && !isSearching && query.trim() && (
          <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg">
            <p className="text-sm text-gray-500">
              No papers found for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}
      </div>
      {/* ── Semantic Search Section ─────────────────────────────────────── */}
      <div className="mt-16 w-full max-w-2xl">
        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-sm text-gray-400">or</span>
          </div>
        </div>

        {/* Header */}
        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-gray-900">
          Semantic Search
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Search your vectorized papers by meaning using natural language.
        </p>

        {/* Semantic search input + button */}
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSemanticSearch();
              }}
              placeholder="e.g., transformer models for protein folding"
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-4 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={handleSemanticSearch}
            disabled={isSemanticSearching || !semanticQuery.trim()}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors ${
              isSemanticSearching || !semanticQuery.trim()
                ? "cursor-not-allowed bg-blue-400"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            }`}
          >
            {isSemanticSearching && <Spinner />}
            Search
          </button>
        </div>

        {/* Semantic search results */}
        <div className="mt-6">
          {/* Loading state */}
          {isSemanticSearching && (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-6 w-6 animate-spin text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="ml-3 text-sm text-gray-500">
                Searching vectorized papers...
              </span>
            </div>
          )}

          {/* Empty state — no results after search */}
          {!isSemanticSearching &&
            semanticSearched &&
            semanticResults.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
                <p className="mt-3 text-sm text-gray-500">
                  No papers vectorized yet. Use the search above to find and
                  vectorize papers.
                </p>
              </div>
            )}

          {/* Results list */}
          {!isSemanticSearching && semanticResults.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
              {semanticResults.map((paper) => (
                <li key={paper.paperId} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Similarity score */}
                    <div className="flex shrink-0 flex-col items-center">
                      <span className="text-lg font-bold text-blue-600">
                        {Math.round(paper.score * 100)}%
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                        match
                      </span>
                    </div>

                    {/* Paper info */}
                    <div className="min-w-0 flex-1">
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline leading-snug"
                      >
                        {paper.title}
                      </a>
                      <p className="mt-1 text-xs text-gray-500">
                        {paper.authors}
                        {paper.year ? ` · ${paper.year}` : ""}
                      </p>
                      {paper.abstract && (
                        <p className="mt-2 text-xs leading-relaxed text-gray-600">
                          {paper.abstract.length > 200
                            ? paper.abstract.slice(0, 200) + "..."
                            : paper.abstract}
                        </p>
                      )}
                    </div>

                    {/* External link icon */}
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-gray-300 hover:text-blue-500 transition-colors"
                      title="Open on Semantic Scholar"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
