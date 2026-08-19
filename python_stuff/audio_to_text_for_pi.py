import os, sys, subprocess, time
from pathlib import Path
from datetime import datetime
from faster_whisper import WhisperModel

version = 2 # Default: 2
ordner = "/home/ubuntu/files/"
ordner_new = "/home/ubuntu/wav/"
ordner_tmp = "/home/ubuntu/tmp/"
if version == 0: # Basic stuff - good to know
  model = WhisperModel("base", device="cpu", compute_type="int8")
  segments, info = model.transcribe("audio.mp3", language="de")
  print(f"Sprache: {info.language}")
  for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
if version == 1: # Version works for higher RAM and cpu threads but not for an Raspi Pi 3 with 1 GB RAM
  model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=3) # int8 und 3 wegen dem pi
  dateien = [
    f for f in os.listdir(ordner)
    if os.path.isfile(os.path.join(ordner, f))
  ]
  print(f"Start @ time: {datetime.now()}")
  for a in dateien:
    time_a = time.time()
    eingabe = Path(ordner) / a
    ausgabe = Path(ordner_new) / (Path(a).stem + ".wav")
    ausgabe_txt = Path(ordner_new) / (Path(a).stem + ".txt")
    result = subprocess.run( f'ffmpeg -y -i "{eingabe}" -acodec pcm_s16le -ar 16000 -ac 1 "{ausgabe}"', shell=True, check=True, capture_output=True, text=True )
    if result.returncode != 0: print(result.stderr)
    else:
      segments, info = model.transcribe(ausgabe, language="de", beam_size=1)
      print(f"Sprache: {info.language} - file: {a} - time: {datetime.now()} - Memory after segments: {os.path.getsize(ausgabe) / (1024 * 1024):.2f} MB")
      output = ''
      for segment in segments:
        output += f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}\n"
      with open(ausgabe_txt, "w", encoding="utf-8") as f: f.write(output)
      time_b = time.time()
      print(f"time needed for ({ausgabe.stat().st_size / (1024 * 1024):.2f}Mb): {time_b - time_a:.2f} - Memory at end of all segments: {os.path.getsize(ausgabe) / (1024 * 1024):.2f} MB")
if version == 2:
  time_splitter_in_s = 300
  model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=3) # int8 and 3 for an pi 3 with 1GB RAM 
  dateien = [
    f for f in os.listdir(ordner)
    if os.path.isfile(os.path.join(ordner, f))
  ]
  print(f"Start @ time: {datetime.now()}")
  for a in dateien:
    time_a = time.time()
    eingabe = Path(ordner) / a
    ausgabe = Path(ordner_new) / (Path(a).stem + ".wav")
    ausgabe_tmp = Path(ordner_tmp) / (Path(a).stem)
    ausgabe_tmp_2 = Path(ordner_tmp)
    ausgabe_txt = Path(ordner_new) / (Path(a).stem + ".txt")
    #subprocess.run( f'ffmpeg -y -i "{eingabe}" -acodec pcm_s16le -ar 16000 -ac 1 "{ausgabe}"', shell=True, check=True, capture_output=True, text=True )
    subprocess.run( f'ffmpeg -i "{eingabe}" "{ausgabe}"', shell=True, check=True, capture_output=True, text=True )
    subprocess.run( f'ffmpeg -i "{eingabe}" -f segment -segment_time {time_splitter_in_s} -reset_timestamps 1 "{ausgabe_tmp}"_%03d.wav', shell=True, check=True, capture_output=True, text=True )
    output = []
    offset = 0
    dateien_tmp = sorted(
      f for f in os.listdir(ordner_tmp)
      if os.path.isfile(os.path.join(ordner_tmp, f))
    )
    for tmp_file in dateien_tmp:
      segments, info = model.transcribe(str(ausgabe_tmp_2 / tmp_file), language="de", beam_size=1)
      print(f"Sprache: {info.language} - file: {a} - time: {datetime.now()} - Memory after segments: {os.path.getsize(ausgabe) / (1024 * 1024):.2f} MB")
      for segment in segments:
        output.append( f"[{segment.start + offset:.2f}s -> {segment.end + offset:.2f}s] {segment.text}" )
      offset += time_splitter_in_s
    with open(ausgabe_txt, "w", encoding="utf-8") as f: f.write("\n".join(output))
    time_b = time.time()
    print(f"time needed for ({ausgabe.stat().st_size / (1024 * 1024):.2f}Mb): {time_b - time_a:.2f}s")
    for f in Path(ordner_tmp).glob("*.wav"): f.unlink()
