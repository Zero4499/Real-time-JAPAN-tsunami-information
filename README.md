# リアルタイム津波情報
【2026/07/07】著作権侵害のリスクを避けるため、フォントをUDShinGoProからNoto Sans JPに変更しました。


このプロジェクトは、日本のテレビ局の津波情報パッケージを模倣するように設計されており、HTMLとJavaScriptを使用して開発されています。

【免責事項 / Disclaimer】
- 本プロジェクトは参考資料として提供されるものであり、動作の正確性や品質を保証するものではありません。
- 本プログラムの使用によって生じた損害や事故等について、制作者および提供者は一切の責任を負いません。
- 本プロジェクトは、P2P地震情報が提供する公開API https://www.p2pquake.net/develop/json_api_v2/ を利用しています。貴重なデータを提供されているP2P地震情報様に深く感謝申し上げます。
- 本コードは OpenAI-ChatGPT5.5 と Telezzz (https://x.com/@Telezzz_X) の共同作業により作成されました。


## J-Alert メッセージからの取り込み By serkenn in 2026/07/07

P2P地震情報のライブ受信に加えて、**J-ALERT（全国瞬時警報システム）で受信した津波電文**からの表示にも対応しています。以下の SDR プラグインが出力する JSONL を取り込みます。

- [sdrsharp-j-alert-plugin](https://github.com/serkenn/sdrsharp-j-alert-plugin)（SDR#）
- [sdrplusplus-j-alert-plugin](https://github.com/soltia48/sdrplusplus-j-alert-plugin)（SDR++）
- 参考: JSONL のデコード／閲覧に [J-ALERT_Viewer](https://github.com/serkenn/J-ALERT_Viewer)

各 JSONL 行の `xml` フィールドに含まれる気象庁津波XML（VTSE41: `Body > Tsunami > Forecast > Item`）を解析し、地点ごとの警報種別（大津波警報／津波警報／津波注意報）・第1波（到達予想時刻／状況）・最大予想高さを、P2P と同じ内部形式に正規化して既存の描画へ流します。津波予報・津波なしは表示対象外です。

### 使い方

ブラウザは生の TCP を直接読めないため、プラグインの TCP JSONL ソケットを WebSocket へ中継する薄いブリッジ（依存パッケージ不要 / Node.js 標準モジュールのみ）を同梱しています。

```sh
# プラグインの TCP JSONL 出力（既定 127.0.0.1:7355）を ws://127.0.0.1:7356 へ中継
node tools/jalert-ws-bridge.mjs
# ポートを変える場合:
node tools/jalert-ws-bridge.mjs --tcp-host 127.0.0.1 --tcp-port 7355 --ws-port 7356
```

オーバーレイ側は既定で `ws://127.0.0.1:7356` に接続します。別ポートにする場合は URL クエリで上書きできます（`?jalert=` を空にすると J-Alert 取り込みを無効化）。

```
JMA TSUNAMI.html?jalert=ws://127.0.0.1:7356
```

### 動作確認（SDR 実機なし）

`tools/demo/` の模擬プラグインとサンプル津波電文で、機材が無くても一連の流れを確認できます。

```sh
# ターミナル1: 模擬プラグイン（サンプル津波電文を TCP:7355 で配信）
node tools/demo/mock-plugin.mjs --interval 2
# ターミナル2: ブリッジ
node tools/jalert-ws-bridge.mjs
# その後、JMA TSUNAMI.html を Chrome で開く
```

### 表示の優先順位

P2P のライブ受信は維持したまま、**J-Alert 電文に警報等がある間はそれを優先表示**し、J-Alert 側が解除されると P2P の現況へ戻ります。JSONL に複数の津波電文がある場合は `packet_time` が最新のものを採用します。


https://github.com/user-attachments/assets/a152882a-a061-4a11-a4f2-69483d4b9680


<img width="2560" height="1440" alt="Screenshot 2026-07-07 08-09-04" src="https://github.com/user-attachments/assets/96fbc6ac-a62f-4ad3-91a3-287a9736eb42" />
<img width="2560" height="1368" alt="0fd842b6f563bfa040d2b16e13020275" src="https://github.com/user-attachments/assets/bfa08efb-b456-4fd4-b8d7-fb1a466322ae" />



