"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KnowledgeBase {
  name: string;
  file_count: number;
}

interface SearchResult {
  score: number;
  text: string;
  knowledge_base: string;
  file: string;
  chunk_index: number;
  total_chunks: number;
}

interface JobInfo {
  status: string;
  kb_name: string;
  output?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseFilename(filename: string) {
  const m = filename.match(/^(.+?)__([a-zA-Z0-9_-]{11})\.txt$/);
  if (m) return { title: m[1].replace(/_/g, " "), videoId: m[2] };
  return { title: filename.replace(/\.[^.]+$/, ""), videoId: null };
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const Icon = {
  Search: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Copy: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Folder: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  File: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Sidebar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
  YouTube: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Import: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  ExternalLink: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Home() {
  /* ---- Knowledge-base state ---- */
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(new Set());
  const [kbFiles, setKbFiles] = useState<Record<string, string[]>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Set<string>>>({});
  const [expandedKbs, setExpandedKbs] = useState<Set<string>>(new Set());

  /* ---- Search state ---- */
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  /* ---- Modal state ---- */
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"youtube" | "upload" | "path">("youtube");

  /* ---- YouTube form ---- */
  const [ytUrl, setYtUrl] = useState("");
  const [ytName, setYtName] = useState("");
  const [ytLangs, setYtLangs] = useState("en");
  const [ytLoading, setYtLoading] = useState(false);

  /* ---- Upload form ---- */
  const [uploadName, setUploadName] = useState("");
  const [uploadFileList, setUploadFileList] = useState<FileList | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  /* ---- Import path form ---- */
  const [importPath, setImportPath] = useState("");
  const [importName, setImportName] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  /* ---- Jobs & UI ---- */
  const [jobs, setJobs] = useState<Record<string, JobInfo>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>();

  /* ================================================================ */
  /*  API helpers                                                      */
  /* ================================================================ */

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    clearTimeout(toastTimeout.current);
    setToast({ msg, type });
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchKbs = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-bases");
      const data = await res.json();
      setKbs(data.knowledge_bases ?? []);
    } catch {
      /* backend may not be up yet */
    }
  }, []);

  const fetchFiles = useCallback(async (kbName: string) => {
    try {
      const res = await fetch(`/api/knowledge-bases/${encodeURIComponent(kbName)}/files`);
      const data = await res.json();
      const files: string[] = data.files ?? [];
      setKbFiles((prev) => ({ ...prev, [kbName]: files }));
      setSelectedFiles((prev) => ({ ...prev, [kbName]: new Set(files) }));
    } catch {
      showToast("Failed to load files", "err");
    }
  }, [showToast]);

