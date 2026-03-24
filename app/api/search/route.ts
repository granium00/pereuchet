import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

let cachedLines: string[] | null = null;
let cachedMtimeMs: number | null = null;

async function loadBaseLines() {
  const filePath = path.join(process.cwd(), "data", "base.csv");
  const stat = await fs.stat(filePath);

  if (!cachedLines || cachedMtimeMs !== stat.mtimeMs) {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    if (lines.length > 0) {
      lines[0] = lines[0].replace(/^\uFEFF/, "");
    }
    cachedLines = lines.map((line) => line.trim()).filter(Boolean);
    cachedMtimeMs = stat.mtimeMs;
  }

  return cachedLines;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const debug = searchParams.get("debug") === "1";

  if (!query && !debug) {
    return NextResponse.json({ results: [] });
  }

  try {
    const lines = await loadBaseLines();
    if (debug) {
      return NextResponse.json({
        count: lines.length,
        sample: lines.slice(0, 5),
      });
    }
    const needle = query.toLowerCase();
    const results = lines.filter((line) =>
      line.toLowerCase().includes(needle)
    );
    const limited = results.slice(0, 200);
    return NextResponse.json({ results: limited });
  } catch (error) {
    return NextResponse.json(
      { error: "Не удалось прочитать базу данных (data/base.csv)." },
      { status: 500 }
    );
  }
}
