"use client";

import { useEffect, useRef, useState } from "react";

type Line = {
  id: string;
  text: string;
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
    if (!selected || !wsRef.current || wsRef.current.readyState !== wsRef.current.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "append", text: selected }));
    setSelected(null);
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
          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            <button
              onClick={sendSelected}
              disabled={!connected || !selected}
            >
              Выбрать и отправить
            </button>
            {selected && (
              <div className="status">
                Выбрано: <span style={{ fontWeight: 600 }}>{selected}</span>
              </div>
            )}
          </div>
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
