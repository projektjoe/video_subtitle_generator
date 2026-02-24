# Video Subtitle Generator

Automatically generates `.srt` subtitle files for `.mp4` videos using [OpenAI Whisper](https://github.com/openai/whisper).

## Requirements

- **Python 3.8+** (Python 3.6 is not supported — Whisper requires 3.8 or newer)
- [ffmpeg](https://ffmpeg.org/) must be installed and on your `PATH`

```bash
# Ubuntu / Debian
sudo apt install ffmpeg
```

## Setup

Create a virtual environment using the **system Python** (not a Python 3.6 conda env):

```bash
cd /home/joe/projects/video_subtitle_generator

# Use system python3 (3.8+) explicitly
/usr/bin/python3 -m venv venv
source venv/bin/activate

pip install git+https://github.com/openai/whisper.git
pip install moviepy
```

> **Note:** If your shell already has a conda environment active (e.g. `ml4t` with Python 3.6), make sure to activate the project venv *after* — or open a fresh terminal — so the venv's Python 3.12 is used instead.

## Usage

1. Edit the `dir` variable in `main.py` to point to the folder containing your `.mp4` files.
2. Run the script:

```bash
source venv/bin/activate
python main.py
```

The script will:
- Convert each `.mp4` to a temporary `.mp3`
- Transcribe the audio with Whisper (`base` model)
- Write a `.srt` subtitle file alongside each video
- Delete the temporary `.mp3`

Already-subtitled files (where a `.srt` already exists) are skipped automatically.
