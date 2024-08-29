import whisper
from moviepy.video.io.VideoFileClip import VideoFileClip

model = whisper.load_model("base")

dir = "/mnt/c/Users/youss/Downloads"
def convert_mp4_to_mp3(input_file, output_file):
    video_clip = VideoFileClip(input_file)
    audio_clip = video_clip.audio
    audio_clip.write_audiofile(output_file)
    audio_clip.close()
from datetime import timedelta
import os
import whisper

def transcribe_audio(file_name):
    model = whisper.load_model("base") # Change this to your desired model
    print("Whisper model loaded.")
    transcribe = model.transcribe(audio=f"{file_name}.mp3")
    segments = transcribe['segments']

    for segment in segments:
        startTime = str(0)+str(timedelta(seconds=int(segment['start'])))+',000'
        endTime = str(0)+str(timedelta(seconds=int(segment['end'])))+',000'
        text = segment['text']
        segmentId = segment['id']+1
        segment = f"{segmentId}\n{startTime} --> {endTime}\n{text[1:] if text[0] == ' ' else text}\n\n"

        srtFilename = os.path.join(dir, f"{file_name}.srt")
        with open(srtFilename, 'a', encoding='utf-8') as srtFile:
            srtFile.write(segment)

    return srtFilename
if __name__ == "__main__":
    for file in os.listdir(dir):
        filename, file_extension = os.path.splitext(file)
        if file_extension == ".mp4":
            if os.path.exists(os.path.join(dir,filename+ ".srt")):
                continue
            file_name = file.split(".mp4")[0]
            file_path = os.path.join(dir, file)
            convert_mp4_to_mp3(file_path, f"{file_name}.mp3")
            transcribe_audio(file_name)
            os.remove(f"{file_name}.mp3")
