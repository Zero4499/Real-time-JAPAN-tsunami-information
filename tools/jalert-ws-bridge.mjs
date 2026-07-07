#!/usr/bin/env node
// =============================================================================
// J-Alert JSONL ブリッジ
//
// sdrsharp-j-alert-plugin / sdrplusplus-j-alert-plugin の TCP JSONL ソケットを
// WebSocket に中継し、ブラウザのオーバーレイ（JMA TSUNAMI.html）から受信できる
// ようにする。ブラウザは生の TCP を直接読めないため、この薄い中継が必要。
//
//     plugin (TCP :7355) ──▶ このブリッジ ──▶ ws://localhost:7356 ──▶ overlay
//
// Node 標準モジュールのみ（追加インストール不要）。サーバ→クライアント方向の
// テキストフレーム送信だけを実装した最小構成の WebSocket サーバ。
//
// 使い方:
//     node tools/jalert-ws-bridge.mjs
//     node tools/jalert-ws-bridge.mjs --tcp-host 127.0.0.1 --tcp-port 7355 --ws-port 7356
//
// オーバーレイ側は既定で ws://127.0.0.1:7356 に接続する。別ポートにする場合は
// "JMA TSUNAMI.html?jalert=ws://host:port" で上書きする。
// =============================================================================

import net from "node:net";
import http from "node:http";
import crypto from "node:crypto";

// --- 引数 ---
const argv = new Map();
for (let i = 2; i < process.argv.length; i += 2) argv.set(process.argv[i], process.argv[i + 1]);
const TCP_HOST = argv.get("--tcp-host") || "127.0.0.1";
const TCP_PORT = Number(argv.get("--tcp-port") || 7355);
const WS_PORT  = Number(argv.get("--ws-port")  || 7356);

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"; // RFC 6455 の固定 GUID
const clients = new Set();

// --- WebSocket サーバ（サーバ→クライアントのテキストフレームのみ実装）---
const server = http.createServer((_req, res) => { res.writeHead(426); res.end("Upgrade Required"); });
server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
    );
    clients.add(socket);
    console.log(`[ws] client connected (${clients.size})`);
    const drop = () => { if (clients.delete(socket)) console.log(`[ws] client left (${clients.size})`); };
    socket.on("close", drop);
    socket.on("error", drop);
    // クライアントからのフレームは基本無視。close フレーム(opcode 0x8)だけ検出して閉じる。
    socket.on("data", (buf) => { if (buf.length && (buf[0] & 0x0f) === 0x8) socket.end(); });
});
server.listen(WS_PORT, () => console.log(`[ws] listening: ws://localhost:${WS_PORT}`));

// テキスト(0x1)・FIN 立ての 1 フレームにエンコード（マスク無し = サーバ→クライアント）。
function encodeTextFrame(str) {
    const payload = Buffer.from(str, "utf8");
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
}

function broadcast(line) {
    const frame = encodeTextFrame(line);
    for (const c of clients) { try { c.write(frame); } catch (e) { /* 次回のerror/closeで掃除 */ } }
}

// --- TCP クライアント（プラグインへ接続し、JSONL 行を中継）---
function connectTcp() {
    const sock = net.connect(TCP_PORT, TCP_HOST, () => console.log(`[tcp] connected: ${TCP_HOST}:${TCP_PORT}`));
    sock.setEncoding("utf8");
    let buf = "";
    sock.on("data", (chunk) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (line) broadcast(line); // 1 JSONL 行 = 1 WebSocket メッセージ
        }
    });
    const retry = () => { console.log("[tcp] disconnected, retry in 5s..."); setTimeout(connectTcp, 5000); };
    sock.on("close", retry);
    sock.on("error", (e) => { console.log("[tcp] error:", e.message); sock.destroy(); });
}
connectTcp();
