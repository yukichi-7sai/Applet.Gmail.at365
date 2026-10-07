# 検証記録

## 2026-10-08: 0.4.0 テーマ・音声コピー・初回未表示の更新

- AppDock 0.15.0を最低ホスト版にし、Gmailの操作画面をホストのライト/ダーク/システムテーマへ即時同期。ヘッダーを封筒アイコンと整理した配色へ更新。Google側のWebページは変更しない。
- WAV選択時にホストのsounds領域へコピーし、元のファイル名を表示。旧外部パスはON/OFFを保って起動時に移行し、同じ内容は共有する。元ファイルがない場合は設定を保持して再選択を案内する。
- never-shown親WindowはrAFを進めてもfirst-contentful-paintが発生しないことを追加実測。透明・画面外・非フォーカスでshowInactiveすると初回描画が成立した。記録: `artifacts/visibility-1791387643491/result.json`。この描画不足を修正し、初回描画後に自身のfetch更新を始めるfixtureへ背景試験を強化した。
- main/renderer型検査・Vite・Gmail回帰15/15、ホスト回帰79/79成功。音声コピー/元の削除/重複排除、不正WAV、不要な管理ファイルだけの削除を検証。
- 配布版UI: `artifacts/ui-features-1791389267393/result.json`。テーマ3種の即時同期と実際の背景色一致、元WAV削除後の試聴/新着音/再起動、旧設定の音ON維持・コピー共有、検索/未読絞り込み、セッション別項目移動、切替キー/変更キー、位置/最大化復元を確認。設定のバージョンページは通信なしで表示し、クリック時だけ更新あり/最新版/未公開/未設定/HTTP503をfixtureで確認。ライト画面と最小サイズの通知音画面を目視確認。
- 配布版背景試験: `artifacts/background-1791389201924/result.json`。UIを一度も開く前に2枠とも初回描画が成立し、未選択枠のサーバーfixture変更→fetch→DOM→未読件数更新が成功。透明・全表示領域外・フォーカスなし、非表示中のreload後の初回描画、一覧/トレイ非表示/最小化、停止時の背景Window破棄も確認。
- 既存GUI: `artifacts/gui-1791389317671/result.json`。単一EXEと未改変Applet: `artifacts/portable-1791389361232/result.json`（version 0.15.0、exitCode 0）。ホスト設定の配布版検証: `../AppDock.at365/artifacts/navigation-1791389280500/result.json`。バージョンページへ移動して戻っても未保存の入力が残る。
- 保存済み実Gmailの読み取り診断: `artifacts/gmail-dev/live-result.json`。操作UIを開く前にログイン済み1枠の初回描画を確認。受信トレイ9行（未読2/既読7）、起動時新着2、認証保持/GPUオフ、remote Node/bridge非公開。2つ目の保存枠は受信トレイに到達しておらず、実複数アカウント・別ブラウザーからの実状態変更/実受信の同期はユーザー確認待ち。メール本文/認証値は取得・出力せず、既読/未読を操作していない。スリープ/長時間常駐も未確認。
- ホスト最終EXE: 100,441,388 bytes、SHA256 `AA28B2BC11EBD62333221B43D90F71302A1D49EB27652D242515D6F321093212`。.NETはframework-dependentクリーン発行、Runtime混入なし。開発用publish/extensionsへ配置・SHA256照合成功。既存profileを保持し、GPUオフの開発アプリを起動。実利用先への配置・外部pushは行っていない。
- 途中の追加検証は、ElectronのgetLastWebPreferencesがpartitionを返さないため背景Windowの識別が失敗。子Viewから特定し、停止時も実Window IDで検証するよう修正した。既存ナビゲーション試験の保存状態ラベルは非表示の同名要素と重複したため、可視の設定toolbarへ限定して成功した。

## 2026-10-07: 0.3.0 一覧の操作・位置保存・切替コマンド・個別通知音

