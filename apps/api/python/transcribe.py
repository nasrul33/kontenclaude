#!/usr/bin/env python3
"""faster-whisper transcription for ClipFlow.

Called via execa from the transcribe worker:
    python transcribe.py <audio.wav> [lang_code]

Emits a single JSON object on stdout:
    {"language": "id", "segments": [{"start": 0.0, "end": 2.4, "text": "..."}]}

Model: large-v3-turbo (4x faster than openai-whisper, same accuracy).
Keep ALL diagnostics on stderr so stdout stays pure JSON.
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: transcribe.py <audio.wav> [lang_code]", file=sys.stderr)
        return 2

    audio_path = sys.argv[1]
    lang_code = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None

    # Imported lazily so `--help`/arg errors don't require the heavy dependency.
    from faster_whisper import WhisperModel

    model = WhisperModel("large-v3-turbo", device="auto", compute_type="int8")
    segments, info = model.transcribe(
        audio_path,
        language=lang_code,   # None => auto-detect
        beam_size=5,
        vad_filter=True,      # drop silence
    )

    out = {
        "language": info.language,
        "segments": [
            {"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
            for s in segments
        ],
    }
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
