"""Nagrywa pytania z bazy głosem Piper (offline, na komputerze).

Dla każdego pytania z src/data/questions.json powstaje assets/audio/questions/<id>.mp3,
a manifest.json zapisuje tekst i długość nagrania. Na tej podstawie aplikacja wie, jak długo
trwa czytanie, a test sprawdza, czy nagranie pasuje do aktualnej treści pytania.

Użycie (z katalogu projektu):
    python -m venv scripts/narration/.venv
    scripts/narration/.venv/Scripts/python -m pip install -r scripts/narration/requirements.txt
    scripts/narration/.venv/Scripts/python scripts/narration/generate_question_audio.py
Opcje: --force (nagraj wszystko od nowa), --check (tylko sprawdź, czy nagrania są aktualne).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "src" / "data" / "questions.json"
MODEL = ROOT / "voiceModel" / "voice.onnx"
OUT_DIR = ROOT / "assets" / "audio" / "questions"
MANIFEST = OUT_DIR / "manifest.json"
SOURCES_TS = ROOT / "src" / "narration" / "questionAudioSources.ts"

# Mono 32 kb/s wystarcza na mowę i jest ok. 10x mniejsze niż WAV z Pipera.
MP3_BITRATE_KBPS = 32
MP3_QUALITY = 2

log = logging.getLogger("lektor")


def load_questions() -> list[dict]:
    data = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    questions = data["questions"]
    ids = [q["id"] for q in questions]
    if len(ids) != len(set(ids)):
        raise SystemExit("Powtórzone id w bazie pytań – popraw bazę przed nagrywaniem")
    return questions


def load_manifest() -> dict[str, dict]:
    if not MANIFEST.exists():
        return {}
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["questions"]


def stale_ids(questions: list[dict], manifest: dict[str, dict]) -> list[str]:
    """Pytania bez nagrania albo z nagraniem zrobionym ze starej treści."""
    return [
        q["id"]
        for q in questions
        if manifest.get(q["id"], {}).get("text") != q["question"] or not (OUT_DIR / f"{q['id']}.mp3").exists()
    ]


def synthesize(voice, text: str) -> tuple[bytes, int]:
    """Zwraca próbki PCM 16-bit mono i częstotliwość próbkowania."""
    chunks = list(voice.synthesize(text))
    if not chunks:
        raise RuntimeError(f"Piper nie zwrócił dźwięku dla: {text!r}")
    return b"".join(c.audio_int16_bytes for c in chunks), chunks[0].sample_rate


def encode_mp3(pcm: bytes, sample_rate: int) -> bytes:
    import lameenc

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_BITRATE_KBPS)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(MP3_QUALITY)
    return encoder.encode(pcm) + encoder.flush()


def write_sources(ids: list[str]) -> None:
    """Metro dołącza do aplikacji tylko pliki z dosłownym `require`, więc mapę id → plik generujemy."""
    lines = [
        "// Plik generowany przez scripts/narration/generate_question_audio.py – nie edytuj ręcznie.",
        "",
        "export const QUESTION_AUDIO_SOURCES: Record<string, number> = {",
        *(f"  '{qid}': require('../../assets/audio/questions/{qid}.mp3')," for qid in ids),
        "};",
        "",
    ]
    SOURCES_TS.write_text("\n".join(lines), encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="nagraj wszystkie pytania od nowa")
    parser.add_argument("--check", action="store_true", help="tylko sprawdź, czy nagrania są aktualne")
    args = parser.parse_args()
    # Konsola Windows domyślnie nie wypisuje polskich znaków.
    sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="[%(name)s] %(levelname)s %(message)s")

    questions = load_questions()
    manifest = load_manifest()
    todo = [q["id"] for q in questions] if args.force else stale_ids(questions, manifest)
    current_ids = {q["id"] for q in questions}
    orphans = sorted(set(manifest) - current_ids)
    log.info("Pytań w bazie: %d, do nagrania: %d, do usunięcia: %d", len(questions), len(todo), len(orphans))

    if args.check:
        for qid in todo:
            log.error("Nieaktualne albo brakujące nagranie: %s", qid)
        for qid in orphans:
            log.error("Nagranie pytania, którego nie ma w bazie: %s", qid)
        return 1 if todo or orphans else 0

    if todo:
        if not MODEL.exists():
            log.error("Brak modelu głosu: %s", MODEL)
            return 1
        from piper import PiperVoice

        voice = PiperVoice.load(str(MODEL))
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        by_id = {q["id"]: q for q in questions}
        for index, qid in enumerate(todo, 1):
            text = by_id[qid]["question"]
            pcm, sample_rate = synthesize(voice, text)
            duration_ms = round(len(pcm) / 2 / sample_rate * 1000)
            mp3 = encode_mp3(pcm, sample_rate)
            (OUT_DIR / f"{qid}.mp3").write_bytes(mp3)
            manifest[qid] = {"text": text, "durationMs": duration_ms}
            log.info("[%d/%d] %s: %d ms, %.1f KB", index, len(todo), qid, duration_ms, len(mp3) / 1024)

    for qid in orphans:
        (OUT_DIR / f"{qid}.mp3").unlink(missing_ok=True)
        del manifest[qid]
        log.info("Usunięto nagranie usuniętego pytania: %s", qid)

    ordered = {q["id"]: manifest[q["id"]] for q in questions}
    MANIFEST.write_text(
        json.dumps({"version": 1, "questions": ordered}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    write_sources(list(ordered))

    total_kb = sum((OUT_DIR / f"{qid}.mp3").stat().st_size for qid in ordered) / 1024
    total_s = sum(entry["durationMs"] for entry in ordered.values()) / 1000
    log.info("Gotowe: %d nagrań, %.0f s mowy, %.0f KB", len(ordered), total_s, total_kb)
    return 0


if __name__ == "__main__":
    sys.exit(main())