- 新着一覧に未読だけの絞り込み、送信元/件名/アカウント名のNFKC・大小文字を吸収する検索、表示件数とアカウント範囲の未読新着数を追加。絞り込みで新着数/クリア範囲を変えない。項目を開く操作は該当セッションを選び、実際の受信トレイ行の件名をクリックする。非公開のthread URLを生成せず、見つからない場合は受信トレイへ案内する。
- AppDock 0.14.0へ共通itemOpener/cycle、ローカルUIのアカウント別sound選択/設定/試聴、WindowStateStoreによる位置/サイズ/最大化保存を追加。Gmailの最低ホスト版は0.14.0。次/前の安定したコマンドIDを追加し、既定Ctrl+Tab/Ctrl+Shift+TabはWeb画面とローカル画面双方へ適用。キー変更/空配列を保持し、global指定時の二重実行を避ける。
- 通知音は初期OFFで枠ごとに保存。デスクトップ通知とは独立した条件でaudio.playを呼び、Windows通知自身はsilent:true。未読新着と起動時未読だけ、1アカウントの1更新につき1回。監視OFF/音OFF/状態だけの変更は再生しない。WAV選択は取消で変更せず、試聴/標準音へ戻す操作を提供。
- main/renderer型検査・Vite・Gmail回帰15/15、ホスト回帰77/77成功。追加の音パス上限/制御文字/JSON引数のコード注入境界と、10枠の観測＋長い多バイト音パスでも1MB RPC内であることを再検証。回帰はWindows通知の無効時も選んだアカウントの音だけが呼ばれること、toastがsilent、安定したコマンドIDを確認。
- 配布win-unpacked版の追加GUI: `artifacts/ui-features-1791382644378/result.json`。同じthread IDを持つ2枠の正しいメールを開く操作、消えたメールの案内、検索/未読絞り込み、Web/ローカル画面のキーと変更後のCtrl+PageDown、循環コマンド/ボタン、WAV選択/試聴/標準音/OFF・再起動保持を確認。ホスト/Applet双方の通知OFFでも、音ONの枠だけ実音声プレーヤーが起動。無音PCM WAVを使い、再生/位置保存のエラーログなし。1050×760の通常枠と最大化を再起動復元し、900×640で通知音操作が横にはみ出さないことを確認。`sound-minimum.png`/`arrivals-wide.png`を目視確認。
- 既存の配布版GUI: `artifacts/gui-1791382808256/result.json`。未読件数/履歴、背景監視、アカウントCookie分離/再起動保持/削除、停止/再開、remote権限制限が成功。背景描画: `artifacts/background-1791382726283/result.json`（未選択・一覧の裏・トレイ非表示・最小化・停止）。単一EXEと未改変Applet: `artifacts/portable-1791382860793/result.json`（version 0.14.0、exitCode 0）。
- 統合試験の最初の失敗は、Playwright主プロセスでrequireが使えない点、制御されたチェックボックスの非同期反映、再起動時のfixture登録前のApplet有効化、消えたメールを消していないfixture、旧GUIのボタン名によるもの。主プロセスモジュールを差し替えず実プレーヤー生成を観測し、音ON/OFFを楽観反映＋失敗時復帰に変更。再起動前のテスト用無効化とfixture/操作名の修正後に上記が成功。
- ユーザーが開発用AppDockを完全終了後、既存profileを更新。実Gmailは認証保持/GPUオフ、既読7/未読0・新着0。`check-live.cjs --open-read-item`で既読と確認済みの行だけを開き、実Gmailの画面移動を確認して受信トレイへ戻した。本文/URL識別子/認証値は出力せず、未読のメールは操作していない。実データ上は2枠あり、受信トレイのDOM確認はログイン済みの1枠。裏側のrAF継続も確認。記録: `artifacts/gmail-dev/live-result.json`。実新着による音の聞こえ方・別ブラウザーからの状態変更/実受信の背景同期・実複数アカウント・スリープ/長時間常駐は未確認。
- 最終ホストEXE: 100,441,648 bytes、SHA256 `B13FD8556362975E7100DB443DC8C3FA50AF66F955CA4E2A8D329B5008F42B05`。.NETはframework-dependentクリーン発行でRuntime混入なし。開発用publish/extensionsへ配置して全ファイルSHA256を照合。実利用先への配置・外部pushは行っていない。

## 2026-10-07: 0.2.2 背景のGmail描画継続（AppDock 0.13.1）

