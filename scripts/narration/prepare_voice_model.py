"""Przygotowuje model głosu Piper do syntezy mowy na telefonie (sherpa-onnx).

Nie nagrywa żadnych plików dźwiękowych — gra czyta tekst na żywo. Skrypt tylko układa model
tak, jak oczekuje go sherpa-onnx:
  voiceModel/vits-piper-pl/model.onnx      – voice.onnx z dopisanymi metadanymi (model_type=vits, comment=piper…)
  voiceModel/vits-piper-pl/tokens.txt      – symbole fonemów z phoneme_id_map (voice.onnx.json)
  voiceModel/vits-piper-pl/espeak-ng-data/ – dane espeak-ng z wydań sherpa-onnx (zamiana tekstu na fonemy)
Folder trafia do zasobów aplikacji przez wtyczkę plugins/withVoiceModel.js przy `npx expo prebuild`.

Użycie (z katalogu projektu):
    python -m venv scripts/narration/.venv
    scripts/narration/.venv/Scripts/python -m pip install -r scripts/narration/requirements.txt
    scripts/narration/.venv/Scripts/python scripts/narration/prepare_voice_model.py
"""

from __future__ import annotations

import json
import logging
import shutil
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_MODEL = ROOT / "voiceModel" / "voice.onnx"
SOURCE_CONFIG = ROOT / "voiceModel" / "voice.onnx.json"
# Nazwa folderu musi zawierać „vits” — po niej sherpa-onnx rozpoznaje typ modelu.
OUT_DIR = ROOT / "voiceModel" / "vits-piper-pl"
ESPEAK_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/espeak-ng-data.tar.bz2"
# Wszystkie słowniki zostają: espeak przełącza się na inne języki przy obcych słowach (np. angielski
# przy cudzysłowach i nazwach), a brak słownika kończy się awarią syntezy na Androidzie (SIGSEGV).
REQUIRED_DICTS = ("pl_dict", "en_dict")

log = logging.getLogger("lektor")


def metadata(config: dict) -> dict[str, str]:
    """Metadane, których sherpa-onnx szuka w modelu Piper (wg skryptu konwersji sherpa-onnx)."""
    return {
        "model_type": "vits",
        "comment": "piper",  # musi być „piper” dla modeli z Pipera
        "language": config.get("language", {}).get("name_english", "Polish"),
        "voice": config["espeak"]["voice"],
        "has_espeak": "1",
        "n_speakers": str(config["num_speakers"]),
        "sample_rate": str(config["audio"]["sample_rate"]),
    }


def write_model(config: dict) -> None:
    import onnx

    model = onnx.load(str(SOURCE_MODEL))
    existing = {p.key for p in model.metadata_props}
    for key, value in metadata(config).items():
        if key in existing:
            continue
        prop = model.metadata_props.add()
        prop.key = key
        prop.value = value
    onnx.save(model, str(OUT_DIR / "model.onnx"))


def write_tokens(config: dict) -> None:
    # sherpa-onnx czyta tylko symbole jednoznakowe. Wieloznakowe to dyftongi z domyślnej mapy Pipera
    # („aɪ”, „oʊ”…), których espeak dla polskiego nie wytwarza — pomijamy je.
    id_map = config["phoneme_id_map"]
    skipped = [symbol for symbol in id_map if len(symbol) != 1]
    lines = [f"{symbol} {ids[0]}\n" for symbol, ids in id_map.items() if len(symbol) == 1]
    (OUT_DIR / "tokens.txt").write_text("".join(lines), encoding="utf-8", newline="\n")
    if skipped:
        log.info("Pominięto symbole wieloznakowe (sherpa-onnx ich nie obsługuje): %s", " ".join(skipped))


def safe_extract(tar: tarfile.TarFile, dest: Path) -> None:
    """Archiwum z internetu: tylko zwykłe pliki i katalogi, bez ścieżek wychodzących poza `dest`."""
    if hasattr(tarfile, "data_filter"):
        tar.extractall(dest, filter="data")
        return
    root = dest.resolve()
    for member in tar.getmembers():
        target = (dest / member.name).resolve()
        if not (member.isfile() or member.isdir()) or root not in (target, *target.parents):
            raise SystemExit(f"Podejrzany wpis w archiwum espeak-ng-data: {member.name}")
    tar.extractall(dest)


def install_espeak_data() -> None:
    target = OUT_DIR / "espeak-ng-data"
    if target.exists() and all((target / name).exists() for name in REQUIRED_DICTS):
        log.info("espeak-ng-data już jest, pomijam pobieranie")
        return
    if target.exists():
        # Niepełne dane (np. z wcześniejszej wersji skryptu, która przycinała słowniki) — pobieramy od nowa.
        shutil.rmtree(target)
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "espeak-ng-data.tar.bz2"
        log.info("Pobieram %s", ESPEAK_URL)
        urllib.request.urlretrieve(ESPEAK_URL, archive)
        extract_dir = Path(tmp) / "extracted"
        with tarfile.open(archive) as tar:
            safe_extract(tar, extract_dir)
        shutil.move(str(extract_dir / "espeak-ng-data"), target)
    missing = [name for name in REQUIRED_DICTS if not (target / name).exists()]
    if missing:
        raise SystemExit(f"W espeak-ng-data brakuje: {', '.join(missing)}")
    log.info("espeak-ng-data gotowe")


def main() -> int:
    sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="[%(name)s] %(levelname)s %(message)s")
    if not SOURCE_MODEL.exists() or not SOURCE_CONFIG.exists():
        log.error("Brak modelu głosu: %s (i %s)", SOURCE_MODEL, SOURCE_CONFIG.name)
        return 1
    config = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_model(config)
    write_tokens(config)
    install_espeak_data()
    size_mb = sum(p.stat().st_size for p in OUT_DIR.rglob("*") if p.is_file()) / 1024 / 1024
    log.info("Model gotowy: %s (%.1f MB)", OUT_DIR, size_mb)
    return 0


if __name__ == "__main__":
    sys.exit(main())
