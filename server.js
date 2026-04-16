const http = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();

const sharedLines = [];
const clients = new Set();
const databaseUrl = process.env.DATABASE_URL;
let pool = null;
let dbReady = false;
const removalTimers = new Map();
const RESET_PASSWORD = "taras00";

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg);
    }
  }
}

async function initDb() {
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set. Using in-memory storage only.");
    return;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lines (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      qty TEXT,
      date_text TEXT,
      ts BIGINT NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE lines
    ADD COLUMN IF NOT EXISTS qty TEXT;
  `);

  await pool.query(`
    ALTER TABLE lines
    ADD COLUMN IF NOT EXISTS date_text TEXT;
  `);

  dbReady = true;
}

async function loadLinesFromDb() {
  if (!dbReady || !pool) {
    return sharedLines;
  }
  const result = await pool.query(
    "SELECT id, text, qty, date_text, ts FROM lines ORDER BY ts ASC"
  );
  return result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    qty: row.qty,
    date: row.date_text,
    ts: Number(row.ts),
  }));
}

async function insertLine(line) {
  if (!dbReady || !pool) {
    sharedLines.push(line);
    return;
  }
  await pool.query(
    "INSERT INTO lines (id, text, qty, date_text, ts) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
    [line.id, line.text, line.qty || null, line.date || null, line.ts]
  );
}

async function deleteLine(id) {
  const index = sharedLines.findIndex((line) => line.id === id);
  if (index >= 0) {
    sharedLines.splice(index, 1);
  }
  if (!dbReady || !pool) {
    return;
  }
  await pool.query("DELETE FROM lines WHERE id = $1", [id]);
}

app
  .prepare()
  .then(() => {
    return initDb();
  })
  .then(() => {
    const server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url, true);

      if (parsedUrl.pathname === "/admin/reset" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const data = JSON.parse(body || "{}");
            if (data.password !== RESET_PASSWORD) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Неверный пароль." }));
              return;
            }

            sharedLines.length = 0;
            for (const timer of removalTimers.values()) {
              clearTimeout(timer);
            }
            removalTimers.clear();

            if (dbReady && pool) {
              await pool.query("DELETE FROM lines");
            }

            broadcast({ type: "reset" });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Не удалось выполнить сброс." }));
          }
        });
        return;
      }

      if (parsedUrl.pathname === "/healthz") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("ok");
        return;
      }

      handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const { pathname } = parse(req.url);
      if (pathname === "/ws") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on("connection", (ws) => {
      clients.add(ws);

      loadLinesFromDb()
        .then((lines) => {
          ws.send(
            JSON.stringify({
              type: "init",
              lines,
            })
          );
        })
        .catch((err) => {
          console.error("Failed to load lines", err);
          ws.send(
            JSON.stringify({
              type: "init",
              lines: sharedLines,
            })
          );
        });

      ws.on("message", async (data) => {
        const msg = safeJsonParse(data.toString());
        if (!msg || !msg.type) {
          return;
        }

        if (msg.type === "append") {
          let text = String(msg.text || "").trim();
          let qty = msg.qty != null ? String(msg.qty).trim() : "";
          let date = msg.date != null ? String(msg.date).trim() : "";
          if (!text) {
            return;
          }

          if (text.length > 1000) {
            text = text.slice(0, 1000);
          }

          if (qty.length > 20) {
            qty = qty.slice(0, 20);
          }

          if (date.length > 20) {
            date = date.slice(0, 20);
          }

          const line = {
            id: makeId(),
            text,
            qty: qty || null,
            date: date || null,
            ts: Date.now(),
          };

          try {
            await insertLine(line);
            broadcast({ type: "append", line });
          } catch (err) {
            console.error("Failed to insert line", err);
          }
        }

        if (msg.type === "processed") {
          const id = String(msg.id || "");
          if (!id) {
            return;
          }
          if (removalTimers.has(id)) {
            return;
          }
          const timer = setTimeout(async () => {
            removalTimers.delete(id);
            try {
              await deleteLine(id);
              broadcast({ type: "remove", id });
            } catch (err) {
              console.error("Failed to delete line", err);
            }
          }, 2 * 60 * 1000);
          removalTimers.set(id, timer);
        }

        if (msg.type === "unprocess") {
          const id = String(msg.id || "");
          if (!id) {
            return;
          }
          const timer = removalTimers.get(id);
          if (timer) {
            clearTimeout(timer);
            removalTimers.delete(id);
          }
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
      });
    });

    server.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