- ユーザーが0.2.1の未読だけの新着集計を確認。「監視処理は動いていたが、非アクティブのGmail側が止まっていた」と補足。オフラインの`probe-visibility.cjs`で、native非表示/未接続のWebContentsViewではdocument.visibilityStateがvisibleでもrequestAnimationFrameが停止することを確認。非表示の背景BrowserWindowへViewをvisible・実サイズで接続すると継続する。記録: `artifacts/visibility-1791372924502/result.json`。
- ホストを0.13.1に更新し、非選択アカウント/新着一覧/アカウント設定中のViewを専用背景ウィンドウへ保持。Gmail 0.2.2はminimumHostVersionを0.13.1に引き上げる。ページのvisibility偽装・アカウントの順番切替・定期reloadは行わない。未読判定/初回取り込みのロジックは0.2.1を維持。
- main/renderer型検査・Vite build・Gmail回帰14/14、ホスト回帰75/75成功。新しい`test-background.cjs`は2アカウントのサーバーfixture変更をfetchしてページ自身のrequestAnimationFrameで反映する。UIを一度も開かない状態、未選択アカウント、新着一覧、トレイへ隠す、最小化で未読→既読→未読が同期し、選択は変わらない。停止時の背景ウィンドウ破棄も確認。発行版の記録: `artifacts/background-1791373818907/result.json`。初回の試験はremoteのURLロード前に調べて失敗したため、ロード/フレーム待機を修正した。
- 発行版GUI: `artifacts/gui-1791373823236/result.json`。起動時未読・未読集計/履歴・メタデータ・絞り込み/クリア・セッション保持/分離/削除・停止/再開・remote権限制限の既存検証も成功。portableと未改変Applet: `artifacts/portable-1791373893030/result.json`（AppDock 0.13.1、exitCode 0）。開発用publish/extensionsへの配置後に全ファイルSHA256一致を確認。
- 実開発Gmailは保存済み認証で受信トレイ7行（既読7/未読0）、件数0、GPUオフ。新着一覧へ移った裏側でもrequestAnimationFrameが実行されることを確認。診断は件数・状態だけでメール内容/認証値を出さず、実メールの既読/未読は変更していない。記録: `artifacts/gmail-dev/live-result.json`。別ブラウザーからの実既読/未読変更・実受信の背景同期はユーザー確認待ち。実複数アカウント・スリープ・長時間常駐は未確認。
- 以前の背景試験はDOMを直接変更しており、ページ自身の更新停止まで確認できなかった。今回のfetch→requestAnimationFrameの試験と分けて評価する。修正版の開発アプリを保存済み認証・GPUオフで起動して残した。実利用先への配置・外部pushは行っていない。

## 2026-10-07: 0.2.1 未読だけの新着件数・起動時未読の取り込み

- ユーザーが0.2.0について「いい感じに動いてる」と報告。その後の要望に合わせ、Gmailの行状態から未読/既読/未確認を表示し、新着の件数・トレイattention・通知を未読だけへ変更。起動/初回ログイン・監視再開時の未読を、その時点の新着として取り込む。
- スレッドIDで状態を同期し、同じスレッドへの複数返信は未読件数で1件。既読になると件数とattentionを下げ、履歴は残す。既読を未読に戻すだけでは再通知せず、クリア済みの同じメールも再計上しない。見えない行・未知のclassは未確認にして計上しない。非受信トレイ表示中は最後の状態を維持し、復帰時に同期する。読み取りのみで実メールの既読/未読を書き換えない。
- main/renderer型検査・Vite build・回帰14/14成功。初回未読、既読化、未読へ戻す操作、同一スレッド複数到着、未知/非表示行、クリア、reload重複通知なし、監視再開時取り込み、50件を超える未読の独立集計、通知内容/設定を検証。
- 発行版ホストでのGUI: `artifacts/gui-1791371519861/result.json`。実Electronのオフライン行class変更で未読→既読→未読に同期し、起動時未読の初期取り込み・2アカウント独立集計・履歴の状態表示を確認。`read-state.png`を目視確認。背景監視・絞り込み/クリア・Cookie保持/分離・削除/停止等の既存GUI検証も成功。
- 未改変Gmail 0.2.1とAppDock単一EXEの検証: `artifacts/portable-1791371819079/result.json`（ホスト0.13.0、exitCode 0）。未読新着のメタデータ・一覧表示・件数・クリア・停止/再開・remote分離・正常終了が成功。開発用publish/extensionsへ配置して全ファイルのSHA256照合も成功。
- 保存済みの実開発Gmail: ユーザーの完全終了確認後、認証保持・GPUオフで受信トレイ6行を読取。既読6・未読0・起動時履歴0・新着件数0を確認。件名/送信元/本文/認証値を診断へ出さず、実メールの状態は変更していない。結果: `artifacts/gmail-dev/live-result.json`。実未読の初期取り込み・実Gmail操作での既読化はユーザー操作待ちで、オフライン確認とは区別する。
- 最低ホストは0.13.0のまま。今回ホストソース/EXE・旧GmailCheckerは変更せず、Gmail 0.2.1を発行する。判定範囲は受信トレイ先頭ページの可視行で、スレッド内の個々の未読数/メールボックス全体の未読数は扱わない。

