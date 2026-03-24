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

export default function ViewPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");

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

  const copyAll = async () => {
    const text = lines.map((line) => line.text).join("\n");
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopyState("done");
    setTimeout(() => setCopyState("idle"), 1200);
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
          <div className="choice-title" style={{ marginBottom: 10 }}>
            Общий список
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
