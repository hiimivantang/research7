"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PaperResult {
  id: string;
  title: string;
  authorsYear: string;
  vectorized: boolean;
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
    </main>
  );
}
