import os
import re
import sys

COURSE_DIR = "/mnt/c/Users/youss/Downloads/ML4T Lectures"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "prompts")

SRT_TIMEMARK_RE = re.compile(
    r"^\d+\s*\n"                              # sequence number line
    r"\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*"      # start timecode
    r"\d{2}:\d{2}:\d{2},\d{3}\s*\n",         # end timecode
    re.MULTILINE,
)


def strip_timemarks(srt_text: str) -> str:
    """Return plain text from an SRT file with sequence numbers and timecodes removed."""
    cleaned = SRT_TIMEMARK_RE.sub("", srt_text)
    # Collapse multiple blank lines into a single blank line
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def collect_module_subtitles(module_path: str) -> str:
    """Concatenate subtitle text from all .srt files in a module folder."""
    parts = []
    for file in sorted(os.listdir(module_path)):
        if file.lower().endswith(".srt"):
            srt_file = os.path.join(module_path, file)
            with open(srt_file, "r", encoding="utf-8", errors="replace") as f:
                raw = f.read()
            text = strip_timemarks(raw)
            if text:
                # Use the filename (without extension) as a section header
                parts.append(f"=== {os.path.splitext(file)[0]} ===\n\n{text}")
    return "\n\n".join(parts)


def main(course_dir: str = COURSE_DIR, output_dir: str = OUTPUT_DIR) -> None:
    if not os.path.isdir(course_dir):
        print(f"Error: course directory not found: {course_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    modules_processed = 0
    for entry in sorted(os.listdir(course_dir)):
        module_path = os.path.join(course_dir, entry)
        if not os.path.isdir(module_path):
            continue

        srt_files = [f for f in os.listdir(module_path) if f.lower().endswith(".srt")]
        if not srt_files:
            continue

        content = collect_module_subtitles(module_path)
        if not content:
            continue

        # Mirror the module folder name as a .txt file inside output_dir
        out_subdir = os.path.join(output_dir, entry)
        os.makedirs(out_subdir, exist_ok=True)
        out_file = os.path.join(out_subdir, "subtitles.txt")

        with open(out_file, "w", encoding="utf-8") as f:
            f.write(content + "\n")

        print(f"[{entry}] {len(srt_files)} .srt file(s) -> {out_file}")
        modules_processed += 1

    if modules_processed == 0:
        print("No modules with .srt files found.")
    else:
        print(f"\nDone. {modules_processed} module(s) written to: {output_dir}")


if __name__ == "__main__":
    course_dir = sys.argv[1] if len(sys.argv) > 1 else COURSE_DIR
    main(course_dir)