  /* ---- Search ---- */
  const doSearch = useCallback(async () => {
    if (!query.trim() || selectedKbs.size === 0) {
      if (selectedKbs.size === 0) showToast("Select at least one knowledge base", "err");
      return;
    }
    setSearching(true);
    setSearched(true);

    const filesFilter: Record<string, string[]> = {};
    for (const kb of selectedKbs) {
      if (kbFiles[kb] && selectedFiles[kb]) {
        const sel = Array.from(selectedFiles[kb]);
        if (sel.length > 0 && sel.length < kbFiles[kb].length) {
          filesFilter[kb] = sel;
        } else if (sel.length === 0) {
          filesFilter[kb] = [];
        }
      }
    }

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          knowledge_bases: Array.from(selectedKbs),
          files: Object.keys(filesFilter).length > 0 ? filesFilter : undefined,
          top_k: topK,
        }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      showToast("Search failed — is the backend running?", "err");
    } finally {
      setSearching(false);
    }
  }, [query, selectedKbs, kbFiles, selectedFiles, topK, showToast]);

  /* ================================================================ */
  /*  Handlers                                                         */
  /* ================================================================ */

  const toggleKb = (name: string) => {
    setSelectedKbs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleExpand = (name: string) => {
    setExpandedKbs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        if (!kbFiles[name]) fetchFiles(name);
      }
      return next;
    });
  };

  const toggleFile = (kb: string, file: string) => {
    setSelectedFiles((prev) => {
      const s = new Set(prev[kb] ?? []);
      if (s.has(file)) s.delete(file);
      else s.add(file);
      return { ...prev, [kb]: s };
    });
  };

  const selectAllFiles = (kb: string) =>
    setSelectedFiles((prev) => ({ ...prev, [kb]: new Set(kbFiles[kb] ?? []) }));

  const deselectAllFiles = (kb: string) =>
    setSelectedFiles((prev) => ({ ...prev, [kb]: new Set<string>() }));

  const copyText = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete knowledge base "${name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/knowledge-bases/${encodeURIComponent(name)}`, { method: "DELETE" });
      setSelectedKbs((prev) => { const n = new Set(prev); n.delete(name); return n; });
      setExpandedKbs((prev) => { const n = new Set(prev); n.delete(name); return n; });
      fetchKbs();
      showToast(`Deleted "${name}"`);
    } catch {
      showToast("Delete failed", "err");
    }
  };

  /* ---- YouTube ---- */
  const handleYouTube = async () => {
    if (!ytUrl.trim() || !ytName.trim()) return;
    setYtLoading(true);
    try {
      const res = await fetch("/api/knowledge-bases/from-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_url: ytUrl.trim(),
          kb_name: ytName.trim().replace(/\s+/g, "_"),
          languages: ytLangs.split(",").map((l) => l.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.detail ?? "Failed", "err"); return; }
      setJobs((prev) => ({ ...prev, [data.job_id]: { status: "queued", kb_name: ytName.trim() } }));
      showToast(`Started extracting "${ytName}"`);
      setShowModal(false);
      setYtUrl(""); setYtName(""); setYtLangs("en");
    } catch {
      showToast("Failed to start extraction", "err");
    } finally {
      setYtLoading(false);
    }
  };

  /* ---- Upload ---- */
  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFileList?.length) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("kb_name", uploadName.trim().replace(/\s+/g, "_"));
      Array.from(uploadFileList).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/knowledge-bases/from-upload", { method: "POST", body: fd });
      if (res.ok) {
        showToast(`Created "${uploadName}"`);
        setShowModal(false);
        setUploadName(""); setUploadFileList(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchKbs();
      } else {
        const data = await res.json();
        showToast(data.detail ?? "Upload failed", "err");
      }
    } catch {
      showToast("Upload failed", "err");
    } finally {
      setUploadLoading(false);
    }
  };

  /* ---- Import path ---- */
  const handleImport = async () => {
    if (!importPath.trim() || !importName.trim()) return;
    setImportLoading(true);
    try {
      const res = await fetch("/api/knowledge-bases/from-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_path: importPath.trim(),
          kb_name: importName.trim().replace(/\s+/g, "_"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Imported "${importName}"`);
        setShowModal(false);
        setImportPath(""); setImportName("");
        fetchKbs();
      } else {
        showToast(data.detail ?? "Import failed", "err");
      }
    } catch {
      showToast("Import failed", "err");
    } finally {
      setImportLoading(false);
    }
  };

  /* ================================================================ */
  /*  Effects                                                          */
  /* ================================================================ */

  useEffect(() => { fetchKbs(); }, [fetchKbs]);

  /* Poll active extraction jobs */
  useEffect(() => {
    const activeIds = Object.entries(jobs)
      .filter(([, j]) => j.status === "queued" || j.status === "running")
      .map(([id]) => id);
    if (activeIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const id of activeIds) {
        try {
          const res = await fetch(`/api/jobs/${id}`);
          const data: JobInfo = await res.json();
          setJobs((prev) => ({ ...prev, [id]: data }));
          if (data.status === "completed") {
            showToast(`Finished extracting "${data.kb_name}"`);
            fetchKbs();
          } else if (data.status === "failed") {
            showToast(`Extraction failed for "${data.kb_name}"`, "err");
          }
        } catch { /* retry next interval */ }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs, fetchKbs, showToast]);

  /* ================================================================ */
  /*  Active-job count                                                 */
  /* ================================================================ */

  const activeJobCount = Object.values(jobs).filter(
    (j) => j.status === "queued" || j.status === "running"
  ).length;

  /* ================================================================ */
  /*  JSX                                                              */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ==================== HEADER ==================== */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="text-gray-500 hover:text-gray-700 transition lg:hidden"
          >
            <Icon.Sidebar />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-gray-900">
            <span className="text-indigo-600">Transcript</span>RAG
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {activeJobCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              {activeJobCount} job{activeJobCount > 1 ? "s" : ""} running
            </span>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
          >
            + New Knowledge Base
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ==================== SIDEBAR ==================== */}
        <aside
          className={`${
            sidebarOpen ? "w-72 min-w-[18rem]" : "w-0 min-w-0"
          } border-r border-gray-200 bg-white overflow-y-auto overflow-x-hidden transition-all duration-200 scrollbar-thin shrink-0`}
        >
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Knowledge Bases
            </h2>

            {kbs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No knowledge bases yet.
              </p>
            ) : (
              <div className="space-y-1">
                {kbs.map((kb) => {
                  const expanded = expandedKbs.has(kb.name);
                  const checked = selectedKbs.has(kb.name);
                  const files = kbFiles[kb.name];
                  const selFiles = selectedFiles[kb.name];

                  return (
                    <div key={kb.name}>
                      {/* KB row */}
                      <div className="flex items-center gap-1.5 group">
                        <button
                          onClick={() => toggleExpand(kb.name)}
                          className="text-gray-400 hover:text-gray-600 transition shrink-0"
                        >
                          {expanded ? <Icon.ChevronDown /> : <Icon.ChevronRight />}
                        </button>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKb(kb.name)}
                          className="accent-indigo-600 shrink-0"
                        />
                        <button
                          onClick={() => toggleExpand(kb.name)}
                          className="flex items-center gap-1.5 text-sm text-gray-700 font-medium truncate text-left flex-1 hover:text-indigo-600 transition"
                          title={kb.name}
                        >
                          <span className="text-gray-400"><Icon.Folder /></span>
                          <span className="truncate">{kb.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">({kb.file_count})</span>
                        </button>
                        <button
                          onClick={() => handleDelete(kb.name)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition shrink-0"
                          title="Delete"
                        >
                          <Icon.Trash />
                        </button>
                      </div>

                      {/* Expanded files */}
                      {expanded && files && (
                        <div className="ml-7 mt-1 mb-2">
                          <div className="flex gap-2 mb-1">
                            <button
                              onClick={() => selectAllFiles(kb.name)}
                              className="text-[11px] text-indigo-600 hover:underline"
                            >
                              All
                            </button>
                            <button
                              onClick={() => deselectAllFiles(kb.name)}
                              className="text-[11px] text-gray-400 hover:underline"
                            >
                              None
                            </button>
                          </div>
                          <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                            {files.map((f) => {
                              const { title, videoId } = parseFilename(f);
                              return (
                                <label
                                  key={f}
                                  className="flex items-start gap-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer leading-tight py-0.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selFiles?.has(f) ?? false}
                                    onChange={() => toggleFile(kb.name, f)}
                                    className="accent-indigo-600 mt-0.5 shrink-0"
                                  />
                                  <span className="text-gray-300 mt-px shrink-0"><Icon.File /></span>
                                  <span className="break-words" title={f}>
                                    {title}
                                    {videoId && (
                                      <a
                                        href={`https://youtube.com/watch?v=${videoId}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-0.5 ml-1 text-indigo-500 hover:text-indigo-700"
                                      >
                                        <Icon.ExternalLink />
                                      </a>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {expanded && !files && (
                        <div className="ml-9 mt-1 mb-2 flex items-center gap-1 text-xs text-gray-400">
                          <Icon.Spinner /> Loading...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ==================== MAIN CONTENT ==================== */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Search bar */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icon.Search />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="Search across your transcripts..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm"
                />
              </div>
              <button
                onClick={doSearch}
                disabled={searching}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-5 py-2.5 rounded-xl transition text-sm shadow-sm flex items-center gap-2"
              >
                {searching ? <Icon.Spinner /> : <Icon.Search />}
                Search
              </button>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-4 mb-6 text-sm">
              <label className="flex items-center gap-2 text-gray-500">
                Results:
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {[1, 3, 5, 10, 15, 20, 25, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              {selectedKbs.size > 0 && (
                <span className="text-gray-400">
                  Searching {selectedKbs.size} knowledge base{selectedKbs.size > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Results area */}
            {!searched ? (
              <div className="text-center py-20">
                <div className="text-gray-300 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">
                  {kbs.length === 0
                    ? "Add a knowledge base to get started."
                    : "Select knowledge bases, then search for relevant transcript passages."}
                </p>
              </div>
            ) : searching ? (
              <div className="text-center py-20">
                <div className="text-indigo-400 mb-3"><Icon.Spinner /></div>
                <p className="text-gray-400 text-sm">Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 text-sm">No matching results. Try different terms or broaden your selection.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((r, i) => {
                  const { title, videoId } = parseFilename(r.file);
                  const copied = copiedIdx === i;
                  return (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-indigo-600">{r.knowledge_base}</span>
                          <span className="text-gray-300 mx-1.5">/</span>
                          <span className="text-xs text-gray-500" title={r.file}>{title}</span>
                          {videoId && (
                            <a
                              href={`https://youtube.com/watch?v=${videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 ml-1.5 text-indigo-400 hover:text-indigo-600 transition"
                            >
                              <Icon.ExternalLink />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-gray-400">
                            chunk {r.chunk_index + 1}/{r.total_chunks}
                          </span>
                          <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                            {(r.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Text */}
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3 max-h-60 overflow-y-auto scrollbar-thin">
                        {r.text}
                      </p>

                      {/* Copy button */}
                      <button
                        onClick={() => copyText(r.text, i)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition ${
                          copied
                            ? "text-emerald-600"
                            : "text-gray-400 hover:text-indigo-600"
                        }`}
                      >
                        {copied ? <Icon.Check /> : <Icon.Copy />}
                        {copied ? "Copied!" : "Copy to clipboard"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ==================== MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">New Knowledge Base</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <Icon.X />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mt-4 px-6">
              {(
                [
                  { key: "youtube", label: "YouTube Channel", icon: <Icon.YouTube /> },
                  { key: "upload", label: "Upload Files", icon: <Icon.Upload /> },
                  { key: "path", label: "Import Path", icon: <Icon.Import /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setModalTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                    modalTab === tab.key
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6 space-y-4">
              {/* ---------- YouTube ---------- */}
              {modalTab === "youtube" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel URL</label>
                    <input
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      placeholder="https://www.youtube.com/@ChannelName"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base Name</label>
                    <input
                      value={ytName}
                      onChange={(e) => setYtName(e.target.value)}
                      placeholder="my-channel-transcripts"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Languages (comma-separated)</label>
                    <input
                      value={ytLangs}
                      onChange={(e) => setYtLangs(e.target.value)}
                      placeholder="en"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    This uses yt-dlp and youtube-transcript-api to fetch all available transcripts. It may take several minutes for large channels.
                  </p>
                  <button
                    onClick={handleYouTube}
                    disabled={ytLoading || !ytUrl.trim() || !ytName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    {ytLoading && <Icon.Spinner />}
                    {ytLoading ? "Starting..." : "Start Extraction"}
                  </button>
                </>
              )}

              {/* ---------- Upload ---------- */}
              {modalTab === "upload" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base Name</label>
                    <input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="my-knowledge-base"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Files (.txt, .srt, .md)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.srt,.md,.text,.csv"
                      onChange={(e) => setUploadFileList(e.target.files)}
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-medium file:text-sm file:cursor-pointer hover:file:bg-indigo-100 transition"
                    />
                  </div>
                  {uploadFileList && uploadFileList.length > 0 && (
                    <p className="text-xs text-gray-400">{uploadFileList.length} file(s) selected</p>
                  )}
                  <button
                    onClick={handleUpload}
                    disabled={uploadLoading || !uploadName.trim() || !uploadFileList?.length}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    {uploadLoading && <Icon.Spinner />}
                    {uploadLoading ? "Uploading..." : "Upload & Create"}
                  </button>
                </>
              )}

              {/* ---------- Import path ---------- */}
              {modalTab === "path" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Folder Path (on server)</label>
                    <input
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                      placeholder="/data/imports/my-transcripts"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base Name</label>
                    <input
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder="imported-kb"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Copies all text files from the specified directory into a new knowledge base. The path must be accessible from within the Docker container (mount it in docker-compose.yml).
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={importLoading || !importPath.trim() || !importName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    {importLoading && <Icon.Spinner />}
                    {importLoading ? "Importing..." : "Import Folder"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOAST ==================== */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
