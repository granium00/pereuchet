"use client";

import { useState } from "react";

export default function SettingsPanel() {
  return (
    <div className="settings-panel">
      <p className="status">
        Сброс удалит все введенные данные и очистит список у всех.
      </p>
      <SettingsForm />
    </div>
  );
}

function SettingsForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    if (!password) {
      setStatus("error");
      return;
    }
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        throw new Error("bad");
      }
      setStatus("ok");
      setPassword("");
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-form">
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="button" onClick={onReset} disabled={loading}>
        {loading ? "Сброс..." : "Сбросить всё"}
      </button>
      {status === "ok" && <span className="status">Сброшено.</span>}
      {status === "error" && (
        <span className="status">Пароль неверный.</span>
      )}
    </div>
  );
}
