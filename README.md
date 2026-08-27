# Open-Meteo Weather Collector

Open-Meteo의 진주시 현재 날씨를 매시간 수집하여 월별 CSV 파일로 저장하고,
GitHub Actions를 통해 변경 내용을 자동 커밋하는 프로젝트입니다.

## 예정 구조

- `src/collect_weather.py`: 날씨 수집 및 CSV 저장
- `tests/test_collect_weather.py`: 수집 로직 테스트
- `data/weather_YYYY-MM.csv`: 월별 관측 데이터
- `.github/workflows/collect-weather.yml`: 매시간 자동 실행

## 현재 수집 설정

- 위치: 진주시 (`35.18`, `128.11`)
- 시간대: `Asia/Seoul`
- 항목: 기온, 체감온도, 상대습도, 강수량, 날씨코드, 풍속, 풍향
- 저장 방식: 관측 월별 CSV, 동일 관측 시각 중복 방지

수집 스크립트는 `python src/collect_weather.py`로 실행합니다.

## 자동 수집

`.github/workflows/collect-weather.yml`이 다음 방식으로 실행됩니다.

- 매시간 정각 예약 실행
- GitHub Actions 화면에서 수동 실행 가능
- 새 날씨 데이터가 있을 때만 `data/` 변경 사항을 자동 커밋
- 동시에 여러 수집 작업이 겹치지 않도록 순차 실행
