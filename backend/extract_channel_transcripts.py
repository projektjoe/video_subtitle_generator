#!/usr/bin/env python3
"""
Extract all video transcripts from a YouTube channel for free.

Uses yt-dlp to discover videos and youtube-transcript-api to pull
captions — no YouTube Data API key or paid service required.

Usage:
    python extract_channel_transcripts.py CHANNEL_URL [-o OUTPUT_DIR] [-l LANG]

Examples:
    python extract_channel_transcripts.py https://www.youtube.com/@3Blue1Brown
    python extract_channel_transcripts.py https://www.youtube.com/c/sentdex -o sentdex_transcripts -l en
    python extract_channel_transcripts.py "https://www.youtube.com/channel/UCxxxxxx" --lang en es
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

ytt_api = YouTubeTranscriptApi()


def get_channel_videos(channel_url: str) -> list[tuple[str, str]]:
    """Return a list of (video_id, title) for every public video on the channel."""
    url = channel_url.rstrip("/")
    if not url.endswith("/videos"):
        url += "/videos"
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--no-warnings",
        "--print", "%(id)s\t%(title)s",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        cmd[-1] = channel_url
        result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"yt-dlp error:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    videos = []
    for line in result.stdout.strip().splitlines():
        if "\t" in line:
            vid_id, title = line.split("\t", 1)
            videos.append((vid_id, title))
    return videos


def sanitize_filename(name: str, max_len: int = 120) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    name = re.sub(r"_+", "_", name).strip(" _.")
    return name[:max_len]


def fetch_transcript(video_id: str, languages: list[str]):
    """Fetch transcript for a video. Returns a FetchedTranscript or None."""
    try:
        return ytt_api.fetch(video_id, languages=languages)
    except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable):
        return None
    except Exception as exc:
        print(f"  Unexpected error for {video_id}: {exc}", file=sys.stderr)
        return None


def format_as_text(transcript) -> str:
    return "\n".join(snippet.text for snippet in transcript)


def format_as_srt(transcript) -> str:
    def _ts(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int(round((seconds - int(seconds)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    parts = []
    for i, snippet in enumerate(transcript, start=1):
        end = snippet.start + snippet.duration
        parts.append(f"{i}\n{_ts(snippet.start)} --> {_ts(end)}\n{snippet.text}\n")
    return "\n".join(parts)


def save_manifest(output_dir: str, manifest: list[dict]) -> None:
    path = os.path.join(output_dir, "manifest.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extract all transcripts from a YouTube channel (free, no API key)."
    )
    ap.add_argument("channel_url", help="YouTube channel URL")
    ap.add_argument(
        "-o", "--output-dir", default="transcripts",
        help="Directory to save transcripts (default: transcripts/)",
    )
    ap.add_argument(
        "-l", "--lang", nargs="+", default=["en"],
        help="Preferred transcript language(s) in priority order (default: en)",
    )
    ap.add_argument(
        "--format", choices=["txt", "srt", "json"], default="txt",
        help="Output format (default: txt)",
    )
    ap.add_argument(
        "--delay", type=float, default=0.5,
        help="Seconds to wait between transcript requests (default: 0.5)",
    )
    ap.add_argument(
        "--skip-existing", action="store_true",
        help="Skip videos whose transcript file already exists",
    )
    args = ap.parse_args()

    print(f"Fetching video list from {args.channel_url} ...")
    videos = get_channel_videos(args.channel_url)
    if not videos:
        print("No videos found. Check the channel URL and that yt-dlp is installed.")
        sys.exit(1)
    print(f"Found {len(videos)} video(s).\n")

    os.makedirs(args.output_dir, exist_ok=True)

    formatter = {
        "txt": format_as_text,
        "srt": format_as_srt,
        "json": lambda t: json.dumps(t.to_raw_data(), indent=2, ensure_ascii=False),
    }[args.format]

    manifest: list[dict] = []
    success = 0
    skipped = 0
    failed = 0

    for idx, (vid_id, title) in enumerate(videos, start=1):
        safe_title = sanitize_filename(title)
        filename = f"{safe_title}__{vid_id}.{args.format}"
        filepath = os.path.join(args.output_dir, filename)

        if args.skip_existing and os.path.exists(filepath):
            print(f"[{idx}/{len(videos)}] SKIP (exists) {title}")
            skipped += 1
            manifest.append({"id": vid_id, "title": title, "file": filename, "status": "skipped"})
            continue

        print(f"[{idx}/{len(videos)}] {title} ({vid_id}) ... ", end="", flush=True)
        transcript = fetch_transcript(vid_id, args.lang)

        if transcript is None:
            print("NO TRANSCRIPT")
            failed += 1
            manifest.append({"id": vid_id, "title": title, "file": None, "status": "no_transcript"})
        else:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(formatter(transcript))
            print(f"OK ({len(transcript)} segments)")
            success += 1
            manifest.append({"id": vid_id, "title": title, "file": filename, "status": "ok"})

        if idx < len(videos):
            time.sleep(args.delay)

    save_manifest(args.output_dir, manifest)
    print(f"\nDone: {success} saved, {failed} unavailable, {skipped} skipped.")
    print(f"Transcripts saved to: {os.path.abspath(args.output_dir)}/")
    print(f"Manifest: {os.path.abspath(args.output_dir)}/manifest.json")


if __name__ == "__main__":
    main()
