import { useEffect, useMemo, useState } from "react";
import { CITIES } from "./cities";
import {
  describeCode,
  fetchWeather,
  formatDay,
  formatTemp,
  formatUpdated,
  removeDiacritics,
  type Unit,
  type WeatherData,
} from "./weather";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: WeatherData };

const FAV_KEY = "weather-favorites";

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [unit, setUnit] = useState<Unit>("C");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [reloadKey, setReloadKey] = useState(0); // tăng lên để nút "Thử lại" gọi lại API

  const city = CITIES.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!city) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchWeather(city, controller.signal)
      .then((data) => setState({ status: "success", data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Không thể tải dữ liệu",
        });
      });
    return () => controller.abort(); // tránh kết quả cũ ghi đè khi bấm đổi thành phố nhanh
  }, [city, reloadKey]);

  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    } catch {
      /* bỏ qua nếu localStorage bị chặn */
    }
  }, [favorites]);

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const visibleCities = useMemo(() => {
    const q = removeDiacritics(query.trim());
    return CITIES.filter((c) => removeDiacritics(c.name).includes(q)).sort(
      (a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)),
    );
  }, [query, favorites]);

  const theme = state.status === "success" ? describeCode(state.data.current.code).theme : "default";

  return (
    <div className="app" data-theme={theme}>
      <h1 className="title">Thời tiết Việt Nam</h1>
      <div className="layout">
        <aside className="panel">
          <input
            className="search"
            type="search"
            placeholder="Tìm thành phố..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="city-list">
            {visibleCities.map((c) => (
              <li key={c.id} className={c.id === selectedId ? "city active" : "city"}>
                <button
                  className="city-btn"
                  aria-pressed={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.name}
                </button>
                <button
                  className="star"
                  aria-label={favorites.includes(c.id) ? "Bỏ yêu thích" : "Thêm yêu thích"}
                  onClick={() => toggleFavorite(c.id)}
                >
                  {favorites.includes(c.id) ? "★" : "☆"}
                </button>
              </li>
            ))}
            {visibleCities.length === 0 && <li className="empty">Không tìm thấy thành phố</li>}
          </ul>
        </aside>

        <main className="panel">
          <div className="unit-switch" role="group" aria-label="Đơn vị nhiệt độ">
            {(["C", "F"] as const).map((u) => (
              <button
                key={u}
                className={u === unit ? "unit active" : "unit"}
                aria-pressed={u === unit}
                onClick={() => setUnit(u)}
              >
                °{u}
              </button>
            ))}
          </div>

          {state.status === "idle" && <p className="message">Hãy chọn một thành phố để xem thời tiết.</p>}
          {state.status === "loading" && <p className="message">Đang tải dữ liệu...</p>}
          {state.status === "error" && (
            <div className="message error">
              <p>Lỗi: {state.message}</p>
              <button className="retry" onClick={() => setReloadKey((k) => k + 1)}>
                Thử lại
              </button>
            </div>
          )}

          {state.status === "success" && city && (
            <>
              <section className="current">
                <h2>{city.name}</h2>
                <div className="current-main">
                  <span className="big-icon">{describeCode(state.data.current.code).icon}</span>
                  <span className="big-temp">{formatTemp(state.data.current.temperature, unit)}</span>
                </div>
                <p className="desc">{describeCode(state.data.current.code).label}</p>
                <p>Độ ẩm: {state.data.current.humidity}%</p>
                <p>Tốc độ gió: {state.data.current.windSpeed} km/h</p>
                <p className="updated">Cập nhật: {formatUpdated(state.data.current.time)}</p>
              </section>

              <section>
                <h3>Dự báo 7 ngày</h3>
                <ul className="forecast">
                  {state.data.daily.map((d) => {
                    const { weekday, dayMonth } = formatDay(d.date);
                    return (
                      <li key={d.date} className="day">
                        <span className="day-name">
                          {weekday} <small>{dayMonth}</small>
                        </span>
                        <span className="day-icon" title={describeCode(d.code).label}>
                          {describeCode(d.code).icon}
                        </span>
                        <span className="day-temp">
                          <strong>{formatTemp(d.max, unit)}</strong> / {formatTemp(d.min, unit)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}