const $ = (id) => document.getElementById(id);

const weatherCodes = [
  { codes: [0], label: "맑음", icon: "☀️" },
  { codes: [1, 2], label: "대체로 맑음", icon: "🌤️" },
  { codes: [3], label: "흐림", icon: "☁️" },
  { codes: [45, 48], label: "안개", icon: "🌫️" },
  { codes: [51, 53, 55, 56, 57], label: "이슬비", icon: "🌦️" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: "비", icon: "🌧️" },
  { codes: [71, 73, 75, 77, 85, 86], label: "눈", icon: "🌨️" },
  { codes: [95, 96, 99], label: "뇌우", icon: "⛈️" },
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) throw new Error("비교하려면 관측 데이터가 두 개 이상 필요합니다.");
  const headers = lines[0].replace(/^\uFEFF/, "").split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function monthKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  return `${year}-${month}`;
}

function candidateFiles() {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return [monthKey(now), monthKey(previousMonth)].map((key) => `data/weather_${key}.csv`);
}

async function loadRows() {
  for (const path of candidateFiles()) {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (response.ok) return parseCsv(await response.text());
  }
  throw new Error("월별 날씨 CSV 파일을 찾지 못했습니다.");
}

const number = (value) => Number.parseFloat(value);
const signed = (value, unit = "") => `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`;

function differenceText(current, previous, unit) {
  const difference = number(current) - number(previous);
  if (Math.abs(difference) < 0.05) return "직전과 동일";
  return `직전 대비 ${signed(difference, unit)}`;
}

function formatTime(value, includeDate = true) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(includeDate ? { month: "long", day: "numeric" } : {}),
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

function directionName(degrees) {
  const names = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
  return names[Math.round(number(degrees) / 45) % 8];
}

function weatherInfo(code) {
  return weatherCodes.find((item) => item.codes.includes(Number(code))) ?? { label: "날씨 정보", icon: "🌡️" };
}

function render(rows) {
  const previous = rows.at(-2);
  const latest = rows.at(-1);
  const info = weatherInfo(latest.weather_code);
  const temperatureDifference = number(latest.temperature_c) - number(previous.temperature_c);

  $("temperature").textContent = number(latest.temperature_c).toFixed(1);
  $("weatherIcon").textContent = info.icon;
  $("weatherLabel").textContent = info.label;
  $("statusMessage").textContent = `${info.label} · 체감 ${number(latest.apparent_temperature_c).toFixed(1)}°C`;
  $("temperatureChange").textContent = differenceText(latest.temperature_c, previous.temperature_c, "°C");
  $("observedTime").textContent = formatTime(latest.observed_at);
  $("dataAge").textContent = `Open-Meteo 관측 · 총 ${rows.length}개 기록`;

  $("apparentTemperature").textContent = number(latest.apparent_temperature_c).toFixed(1);
  $("apparentChange").textContent = differenceText(latest.apparent_temperature_c, previous.apparent_temperature_c, "°");
  $("humidity").textContent = Math.round(number(latest.relative_humidity_pct));
  $("humidityChange").textContent = differenceText(latest.relative_humidity_pct, previous.relative_humidity_pct, "%p");
  $("precipitation").textContent = number(latest.precipitation_mm).toFixed(1);
  $("precipitationChange").textContent = differenceText(latest.precipitation_mm, previous.precipitation_mm, " mm");
  $("windSpeed").textContent = number(latest.wind_speed_kmh).toFixed(1);
  $("windDirection").textContent = `${directionName(latest.wind_direction_deg)}풍 · ${Math.round(number(latest.wind_direction_deg))}°`;

  $("previousTemperature").textContent = `${number(previous.temperature_c).toFixed(1)}°`;
  $("latestTemperature").textContent = `${number(latest.temperature_c).toFixed(1)}°`;
  $("previousTime").textContent = formatTime(previous.observed_at, false);
  $("latestTime").textContent = formatTime(latest.observed_at, false);
  $("trendArrow").textContent = temperatureDifference > 0.05 ? "↗" : temperatureDifference < -0.05 ? "↘" : "→";
}

async function refresh() {
  const button = $("refreshButton");
  button.classList.add("loading");
  button.disabled = true;
  try {
    render(await loadRows());
    document.querySelector(".hero-card").classList.remove("error");
  } catch (error) {
    $("statusMessage").textContent = error.message;
    $("weatherLabel").textContent = "데이터를 불러오지 못했습니다";
    document.querySelector(".hero-card").classList.add("error");
  } finally {
    button.classList.remove("loading");
    button.disabled = false;
  }
}

$("refreshButton").addEventListener("click", refresh);
refresh();
