"""Collect current Jinju weather from Open-Meteo and append it to a CSV file."""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


API_URL = "https://api.open-meteo.com/v1/forecast"
LATITUDE = 35.18
LONGITUDE = 128.11
TIMEZONE = "Asia/Seoul"
CURRENT_VARIABLES = (
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
)
CSV_FIELDS = (
    "observed_at",
    "latitude",
    "longitude",
    "temperature_c",
    "apparent_temperature_c",
    "relative_humidity_pct",
    "precipitation_mm",
    "weather_code",
    "wind_speed_kmh",
    "wind_direction_deg",
)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"


def build_api_url() -> str:
    """Build the Open-Meteo request URL for the configured location."""
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "current": ",".join(CURRENT_VARIABLES),
        "timezone": TIMEZONE,
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }
    return f"{API_URL}?{urlencode(params)}"


def fetch_current_weather(timeout: int = 30) -> dict[str, object]:
    """Fetch and validate the current-weather object from Open-Meteo."""
    request = Request(build_api_url(), headers={"User-Agent": "open-meteo-weather-collector/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Open-Meteo 요청 실패: {exc}") from exc

    current = payload.get("current")
    if not isinstance(current, dict):
        reason = payload.get("reason", "current 데이터가 없습니다.")
        raise RuntimeError(f"Open-Meteo 응답 오류: {reason}")

    required = ("time", *CURRENT_VARIABLES)
    missing = [field for field in required if current.get(field) is None]
    if missing:
        raise RuntimeError(f"Open-Meteo 응답에 필수 항목이 없습니다: {', '.join(missing)}")
    return current


def normalize_observed_at(value: object) -> str:
    """Return the API's local observation time as an offset-aware ISO string."""
    try:
        observed = datetime.fromisoformat(str(value))
    except ValueError as exc:
        raise RuntimeError(f"잘못된 관측 시각입니다: {value}") from exc

    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=ZoneInfo(TIMEZONE))
    return observed.isoformat()


def make_row(current: dict[str, object]) -> dict[str, object]:
    """Convert an Open-Meteo current-weather object into one CSV row."""
    return {
        "observed_at": normalize_observed_at(current["time"]),
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "temperature_c": current["temperature_2m"],
        "apparent_temperature_c": current["apparent_temperature"],
        "relative_humidity_pct": current["relative_humidity_2m"],
        "precipitation_mm": current["precipitation"],
        "weather_code": current["weather_code"],
        "wind_speed_kmh": current["wind_speed_10m"],
        "wind_direction_deg": current["wind_direction_10m"],
    }


def csv_path_for(observed_at: str) -> Path:
    """Choose a monthly CSV path based on the observation time."""
    observed = datetime.fromisoformat(observed_at)
    return DATA_DIR / f"weather_{observed:%Y-%m}.csv"


def observation_exists(csv_path: Path, observed_at: str) -> bool:
    """Check whether this observation time is already present in the CSV."""
    if not csv_path.exists():
        return False
    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return any(row.get("observed_at") == observed_at for row in csv.DictReader(csv_file))


def append_row(row: dict[str, object]) -> tuple[Path, bool]:
    """Append a row unless its observation time already exists."""
    csv_path = csv_path_for(str(row["observed_at"]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if observation_exists(csv_path, str(row["observed_at"])):
        return csv_path, False

    needs_header = not csv_path.exists() or csv_path.stat().st_size == 0
    with csv_path.open("a", encoding="utf-8-sig", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        if needs_header:
            writer.writeheader()
        writer.writerow(row)
    return csv_path, True


def main() -> int:
    try:
        row = make_row(fetch_current_weather())
        csv_path, added = append_row(row)
    except (OSError, RuntimeError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1

    relative_path = csv_path.relative_to(PROJECT_ROOT)
    if added:
        print(f"저장 완료: {relative_path} ({row['observed_at']})")
    else:
        print(f"중복 건너뜀: {relative_path} ({row['observed_at']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

