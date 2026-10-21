# Gmail Applet 開発ガイド

機能・操作・設定と動作環境は[操作案内](docs/usage.md)、実測は[検証記録](VERIFICATION.md)を参照する。

## 本体との契約

manifestの最低本体版は0.56.0。Node/React Appletで、Web画面と永続sessionは本体の[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md)を使う。Googleアカウントグループat365.googleで名簿と同じPCのsessionを共有し、選択中アカウント・監視・通知音割り当てはGmail専用とする。

通知は宣言済みnew-mailと共通のnotifications.publish/end、音は共通audio.playへ渡す。リボンのバッジは監視中の未読の新着スレッド数を合算する。本文・プレビューは観測せず、Google側の既読状態を自動変更しない。AIによる通知文の生成は提供していない。

## ビルド・発行

隣のAppDock.at365に準備済みの固定Node・pnpm・TypeScript・Vite・Reactと.NET 10 SDKを使う。本repoで実行する。

```powershell
.\publish.bat -Test
```

発行先はA:/40.ARTIFACT/Applet.Gmail.at365。runtime資産とupdate.zip/update.jsonを生成する。配置時はAppDockを終了し、発行先のdeploy.batへ配置先を指定する。データ・認証・sessionと運用者所有の配置設定は保持する。[共通発行手順](../AppDock.at365/docs/publishing.md)を参照する。

## 構成

| 場所 | 責務 |
| --- | --- |
| src/index.ts | activate/deactivate、Webアカウント、コマンド、通知・バッジとの接続 |
| src/monitor.ts | 観測行からの新着・既読・消失、履歴と未読の集計 |
| web/observer.js | GmailのDOMから限定した観測情報を取得 |
| web/ | ローカル画面、アカウント、新着一覧と操作 |

観測は受信トレイの先頭ページを対象とし、不完全・識別不能な一覧から全件の消失を推定しない。監視OFFでは履歴・件数・通知音を停止し、再開時は未読を基準として取り込む。DOM由来の名前・アバター・通知本文をホストの権限や実行コードとして扱わない。

## 検証

publishの-Testでtests/*.test.cjsを実行する。monitor、navigation、runtime、ribbon-badgeの契約を対象とする。

- scripts/test-accounts.cjs: 枠の追加・名前・順序・監視・通知音と再起動保持。
- scripts/test-ui-features.cjs: 履歴、検索、設定、テーマと操作。対象画面のselectorは現在のホストと照合する。
- scripts/test-native-background.cjs: Playwrightのfocus emulationを使わず、非表示時の監視開始・継続を検証する。
- scripts/test-portable.cjs: 固定配布物との接続を確認する。

GUIは隔離profileで直列に行う。fixtureのDOM・擬似受信と、実Googleへのログイン・実メール・実スピーカー・実PC間同期を区別する。本体のout再生成や発行をGUI起動中に重ねない。

## 共通の運用

[Applet実装](../AppDock.at365/docs/applet-development.md)、[保存境界](../AppDock.at365/docs/settings-sync.md)、[共通通知](../AppDock.at365/docs/notifications.md)、[共通音声再生](../AppDock.at365/docs/audio-playback.md)、[実装・コミット・配布](../AppDock.at365/docs/development-workflow.md)、[文書方針](../AppDock.at365/docs/documentation.md)に従う。

## 通知と音の接続

既定はWindows通知、10秒、永続履歴。表示先・時間・読み上げはホストの共通通知設定で解決し、読み上げの既定OFFを維持する。

通知音のアカウント別ON/OFFは従来どおり独立。`notificationDetails`は表示・読み上げ本文だけに適用し、永続履歴はアカウント名・送信元・件名を含まない汎用要約にする。本文は基盤の上限に収める。

アカウントごとに直近の通知IDを保持する。次の新着では前の通知をwithdrawnとして終了し、新しいIDで発行する（新しいイベントの読み上げを失わない）。既読化で新着がなくなった場合と新着表示クリアはresolved、アカウント削除・監視OFF/リセット・発行OFFはwithdrawn。自然期限切れや利用者による終了後のend失敗は再発行しない。Applet停止・再起動時の終了と操作失効はホストの世代管理が担う。

通知音の未選択は無音として既存の空文字設定をそのまま読む。UIは「未選択（無音）」「選択を解除」とし、WAV未選択の試聴は無効にする。素材や共有設定を一括書換えしない。
