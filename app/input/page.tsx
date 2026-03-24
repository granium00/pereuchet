"use client";

import { useEffect, useRef, useState } from "react";

type Line = {
  id: string;
  text: string;
  qty?: string | null;
  date?: string | null;
  ts: number;
};

function getWsUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost:3000/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

export default function InputPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDigits, setDateDigits] = useState("");

  const formatDate = (digits: string) => {
    const d = digits.slice(0, 8);
    const parts = [];
    if (d.length >= 2) {
      parts.push(d.slice(0, 2));
    } else if (d.length > 0) {
      parts.push(d);
    }
    if (d.length >= 4) {
      parts.push(d.slice(2, 4));
    } else if (d.length > 2) {
      parts.push(d.slice(2));
    }
    if (d.length > 4) {
      parts.push(d.slice(4));
    }
    return parts.join(".");
  };

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "init" && Array.isArray(msg.lines)) {
          setLines(msg.lines);
        }
        if (msg.type === "append" && msg.line) {
          setLines((prev) => [...prev, msg.line]);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const search = async () => {
    const value = query.trim();
    setSelected(null);
    setError(null);

    if (!value) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Ошибка поиска.");
      }
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setError("Не удалось выполнить поиск. Проверьте базу данных.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendSelected = () => {
    if (
      !selected ||
      !qty.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== wsRef.current.OPEN
    ) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "append",
        text: selected,
        qty: qty.trim(),
        date: dateValue || null,
      })
    );
    setSelected(null);
    setQty("");
    setDateValue("");
  };

  return (
    <section className="card">
      <div className="tag">Ввод данных</div>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>Найдите нужную строку</h1>
      <p className="status">
        Статус соединения: {connected ? "подключено" : "нет связи"}
      </p>

      <div className="input-panel" style={{ marginTop: 18 }}>
        <div className="input-row">
          <div className="input-wrap">
            <input
              type="text"
              placeholder="Введите слово или фразу и нажмите Искать"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  search();
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setQuery("")}
                aria-label="Очистить строку"
              >
                ×
              </button>
            )}
          </div>
          <button onClick={search} disabled={searching}>
            {searching ? "Идет поиск..." : "Искать"}
          </button>
        </div>

        {error && <div className="status">{error}</div>}

        <div>
          <div className="choice-title" style={{ marginBottom: 10 }}>
            Найденные совпадения
          </div>
          <div className="list">
            {results.length === 0 && (
              <div className="status">Пока нет результатов.</div>
            )}
            {results.map((line, index) => {
              const isSelected = selected === line;
              return (
                <button
                  key={`${line}-${index}`}
                  type="button"
                  className={`list-item${isSelected ? " selected" : ""}`}
                  onClick={() => setSelected(line)}
                >
                  {line}
                </button>
              );
            })}
          </div>
          <div className="action-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="qty-input"
              placeholder="Кол-во"
              value={qty}
              onChange={(event) =>
                setQty(event.target.value.replace(/\D+/g, ""))
              }
            />
            <button
              onClick={sendSelected}
              disabled={!connected || !selected || !qty.trim()}
            >
              Выбрать и отправить
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setDateDigits(dateValue.replace(/\D+/g, ""));
                setDateOpen(true);
              }}
            >
              Дата
            </button>
          </div>
          {selected && (
            <div className="status" style={{ marginTop: 8 }}>
              Выбрано: <span style={{ fontWeight: 600 }}>{selected}</span>
            </div>
          )}
        </div>

        <div>
          <div className="choice-title" style={{ marginBottom: 10 }}>
            Общий поток данных
          </div>
          <div className="list">
            {lines.length === 0 && (
              <div className="status">Пока нет данных.</div>
            )}
            {lines.map((line) => (
              <div key={line.id} className="list-item">
                {line.text}
                {line.qty ? ` — ${line.qty}` : ""}
                {line.date ? ` (${line.date})` : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      {dateOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Введите дату</h2>
            <p className="status">Формат: день.месяц.год</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="date-input"
              placeholder="12.02.2027"
              value={formatDate(dateDigits)}
              onChange={(event) =>
                setDateDigits(event.target.value.replace(/\D+/g, "").slice(0, 8))
              }
            />
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setDateOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dateDigits.length === 8) {
                    setDateValue(formatDate(dateDigits));
                    setDateOpen(false);
                  }
                }}
                disabled={dateDigits.length !== 8}
              >
                ОК
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