## 2026-10-07: 0.2.0 UI整備・送信元と件名の新着一覧

- 受信トレイ・新着一覧・アカウント設定へ画面を分け、アカウント別の状態と検知件数、一覧の絞り込み、名前の編集・確認付き削除を整備。履歴から該当アカウントの受信トレイへ移動できる。新着一覧/設定中はネイティブViewを隠し、背景の受信トレイを維持する。
- Gmail行の送信元・件名のみを抽出し、検知したスレッド更新を重複排除して数える。新規行と基準スレッドへの返信が同時に来るケースの数え漏れを修正。本文・プレビューは取得せず、履歴は起動中の最大50件/48KBまで。クリア時は履歴を残し、停止・監視OFFでは消去。通知への送信元・件名表示は既定OFF。
- main/renderer型検査・Vite build、Applet回帰11/11、ホスト回帰75/75（既存Node/.NET実プロセスを含む）成功。通知設定変更で基準・履歴を消さないこと、詳細通知の明示有効化、複数同時到着・重複排除・履歴サイズ上限、10枠の履歴を含めても監視のRPC容量を超えないことを確認。
- 開発GUI: `artifacts/gui-1791368076996/result.json`。発行版ホストGUI: `artifacts/gui-1791368517560/result.json`。送信元/件名、プレビュー除外、背景到着、一覧とGmailの切替、複数アカウントの絞り込み/選択中のみ・全体のクリア、受信トレイ移動、900×640、Cookie分離/再起動保持、削除、停止、remoteへのNode/IPC非公開を確認。画面のスクリーンショットを目視確認。途中のGUI検証は同時刻の一覧先頭を特定アカウントと仮定して失敗したため、対象件名の行を指定する検証へ修正した。
- 未改変Appletと最終単一EXE: `artifacts/portable-1791368914954/result.json`（AppDock 0.13.0、終了コード0）。新着のメタデータと一覧UI、クリア、停止/再開、remote分離が成功。通信量調整前の結果は`artifacts/portable-1791368451915/result.json`。認証経路の回帰: `artifacts/auth-redirect-1791368563012/result.json`。日本向けGoogle・YouTube認証・Workspaceログアウト/再ログイン、類似origin遮断、認証query非公開、GPU無効が成功。
- 許可済みの実開発Gmail: ユーザーの完全終了確認後、保存済みログインで復帰。実受信トレイ2行、送信元読取2行・件名読取2行、初回履歴0件、hardwareAcceleration=false、remote Node/bridge非公開を確認。診断には件名・送信元・本文・Cookie値を出していない。結果: `artifacts/gmail-dev/live-result.json`。今回の新着一覧への実メール到着、送信元の複数表示・転送メール等の精度、実返信、通知クリック/音、スリープ・長時間常駐は未確認。実Gmailでの到着→Windows通知は旧版でのユーザー確認として保持する。
- ホストとAppletの発行先はそれぞれ`../AppDock.at365/publish/AppDock.at365.exe`、`publish/Applet.Gmail.at365/`。最低ホスト版を0.13.0へ更新。README/開発ガイド/共通API文書も更新。実利用先への今回のdeploy・外部pushは行わず、開発用profileのログイン領域を保持する。

## 2026-10-07: 0.1.3 日本向けGoogle認証先

