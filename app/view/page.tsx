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

export default function ViewPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [processed, setProcessed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"main" | "dates">("main");

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
        if (msg.type === "remove" && msg.id) {
          setLines((prev) => prev.filter((line) => line.id !== msg.id));
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const copyAll = async () => {
    const text = lines.map((line) => line.text).join("\n");
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopyState("done");
    setTimeout(() => setCopyState("idle"), 1200);
  };

  const copyName = async (line: Line) => {
    await navigator.clipboard.writeText(line.text);
    setProcessed((prev) => ({ ...prev, [line.id]: true }));
    if (wsRef.current && wsRef.current.readyState === wsRef.current.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "processed", id: line.id }));
    }
  };

  const copyQty = async (line: Line) => {
    if (!line.qty) {
      return;
    }
    await navigator.clipboard.writeText(line.qty);
  };

  const copyDate = async (line: Line) => {
    if (!line.date) {
      return;
    }
    await navigator.clipboard.writeText(line.date);
  };

  const resetProcessed = (line: Line) => {
    setProcessed((prev) => {
      const next = { ...prev };
      delete next[line.id];
      return next;
    });
    if (wsRef.current && wsRef.current.readyState === wsRef.current.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unprocess", id: line.id }));
    }
  };

  return (
    <section className="card">
      <div className="tag">Просмотр</div>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>Данные в реальном времени</h1>
      <p className="status">
        Статус соединения: {connected ? "подключено" : "нет связи"}
      </p>

      <div className="input-panel" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={copyAll} disabled={!lines.length}>
            {copyState === "done" ? "Скопировано" : "Скопировать всё"}
          </button>
          <a className="choice" href="/" style={{ padding: "10px 14px" }}>
            Вернуться к выбору
          </a>
        </div>
        <div>
          <div className="tabs">
            <button
              type="button"
              className={`tab-btn${tab === "main" ? " active" : ""}`}
              onClick={() => setTab("main")}
            >
              Основные
            </button>
            <button
              type="button"
              className={`tab-btn${tab === "dates" ? " active" : ""}`}
              onClick={() => setTab("dates")}
            >
              Даты
            </button>
          </div>
          <div className="choice-title" style={{ marginBottom: 10 }}>
            {tab === "main" ? "Общий список" : "Даты"}
          </div>
          <div className="list">
            {lines.length === 0 && (
              <div className="status">Пока нет данных.</div>
            )}
            {tab === "main" &&
              lines.map((line) => (
                <div key={line.id} className="list-row">
                  <button
                    type="button"
                    className="reset-btn"
                    onClick={() => resetProcessed(line)}
                    title="Снять пометку"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className={`name-chip${processed[line.id] ? " processed" : ""}`}
                    onClick={() => copyName(line)}
                    title="Скопировать наименование"
                  >
                    {line.text}
                  </button>
                  <button
                    type="button"
                    className="qty-chip"
                    onClick={() => copyQty(line)}
                    title="Скопировать цифру"
                    disabled={!line.qty}
                  >
                    {line.qty || "—"}
                  </button>
                </div>
              ))}
            {tab === "dates" &&
              lines
                .filter((line) => line.date)
                .map((line) => (
                  <div key={line.id} className="list-row">
                    <button
                      type="button"
                      className="reset-btn"
                      onClick={() => resetProcessed(line)}
                      title="Снять пометку"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className={`name-chip${processed[line.id] ? " processed" : ""}`}
                      onClick={() => copyName(line)}
                      title="Скопировать наименование"
                    >
                      {line.text}
                    </button>
                    <button
                      type="button"
                      className="qty-chip"
                      onClick={() => copyDate(line)}
                      title="Скопировать дату"
                    >
                      {line.date}
                    </button>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
