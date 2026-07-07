#!/usr/bin/env node
// =============================================================================
// 模擬 J-Alert プラグイン（動作確認用）
//
// 本物の SDR プラグイン（TCP JSONL 出力）の代わりに、同梱のサンプル津波電文
// (sample-tsunami.jsonl) を TCP:7355 で配信する。SDR 機材が無くても
//   模擬プラグイン → jalert-ws-bridge.mjs → オーバーレイ
// の一連の流れを Chrome で確認できる。
//
// 使い方:  node tools/demo/mock-plugin.mjs [--port 7355] [--interval 0]
//   --interval 0（既定）: 接続時に1回だけ送信
//   --interval N        : N 秒ごとに繰り返し送信
// =============================================================================

import net from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = new Map();
for (let i = 2; i < process.argv.length; i += 2) argv.set(process.argv[i], process.argv[i + 1]);
const PORT = Number(argv.get("--port") || 7355);
const INTERVAL = Number(argv.get("--interval") || 0);

const here = dirname(fileURLToPath(import.meta.url));
const LINE = readFileSync(join(here, "sample-tsunami.jsonl"), "utf8").trim();

const server = net.createServer((sock) => {
    console.log("[mock] client connected, sending sample telegram");
    sock.write(LINE + "\n");
    if (INTERVAL > 0) {
        const t = setInterval(() => { try { sock.write(LINE + "\n"); } catch { /* noop */ } }, INTERVAL * 1000);
        sock.on("close", () => clearInterval(t));
        sock.on("error", () => clearInterval(t));
    }
});
server.listen(PORT, "127.0.0.1", () => console.log(`[mock] listening: tcp://127.0.0.1:${PORT}  (本物のプラグインの代わり)`));
