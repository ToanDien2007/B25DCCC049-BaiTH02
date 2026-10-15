import type { City } from "./cities";

export interface CurrentWeather {
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  code: number;
  time: string;
}

export interface DailyItem {
  date: string; // YYYY-MM-DD
  code: number;
  max: number; // °C
  min: number; // °C
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyItem[];
}

export type Unit = "C" | "F";
export type Theme = "clear" | "cloudy" | "fog" | "rain" | "storm" | "snow";

export async function fetchWeather(city: City, signal: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Ho_Chi_Minh",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error(`Máy chủ trả về lỗi ${res.status}`);
  const json = await res.json();

  const c = json.current;
  const d = json.daily;
  if (!c || !d) throw new Error("Dữ liệu trả về không hợp lệ");

  return {
    current: {
      temperature: c.temperature_2m,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      code: c.weather_code,
      time: c.time,
    },
    // phần tử thứ i của 4 mảng thuộc cùng một ngày
    daily: (d.time as string[]).map((date, i) => ({
      date,
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
    })),
  };
}

// Chuyển đổi nằm ở phía hiển thị, dữ liệu gốc luôn là °C nên đổi đơn vị không gọi lại API
export function formatTemp(celsius: number, unit: Unit): string {
  const v = unit === "C" ? celsius : (celsius * 9) / 5 + 32;
  return `${Math.round(v)}°${unit}`;
}

interface CodeInfo {
  icon: string;
  label: string;
  theme: Theme;
}

export function describeCode(code: number): CodeInfo {
  if (code === 0) return { icon: "☀️", label: "Trời quang", theme: "clear" };
  if (code === 1) return { icon: "🌤️", label: "Chủ yếu quang đãng", theme: "clear" };
  if (code === 2) return { icon: "⛅", label: "Có mây rải rác", theme: "cloudy" };
  if (code === 3) return { icon: "☁️", label: "Nhiều mây", theme: "cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Sương mù", theme: "fog" };
  if (code >= 51 && code <= 55) return { icon: "🌦️", label: "Mưa phùn", theme: "rain" };
  if (code === 56 || code === 57) return { icon: "🌧️", label: "Mưa phùn lạnh", theme: "rain" };
  if (code === 61) return { icon: "🌧️", label: "Mưa nhẹ", theme: "rain" };
  if (code === 63) return { icon: "🌧️", label: "Mưa vừa", theme: "rain" };
  if (code === 65) return { icon: "🌧️", label: "Mưa to", theme: "rain" };
  if (code === 66 || code === 67) return { icon: "🌧️", label: "Mưa lạnh", theme: "rain" };
  if (code >= 71 && code <= 77) return { icon: "❄️", label: "Tuyết", theme: "snow" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", label: "Mưa rào", theme: "rain" };
  if (code === 85 || code === 86) return { icon: "🌨️", label: "Tuyết rơi", theme: "snow" };
  if (code === 95) return { icon: "⛈️", label: "Dông", theme: "storm" };
  if (code === 96 || code === 99) return { icon: "⛈️", label: "Dông kèm mưa đá", theme: "storm" };
  return { icon: "❓", label: "Không xác định", theme: "cloudy" };
}

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

// Tách chuỗi thủ công để tránh lệch múi giờ khi dùng new Date("YYYY-MM-DD")
export function formatDay(date: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: WEEKDAYS[dt.getDay()],
    dayMonth: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
  };
}

// "2026-10-14T15:00" -> "15:00 14/10/2026"
export function formatUpdated(time: string): string {
  const [date, hm] = time.split("T");
  const [y, m, d] = date.split("-");
  return `${hm} ${d}/${m}/${y}`;
}

export function removeDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}