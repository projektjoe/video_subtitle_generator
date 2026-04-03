import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="TranscriptRAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

KB_DIR = os.environ.get("KB_DIR", "/data/knowledge_bases")
os.makedirs(KB_DIR, exist_ok=True)

SUPPORTED_EXTENSIONS = {".txt", ".srt", ".md", ".text", ".csv"}

jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_valid_kb_name(name: str) -> bool:
    return bool(name) and "/" not in name and "\\" not in name and ".." not in name and not name.startswith(".")


def listable_files(kb_path: str) -> list[str]:
    """Return sorted list of indexable files inside a knowledge-base folder."""
    if not os.path.isdir(kb_path):
        return []
    return sorted(
        f
        for f in os.listdir(kb_path)
        if os.path.isfile(os.path.join(kb_path, f))
        and not f.startswith(".")
        and f != "manifest.json"
    )


def chunk_text(text: str, chunk_size: int = 200, overlap: int = 50) -> list[str]:
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size:
        return [text.strip()]
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Knowledge-base CRUD
# ---------------------------------------------------------------------------

@app.get("/api/knowledge-bases")
def list_knowledge_bases():
    kbs = []
    for name in sorted(os.listdir(KB_DIR)):
        kb_path = os.path.join(KB_DIR, name)
        if os.path.isdir(kb_path):
            files = listable_files(kb_path)
            kbs.append({"name": name, "file_count": len(files)})
    return {"knowledge_bases": kbs}


@app.get("/api/knowledge-bases/{kb_name}/files")
def list_kb_files(kb_name: str):
    kb_path = os.path.join(KB_DIR, kb_name)
    if not os.path.isdir(kb_path):
        raise HTTPException(404, "Knowledge base not found")
    return {"files": listable_files(kb_path)}


@app.delete("/api/knowledge-bases/{kb_name}")
def delete_kb(kb_name: str):
    kb_path = os.path.join(KB_DIR, kb_name)
    if not os.path.isdir(kb_path):
        raise HTTPException(404, "Knowledge base not found")
    shutil.rmtree(kb_path)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    knowledge_bases: list[str]
    files: Optional[dict[str, list[str]]] = None
    top_k: int = 5


@app.post("/api/search")
def search(req: SearchRequest):
    all_chunks: list[str] = []
    all_meta: list[dict] = []

    for kb_name in req.knowledge_bases:
        kb_path = os.path.join(KB_DIR, kb_name)
        if not os.path.isdir(kb_path):
            continue

        allowed: set[str] | None = None
        if req.files and kb_name in req.files:
            allowed = set(req.files[kb_name])

        for fname in listable_files(kb_path):
            if allowed is not None and fname not in allowed:
                continue

            fpath = os.path.join(kb_path, fname)
            try:
                text = Path(fpath).read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            if not text.strip():
                continue

            file_chunks = chunk_text(text)
            for i, c in enumerate(file_chunks):
                all_chunks.append(c)
                all_meta.append(
                    {
                        "knowledge_base": kb_name,
                        "file": fname,
                        "chunk_index": i,
                        "total_chunks": len(file_chunks),
                    }
                )

    if not all_chunks:
        return {"results": []}

    vectorizer = TfidfVectorizer(stop_words="english", max_features=10_000)
    tfidf = vectorizer.fit_transform(all_chunks + [req.query])

    sims = cosine_similarity(tfidf[-1:], tfidf[:-1]).flatten()
    top_idx = sims.argsort()[-req.top_k :][::-1]

    results = []
    for idx in top_idx:
        if sims[idx] > 0:
            results.append(
                {
                    "score": round(float(sims[idx]), 4),
                    "text": all_chunks[idx],
                    **all_meta[idx],
                }
            )

    return {"results": results}


# ---------------------------------------------------------------------------
# Create KB from YouTube channel (long-running)
# ---------------------------------------------------------------------------

class YouTubeRequest(BaseModel):
    channel_url: str
    kb_name: str
    languages: list[str] = ["en"]


def _run_youtube_extraction(
    job_id: str, channel_url: str, kb_name: str, languages: list[str]
):
    jobs[job_id]["status"] = "running"
    kb_path = os.path.join(KB_DIR, kb_name)
    os.makedirs(kb_path, exist_ok=True)

    try:
        cmd = [
            sys.executable,
            "/app/extract_channel_transcripts.py",
            channel_url,
            "-o",
            kb_path,
            "-l",
            *languages,
            "--skip-existing",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=7200
        )
        if result.returncode == 0:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["output"] = result.stdout[-2000:]
        else:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = (result.stderr or result.stdout)[-2000:]
    except subprocess.TimeoutExpired:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = "Extraction timed out after 2 hours"
    except Exception as exc:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(exc)


@app.post("/api/knowledge-bases/from-youtube")
def create_from_youtube(req: YouTubeRequest, bg: BackgroundTasks):
    if not is_valid_kb_name(req.kb_name):
        raise HTTPException(400, "Invalid knowledge-base name")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "kb_name": req.kb_name}
    bg.add_task(
        _run_youtube_extraction,
        job_id,
        req.channel_url,
        req.kb_name,
        req.languages,
    )
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return jobs[job_id]


# ---------------------------------------------------------------------------
# Create KB from file upload
# ---------------------------------------------------------------------------

@app.post("/api/knowledge-bases/from-upload")
async def create_from_upload(
    kb_name: str = Form(...),
    files: list[UploadFile] = File(...),
):
    if not is_valid_kb_name(kb_name):
        raise HTTPException(400, "Invalid knowledge-base name")

    kb_path = os.path.join(KB_DIR, kb_name)
    os.makedirs(kb_path, exist_ok=True)

    saved: list[str] = []
    for upload in files:
        safe_name = re.sub(r"[/\\]", "_", upload.filename or "file.txt")
        content = await upload.read()
        fpath = os.path.join(kb_path, safe_name)
        with open(fpath, "wb") as f:
            f.write(content)
        saved.append(safe_name)

    return {"status": "ok", "files_saved": saved}


# ---------------------------------------------------------------------------
# Create KB by importing a host-mounted path
# ---------------------------------------------------------------------------

class ImportPathRequest(BaseModel):
    source_path: str
    kb_name: str


@app.post("/api/knowledge-bases/from-path")
def create_from_path(req: ImportPathRequest):
    if not is_valid_kb_name(req.kb_name):
        raise HTTPException(400, "Invalid knowledge-base name")
    if not os.path.isdir(req.source_path):
        raise HTTPException(400, f"Directory not found: {req.source_path}")

    kb_path = os.path.join(KB_DIR, req.kb_name)
    os.makedirs(kb_path, exist_ok=True)

    copied: list[str] = []
    for fname in os.listdir(req.source_path):
        src = os.path.join(req.source_path, fname)
        if not os.path.isfile(src) or fname.startswith("."):
            continue
        shutil.copy2(src, os.path.join(kb_path, fname))
        copied.append(fname)

    return {"status": "ok", "files_copied": copied}