- テスト用AppDockのログインが`https://accounts.google.co.jp`への未対応転送として停止したとの報告。利用者から、確認中のアカウントはGoogle Workspaceアカウントとの追加情報を受領。Workspaceがこの転送を発生させた原因とは断定しない。
- Google公式のsupported_domainsに.google.co.jpが掲載され、accounts.google.co.jpの公開入口がaccounts.google.comの正式ログイン画面へ転送されることを確認。Gmail manifestと旧Webテストの許可先に、この正確な認証originを追加。GmailのobserveOrigin、HTTPS/資格情報/ポート/類似ドメインの境界、GPUオフを維持。
- 型検査/Vite/新Gmail8回帰、旧Webテストの型検査/Vite/2回帰成功。発行版ホストのオフライン302でGoogle→YouTube認証→accounts.google.co.jp→Google→Gmailを再現し、ログアウト/再ログイン、境界遮断、GPU無効も成功。結果: `artifacts/auth-redirect-1791365829812/result.json`。
- 実利用manifestを独自変更なしと照合して0.1.3へ原子的に更新し、発行元SHA256一致。ユーザーがテスト用AppDockを完全終了したことを確認し、0.1.3をGPUオフで起動してGmail画面を表示した。ログイン領域は保持。同日、ユーザーがGoogle Workspaceアカウントでログアウト→ログイン後、正常に受信トレイへ進めたと報告。GPUオフの開発版0.1.3で実ログアウト/再ログインをユーザー確認済み。

## 2026-10-07: 0.1.2 ログアウト後の移動先とテスト用GPUオフ

- 開発用テスト画面でのログアウト後、`https://workspace.google.com`への転送が未対応として遮断されたとの報告。Gmailの公式案内・ログイン入口があるoriginとして正確に追加。Gmail専用observeOriginを維持。旧Web表示テストにもYouTube認証先とWorkspaceの許可を反映。
- 利用者の指定で、新しいGmail開発profileと全Gmail GUI/portable/認証fixtureを`hardwareAcceleration: false`に変更。prepare-devはSettingsStoreで既存の他設定を保持し、起動前にGPUオフを保存する。旧独立Web表示テストはapp.readyより前にdisableHardwareAccelerationを呼ぶ。
- `publish.bat -Test`成功、型検査・Vite・8/8回帰成功。発行版ホストの認証GUIでYouTube経由ログイン、Workspaceへログアウト、Gmailへの再ログインをオフライン302で再現。`app.isHardwareAccelerationEnabled() === false`を実Electronで確認。類似origin遮断・認証query非公開・エラー解除も成功。結果: `artifacts/auth-redirect-1791365383107/result.json`。
- 旧Web表示テストのmain/renderer型検査・Vite・保存境界2/2成功。旧テストのオフラインGUIでGPU無効、アカウントCookie分離、再起動保持等を確認。結果: `../Applet.GmailChecker.at365/artifacts/web-fixture-1791365449444/result.json`。
- 実利用・開発配置のGmail manifestを0.1.2へ更新し、実利用先では独自変更なしと発行元SHA256一致を確認。ホストEXE・保存済みログイン領域は変更していない。
- 実Googleでのログアウト→再ログインは利用者確認待ち。GPUドライバとの相性問題の原因自体は今回独立診断していない。

## 2026-10-07: 0.1.1 Google認証のYouTube経由に対応

- 実利用環境で利用者自身がログインした際、`https://accounts.youtube.com`へのトップレベル転送を未対応として遮断したとの報告。Gmail Appletの`webAccounts.origins`にこの認証originが未宣言だったことを確認し、正確な1 originだけ追加。observeOriginはGmailのまま。ホストコード/EXEの変更は不要。
- `publish.bat -Test`成功。型検査・Vite build・既存新着判定7件＋認証先境界1件、8/8成功。YouTubeの通常サイト、類似ドメイン、HTTP、資格情報付きURL、非標準ポートは引き続き拒否。
- 発行版AppDock 0.12.0で`test-auth-redirect.cjs`成功。HTTPSのオフライン302転送をGoogle→accounts.youtube.com→Google→Gmailとして再現し、受信トレイの監視状態へ復帰。類似originの遮断、認証queryの非公開、再読み込み後のエラー解除も確認。結果: `artifacts/auth-redirect-1791364938676/result.json`（ok=true）。実Googleの認証リダイレクトを自動再現したものではない。
- 実利用先`A:\00.ESSENTIAL\00.MainTools\AppDock.at365\extensions\Applet.Gmail.at365\extension.json`を独自変更なしと照合したうえで原子的に更新し、発行元とのSHA256一致を確認。ホストsettings.jsonの前後SHA256一致。更新はmanifestだけで、ホストEXE・Appletコード・ログイン領域には触れていない。開発用の2配置先もmanifestを更新。
- 稼働中のホストは旧manifestを保持するため、利用者にAppDockの完全終了→起動し直しと、Gmailで「受信トレイ」からログインを続ける操作を案内。修正後の実ログイン完了は利用者確認待ち。

