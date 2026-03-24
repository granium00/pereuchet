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
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);

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

  const sendLine = () => {
    const value = text.trim();
    if (!value || !wsRef.current || wsRef.current.readyState !== wsRef.current.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "append", text: value }));
    setText("");
  };

  return (
    <section className="card">
      <div className="tag">Ввод данных</div>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>Добавьте строку</h1>
      <p className="status">
        Статус соединения: {connected ? "подключено" : "нет связи"}
      </p>

      <div className="input-panel" style={{ marginTop: 18 }}>
        <div className="input-row">
          <input
            type="text"
            placeholder="Введите текст и нажмите ОК"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendLine();
              }
            }}
          />
          <button onClick={sendLine} disabled={!connected || !text.trim()}>
            ОК
          </button>
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
