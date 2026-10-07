# 開発ガイド

利用者向けの案内は[README](README.md)、実行結果は[VERIFICATION](VERIFICATION.md)を参照してください。

## 環境・発行

隣の`../AppDock.at365`に準備済みのローカルNode・TypeScript・Vite・React・Electron・Playwrightを使います。独立したグローバルツールや新規依存のインストールは不要です。

```powershell
.\publish.bat -Test
.\deploy.bat "AppDock.at365.exeが存在する配置先"
```

発行先は`publish/Applet.Gmail.at365/`です。deployは指定先の`extensions/Applet.Gmail.at365`へWeb資産を含めて再帰コピーし、全ファイルをSHA256照合します。引数を省略するとGit対象外の`deploy.local.txt`先頭行を使います。設定・ログイン領域は変更しません。Windows PowerShellのPS1はUTF-8 BOM、BATはCP932/CRLFで保存します。

## 開発起動と検証

ホストを`dev.bat run build`でビルドしてから、ルートの`start-dev.bat`を使います。`artifacts/gmail-dev`に隔離したAppDockを起動します。Gmailを開くコマンドから操作画面を表示できます。実利用のAppDockを更新・再起動する操作とは独立しています。

Gmail開発profileはハードウェアアクセラレーションをオフにします。`prepare-dev.cjs`が既存の他設定を保持したまま`host.hardwareAcceleration: false`を保存し、次回起動からソフトウェア描画を使用します。各GUI/portable/認証fixtureもGPUオフです。起動中のGPU設定は変わらないため、変更後はテスト用AppDockを完全終了して起動し直してください。

旧Webテストからログイン状態を引き継ぐ開発専用の操作:

```powershell
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\prepare-dev.cjs --import-test-profile
```

旧テストアプリと開発版を完全終了してから実行します。保存先が新規のときだけ、旧テストのアカウント一覧、Chromium保存領域、必要ならLocal Stateをローカルコピーします。元データは保持し、既存の開発アカウントには上書きしません。実利用への自動移行機能ではありません。

```powershell
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\test-gui.cjs
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\check-live.cjs
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\test-gui.cjs ..\AppDock.at365\publish\win-unpacked\AppDock.at365.exe
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\test-portable.cjs
..\AppDock.at365\.tools\node\24.21.0\node.exe scripts\test-auth-redirect.cjs ..\AppDock.at365\publish\win-unpacked\AppDock.at365.exe
```

`test-gui.cjs`は新しい隔離profileとHTTPSのオフラインfixtureだけを使います。`check-live.cjs`は明示的に開発用Gmailへ接続し、既存ログインの再利用・実DOMの識別子対応を確認して終了します。メール本文・件名・Cookie値は診断出力しません。実メールの到着確認には、利用者自身が送った開発用メールでの操作確認を別途行います。

## 構成と設計

0.2.1の未読/既読は受信トレイ行の`zE`/`yO`で判定し、どちらもない場合は未確認とします。`unread`と`read`は互いに重ならない識別子一覧で、本文を開いて状態を調べたり、既読に変更したりはしません。Gmailの[会話表示](https://support.google.com/mail/answer/5900?co=GENIE.Platform%3DDesktop&hl=ja)では行がスレッドに対応するため、個別メッセージの未読数とは区別します。

`InboxMonitor`は初回の未読を新着に取り込みます。`Arrival`に`unread: boolean | null`と`initial`を持たせ、同じスレッドの履歴を現在の行状態へ同期します。未クリアの新着を履歴の50件上限とは別のMapで管理し、確認できた未読スレッドだけをpendingへ計上します。新しい返信でも同じスレッドは1件。見えなくなった行は未確認、画面が非受信トレイの間は直前の件数を維持します。Mapも4096件を目安に非未読の古い項目を整理します。

通知は`notificationArrivals`の未読だけに限定します。既読/未読の変更だけで通知し直さず、クリア済みのスレッドは新しい返信等を検知するまで件数へ戻しません。同一起動中の再読込やフォルダー復帰は既存未読を再通知せず、監視OFF/ON・Applet再起動は初回取り込みをやり直します。確認範囲は受信トレイ先頭ページの可視行のみです。

Google認証の許可先には`https://accounts.youtube.com`も含めます。[GoogleChromeLabsのログイン用例外一覧](https://github.com/GoogleChromeLabs/managed-guest-testing)に掲載され、[GoogleのYouTubeヘルプ](https://support.google.com/youtube/answer/69961?hl=ja)にもサービス間のGoogleログイン連携が説明されています。任意のYouTubeページやワイルドカードには広げず、GmailのDOM観測先は`https://mail.google.com`のままです。manifestの変更はホスト起動時の再読込が必要です。

- `src/index.ts`: Node Applet。2秒ごとに画面観測結果を取得し、アカウント別判定・通知・パネル・トレイを更新。ページを再読み込みしてポーリングしません。
- `web/observer.js`: Gmail専用の読取処理。MutationObserverでDOMの世代を更新し、800ms静まった状態を読む。受信トレイ先頭ページのスレッド/最終メッセージIDと未読行フラグ、`.yW`の送信元・`.bog`の件名だけを取得。`.y2`プレビューや本文は対象外。詳細は最大40行・12KB、観測全体は55KBまでに制限し、詳細がない行も識別子で新着検知する。
- `src/monitor.ts`: 初回基準、先頭行への追加、未読スレッドのメッセージID更新、重複排除、アカウント別新着状態を処理。先頭の基準スレッドに返信が同時到着しても、スレッドIDで位置を照合する。ID履歴はセッション内・最大4096件を目安に保持し、2048件へ整理。型付き`Arrival`で検知数・送信元・件名・検知時刻・クリア済み状態を保持し、履歴は最大50件かつreport用JSON48KB以内。停止・監視OFFで消去する。
- `renderer/`: Reactの受信トレイ・新着一覧・アカウント設定。`ResizeObserver`でローカル画面の表示領域を`viewport`へ渡し、一覧/設定ではnullでWebContentsViewを隠す。背後のページは保持して監視する。
- ホストの[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md): 共通のBrowserWindow/WebContentsView、永続セッション、操作IPC、停止・破棄を担当。

既存のElectron表示テストで実ログインを確認でき、AppDockもElectronなのでWebContentsViewを採用しました。WebView2 Evergreenを別途導入する必要がなく、UI/起動/保存領域をホストに揃えられます。Gmail固有のセレクターと判定はAppletへ置き、ホストはWebサービスごとの宣言を受ける構成です。

0.2.0はAppDock 0.13.0の`report(..., data)`と`viewport`を使用します。送信元・件名はメモリー内のローカルUI向けreportへ渡し、診断には残しません。通知への詳細表示は`notificationDetails: false`を既定とし、通知設定変更では基準・履歴を消去しません。将来の本文取得→ローカルLLM→TTSは独立した取消可能なジョブとして扱い、DOM読取と通知を待たせません。検知したスレッド更新数と実メール件数は別の値です。
