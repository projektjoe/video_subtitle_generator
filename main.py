import os
from datetime import timedelta

import whisper
from moviepy.video.io.VideoFileClip import VideoFileClip

OVERWRITE_EXISTING = False  # Set to True to regenerate .srt files that already exist

dir = "/mnt/c/Users/youss/Downloads/Charlie Morgan - Imperium Academy™ VIP/"

model = whisper.load_model("medium")


def convert_mp4_to_mp3(input_file, output_file):
    video_clip = VideoFileClip(input_file)
    audio_clip = video_clip.audio
    audio_clip.write_audiofile(output_file)
    audio_clip.close()


def transcribe_audio(mp3_path, srt_path):
    print("Whisper model loaded.")
    transcribe = model.transcribe(audio=mp3_path)
    segments = transcribe['segments']

    with open(srt_path, 'w', encoding='utf-8') as srtFile:
        for segment in segments:
            startTime = str(0) + str(timedelta(seconds=int(segment['start']))) + ',000'
            endTime = str(0) + str(timedelta(seconds=int(segment['end']))) + ',000'
            text = segment['text']
            segmentId = segment['id'] + 1
            srtFile.write(f"{segmentId}\n{startTime} --> {endTime}\n{text.lstrip()}\n\n")

    return srt_path


if __name__ == "__main__":
    for file in os.listdir(dir):
        filename, file_extension = os.path.splitext(file)
        if file_extension == ".mp4":
            srt_path = os.path.join(dir, filename + ".srt")
            if os.path.exists(srt_path) and not OVERWRITE_EXISTING:
                continue
            file_path = os.path.join(dir, file)
            mp3_path = os.path.join(dir, f"{filename}.mp3")
            convert_mp4_to_mp3(file_path, mp3_path)
            transcribe_audio(mp3_path, srt_path)
            os.remove(mp3_path)