## 2026-10-07: 0.1.0 / AppDock 0.12.0

- TypeScript/Node AppletとReact操作画面を新しい`Applet.Gmail.at365`リポジトリに実装。旧`Applet.GmailChecker.at365`の追跡ファイルは変更せず、Web表示テストのUIを引き継いだ。
- `publish.bat -Test`成功。main/renderer型検査、Vite build、新着判定回帰7/7成功。初回基準、新着行、重複、既読変更、並べ替え、削除、古い行の追加、ログイン/再読込/フォルダー復帰、空状態からの初回受信、未読スレッドの最終メッセージID更新を検証。
- ホストの既存回帰70件＋Webアカウント境界3件、計73/73成功。宣言origin/capability、Web資産のディレクトリ境界と既存Node/.NETライフサイクルを確認。
- 開発版オフラインGUI: `artifacts/gui-1791363106731/result.json`（ok=true）。DOM新着、既読変更で通知しないこと、アカウントごとのCookie分離、表示名、再起動保持、非表示時の監視、削除時のCookie消去、停止時のWebContents破棄、リモートのNode/ホストbridge非公開を確認。
- 発行win-unpacked版GUI: `artifacts/gui-1791363761348/result.json`（ok=true）。上記に加え、未読スレッド返信、別フォルダーの監視休止/復帰時の基準再作成、900×640のウィンドウに対するWebContentsViewの236/146/664/494 DIPの位置・サイズを確認。ローカルUIとリモートfixtureの画像を別々に確認（ページのスクリーンショットは別WebContentsViewを含まない）。
- 完成した単一EXE＋未改変Applet: `artifacts/portable-1791363831174/result.json`（ok=true）。通信はCDPルーティングでオフラインfixtureへ差替え。Gmailを開くコマンドからの明示起動、WebContentsView、DOM新着、表示クリア、無効化/再有効化、リモート隔離、正常終了コード0を確認。
- 実Googleの開発用ログイン: 旧Webテストを停止した状態でアカウント一覧と保存領域を新しい開発profileへコピーし、元は保持。`check-live.cjs`で再入力なしに受信トレイを表示し、3行のスレッド/最終メッセージIDを読み取り、「受信トレイを監視中」を確認。診断は`artifacts/gmail-dev/live-result.json`。件名・本文・認証Cookie値は記録していない。
- AppDock 0.12.0のportable発行成功。EXEは100,437,305 bytes、SHA256 `7D9168E11D6194F2B87F689354D62A0D5E3AD83546947DF71C0732FDF76D7CC4`。
- 追加PS1はUTF-8 BOM、BATはCP932/CRLF。開発用profileと生成物はGit対象外。
- 最終発行後、`deploy.bat`で開発用`AppDock.at365/publish/extensions/Applet.Gmail.at365`へ7ファイルを配置し、スクリプトのSHA256照合成功。実利用先には配置していない。ログイン保持と実DOM解析も最終発行版で再確認。

### 現在の検証範囲

実Gmailの再起動後ログイン保持・受信トレイ表示・実DOM解析は確認済み。2026-10-07、ユキちゃん自身が試しにメールを送信し、Windowsの新着通知が表示されたことを報告。実メール到着から新着検知・通知表示までの動作をユーザー確認済みとして記録する。返信検知はオフラインDOM更新で検証したもので、**実スレッドへの返信、複数の実Googleアカウント、セッション失効後の再認証・組織独自SSO、空の実受信トレイ、Windows通知のクリック/音、スリープ復帰、長時間常駐**は未確認。画面差分による判定の制約はREADMEを参照。

実利用先へのAppDock更新・新Applet配置は行っていない。開発profileへの配置・起動と、プロジェクト内の発行物は別に扱う。
