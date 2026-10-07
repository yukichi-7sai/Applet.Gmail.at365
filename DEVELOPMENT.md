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

Google認証の許可先には`https://accounts.youtube.com`も含めます。[GoogleChromeLabsのログイン用例外一覧](https://github.com/GoogleChromeLabs/managed-guest-testing)に掲載され、[GoogleのYouTubeヘルプ](https://support.google.com/youtube/answer/69961?hl=ja)にもサービス間のGoogleログイン連携が説明されています。任意のYouTubeページやワイルドカードには広げず、GmailのDOM観測先は`https://mail.google.com`のままです。manifestの変更はホスト起動時の再読込が必要です。

- `src/index.ts`: Node Applet。2秒ごとに画面観測結果を取得し、アカウント別判定・通知・パネル・トレイを更新。ページを再読み込みしてポーリングしません。
- `web/observer.js`: Gmail専用の読取処理。MutationObserverでDOMの世代を更新し、800ms静まった状態を読む。Gmailの受信トレイ先頭ページだけで、スレッド/最終メッセージIDと未読行フラグを取得。本文・送信元・件名は取得しない。
- `src/monitor.ts`: 初回基準、先頭行への追加、未読スレッドのメッセージID更新、重複排除、アカウント別新着状態を処理。ID履歴はセッション内・最大4096件を目安に保持し、2048件へ整理。
- `renderer/`: Reactのアカウント切替・保存名・Gmail操作UI。
- ホストの[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md): 共通のBrowserWindow/WebContentsView、永続セッション、操作IPC、停止・破棄を担当。

既存のElectron表示テストで実ログインを確認でき、AppDockもElectronなのでWebContentsViewを採用しました。WebView2 Evergreenを別途導入する必要がなく、UI/起動/保存領域をホストに揃えられます。Gmail固有のセレクターと判定はAppletへ置き、ホストはWebサービスごとの宣言を受ける構成です。

今後は観測結果を型付きのMailArrivalへ拡張し、件数・送信元・件名を段階的に追加します。本文取得→ローカルLLM→TTSは独立した取消可能なジョブとして扱い、DOM読取と通知を待たせません。バッチごとの新着判定と実メール件数は別の値です。
