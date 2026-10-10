# 開発ガイド

利用者向けの案内は[README](README.md)、実行結果は[VERIFICATION](VERIFICATION.md)を参照してください。

## 環境・発行

0.9.2はAppDock 0.26.14以上が必要。登録音声はsnapshot.registeredSoundsから選びsetSoundへファイル名を渡す。枠/割り当てはPC専用、登録素材は共有という境界とファイル名・同名拒否の正本は[設定同期](../AppDock.at365/docs/settings-sync.md)。

0.6.0はAppDock 0.17.1が必要です。Gmailの「設定」タブはWebアカウントsnapshot.settingsとsetSettingを使用し、manifestの3つのboolean設定と履歴件数のselect設定をホストのsettings.jsonへ即時保存します。アカウント設定・監視処理は従来のものを使用します。test-accountsは双方向の設定同期、監視OFF/再開、再起動保持、不正なキー/値の拒否、900×640の設定画面も検証します。

0.5.2はAppDock 0.16.3が必要です。observer V7は本人のヘッダーリンクのaria-labelから名前とメールアドレスを読み、ログイン済みの/mail/u/N/でのみaccountNameを返します。日本語/英語のGoogleアカウント表示に対応し、名前がなければメールを使用、結果は60文字まで。送信者やアカウント選択メニューからは取得しません。ホストは仮名だけを一度更新し、手動renameを優先します。test-accountsは新規仮名/名前/メール/手動名/再起動を、test-ui-featuresは再フォーカスなしの連続切替を検証します。

隣の`../AppDock.at365`に準備済みのローカルNode・TypeScript・Vite・React・Electron・Playwrightを使います。独立したグローバルツールや新規依存のインストールは不要です。

```powershell
.\publish.bat -Test
.\deploy.bat "AppDock.at365.exeが存在する配置先"
```

発行先は`publish/Applet.Gmail.at365/`です。deployは指定先の`extensions/Applet.Gmail.at365`へWeb資産を含めて再帰コピーし、全ファイルをSHA256照合します。引数を省略するとGit対象外の`deploy.local.txt`先頭行を使います。設定・ログイン領域は変更しません。Windows PowerShellのPS1はUTF-8 BOM、BATはCP932/CRLFで保存します。

## 開発起動と検証

ホストを`dev.bat run build`でビルドしてから、ルートの`start-dev.bat`を使います。`.artifacts/gmail-dev`に隔離したAppDockを起動します。Gmailを開くコマンドから操作画面を表示できます。実利用のAppDockを更新・再起動する操作とは独立しています。

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

0.5.1はAppDock 0.16.1を必要とします。画像要求は当該sessionのcredentials:includeで行い、未認証の標準画像への置換を防ぎます。切替コマンドのcycleはopen/focusを呼びません。test-accountsは認証ポリシー/セッションのfixtureと、別Windowを前面にしたまま未表示/表示/最小化/非表示でコマンドを実行する検証を追加しました。画像比較はprobe-native-startup --duration=20000 --avatar-matchで、右上の画像領域だけをcapturePageし、匿名/ログイン済み取得と照合します。画像やURL/名前/認証値を診断出力せず、.artifacts/avatar-match-liveのローカル画像と数値を確認してください。

0.5.0はAppDock 0.16.0のmove/setMonitoringを使います。settingsの全体monitoringとreadの各枠monitoringをANDで判定し、monitoringResetsを受けたmonitorはONでもresetします。個別OFFの即時UIクリアと古いreportの抑制はホスト、検知・音・通知の抑制はAppletです。順番と個別監視はUUID/ログイン領域を保持してaccounts.jsonへ保存します。Reactの監視スイッチは即時表示し、保存失敗時に戻します。表示名はEnter保存と未保存変更の取消に対応します。

observer V6はGmailヘッダーのSignOutOptions/Googleアカウントリンク内の画像だけを読み取ります。送信者アイコンやアカウント選択メニューは対象外です。画像URLはlh3〜lh6.googleusercontent.comとlh3〜lh6.google.comに限定し、ホストのavatarOriginsで再検証します。URLは観測データ、取得後の64px画像はホストのメモリー内に置き、Node readへ画像バイトを送信しません。メール本文/プレビューは従来どおり対象外です。

`scripts/test-accounts.cjs [発行版EXE]`は既存形式の2枠を使い、画像表示/画像消失・更新、設定中だけの追加、上下操作と選択保持/循環順、個別OFF中も他方が監視すること、再開時の未読取り込み、入力の保持とEnter保存、再起動後の順番/監視/表示名、900×640のライト/ダーク、10枠上限、正常停止を検証します。

0.4.3のobserverは、実Gmailの`table.TB tr.TD > td.TC`の明示的な空状態も認識します。空の受信トレイでもready:trueを返すため、keepActiveの初期化と最後の削除の反映を継続できます。`.Dj .ts`の開始/終了/総数が1/総数/総数で、可視行と全識別子が一致する場合だけcomplete:trueとします。切り詰め・ID不明行はcomplete/rowsCompleteをfalseにし、全件を見た根拠にしません。

履歴にはcontextを付け、pendingContextsは50件の履歴上限とは独立して保持します。同じcontextのcompleteな一覧にないスレッドを履歴/件数から除去します。部分一覧では、同じ文書/contextで識別済みの可視行がすべて取得でき、共有行の順序が保たれた場合だけ、残っている下側の行より前の消失を除去します。境界から押し出された行、カテゴリ変更、未知の空状態、ID不明行は消失と断定しません。削除とアーカイブの区別はしません。復元だけで同じメールを再通知しません。

openItemがfalseでも、読み込み済みの受信トレイがreadyならnavigateを呼ばず直ちに案内します。受信トレイで更新中ならそのまま待ち、別フォルダー/本文からのみ受信トレイへ移動します。待機中も受信トレイ画面を表示します。正常に開く操作はopenItem完了後に表示を切り替えます。`test-ui-features.cjs`は実配布ホストで削除直後のクリックが2500ms未満・再ロードなし、最後の行の削除、日英の空状態、全件範囲/ページ範囲/ID不明の判定を確認します。

0.4.2はAppDock 0.15.2を必要とします。WindowsのNativeWinOcclusionと、Gmailページ自身のアクティブ状態を別々に対処します。manifestのkeepActive:trueは、observeOriginのobserverがready:trueを返した後にChromiumのEmulation.setFocusEmulationEnabledを適用します。DOMが準備済みでも受信処理の初期化は遅れるため、背景では30秒ごとに250msだけ解除して再適用し、同期開始・再開を促します。Windowsのフォーカスや選択アカウントは変えず、native focusがあるWebContentsではエミュレーションを解除して通常のfocus/blurを使います。同一文書のhash/history移動では状態を保ち、別文書への移動・認証・破棄ではタイマーと接続を解除します。

Playwrightは対象ページへ自動でfocus emulationを設定するため、rAF/paint/背景更新の試験だけでは通常起動の停止を見逃す場合があります。scripts/test-native-background.cjsはPlaywrightを使わず、DOMの準備完了より遅れて受信処理を初期化する2枠で、未表示更新・未読件数・hash/history移動・reload・認証時解除を確認します。--beforeは背景描画設定/keepActiveを外して更新開始の不足を確認、--packed-coreは発行したapp.asar内の実装を使用します。scripts/probe-native-startup.cjsは保存済み開発profileを通常起動して主プロセスのローカルInspectorだけから件数を記録します。--duration=30000で短い確認、--manualで自動終了なしの継続確認ができます。終了はstartup-action.jsonへJSON文字列のquitを指定し、親プロセスの強制停止を通常終了の代わりに使いません。Inspector接続先は開発profile内のstartup-inspector.txtへ一時保存し、終了時に削除します。Rendererへテストツールのfocus overrideは追加しません。

0.4.0はAppDock 0.15.0のsnapshot.darkでローカルReact画面のテーマを同期し、ライト/ダークの共通色をCSS変数で定義します。Gmail自身のDOM/CSSは書き換えません。アカウントsoundのnameは元ファイル名、fileはホスト管理のコピー先です。ホストは選択時にWAVを検証・コピーし、旧外部パスもstartで移行します。コピーに失敗した枠はsoundErrorを表示し、元設定を保持して実効的な音をOFFにします。再選択で復旧できます。

初回未表示のページではrAFが動いてもfirst-contentful-paintが発生しないことを追加診断しました。0.15.0の背景Windowは透明・全ディスプレイの外・非フォーカス・タスクバー非表示でshowInactiveし、初回のネイティブ描画を成立させます。操作Windowの非表示/最小化中もViewを背景へ移します。probe-visibilityはpaintの有無も比較し、test-backgroundのfixtureは初回描画を確認してから自身のfetch更新を開始します。これにより未表示時と非表示中のreload後の更新を検証します。実Gmailの初回描画は`check-live.cjs --startup-paint`で、操作UIを開く前に読み取りだけで確認できます。

test-ui-featuresはテーマの即時同期、設定のバージョンページと手動更新確認（通信はfixture）、通知音コピー後の元ファイル削除・再起動・旧設定のONを維持した移行も確認します。

0.3.0はAppDock 0.14.0の`openItem`、`cycle`、アカウント別sound、ウィンドウ状態保存を使います。`web/open-item.js`は明示的なローカルUI操作でのみ実行する関数式です。observerと同じisolated world 1001にJSON文字列のkeyを渡し、可視受信トレイ行をスレッドIDで探して件名部分をクリックします。Gmailの非公開URLを組み立てず、見つからない場合はfalseを返してUIが受信トレイへ案内します。対象が他フォルダー/本文中なら一度受信トレイへ移り、観測がreadyになるまで最大8秒待って再試行します。メールを開くとGmail自身が既読にする場合があります。クリア操作とは独立しています。

通知音はホストのアカウントsoundをreadで受け取り、`notificationArrivals`がある場合だけ`audio.play`を呼びます。デスクトップ通知の設定とは別条件で、toastには常にsilent:trueを指定します。WAV選択にはfile-dialog、設定/試聴/再生にはaudio capabilityが必要です。ホストの既存queueSoundを再利用し、UIやGmailページへ任意のファイル読み取り/Host APIを公開しません。初期値はenabled:false/file:""。soundはaccounts.json、位置・サイズはWindowStateStoreでwindow-state.jsonへ保存します。

`nextAccount`/`previousAccount`は安定した宣言コマンドでNodeから`webAccounts.cycle(1|-1)`を呼びます。ホストの既定shortcutへCtrl+Tab/Ctrl+Shift+Tabを追加し、ローカルUIとremote WebContentsのbefore-input-eventで自身のAppletの登録済みコマンドだけを実行します。利用者のキー変更/空配列を優先し、global指定済みのコマンドは重複実行を避けます。

`scripts/test-ui-features.cjs`はオフライン2アカウントで検索/未読絞り込み、同一IDのセッション別メールを開く操作、消えたメールの案内、Web画面/ローカル画面の既定キーとキー変更、音の独立ON/OFF・WAV選択/試聴・再起動保持、通常の位置/サイズと最大化復元を確認します。音声は無音WAV、実メールは使いません。発行版EXEを引数にできます。

0.2.2はAppDock 0.13.1の背景表示保持を必要とします。旧方式では非選択Viewを非表示・切り離しており、backgroundThrottling=falseでもrequestAnimationFrameが止まりました。新ホストは1つの非表示BrowserWindowに非選択Viewを可視・実寸で保持し、選択中だけ操作ウィンドウへ移します。Gmailのページを改変して可視性を偽装したり、フォーカスを順番に奪ったり、定期再読み込みしたりはしません。

`scripts/probe-visibility.cjs`は実アカウントを使わず、切り離し/非表示・重ね表示・一度も見せない親WindowでrAF/IntersectionObserverを比較します。`scripts/test-background.cjs`はオフラインHTTPS fixtureの状態を別の場所から更新し、ページ自身がfetch→rAFでDOMへ反映します。単にテスト側からDOMを直接書き換える検証とは区別し、初回未選択・非選択・新着一覧・×で非表示・最小化・停止を確認します。引数に発行win-unpacked EXEを指定できます。`check-live.cjs`も実Gmailを新着一覧の背景へ移し、メール状態を書き換えずrAFの応答を診断します。

0.2.1の未読/既読は受信トレイ行の`zE`/`yO`で判定し、どちらもない場合は未確認とします。`unread`と`read`は互いに重ならない識別子一覧で、本文を開いて状態を調べたり、既読に変更したりはしません。Gmailの[会話表示](https://support.google.com/mail/answer/5900?co=GENIE.Platform%3DDesktop&hl=ja)では行がスレッドに対応するため、個別メッセージの未読数とは区別します。

`InboxMonitor`は初回の未読を新着に取り込みます。`Arrival`に`unread: boolean | null`と`initial`を持たせ、同じスレッドの履歴を現在の行状態へ同期します。未クリアの新着を履歴の50件上限とは別のMapで管理し、確認できた未読スレッドだけをpendingへ計上します。新しい返信でも同じスレッドは1件。0.4.3では確認範囲からの消失を履歴と件数から除去し、それ以外の見えなくなった行は未確認、画面が非受信トレイの間は直前の件数を維持します。Mapも4096件を目安に非未読の古い項目を整理します。

通知は`notificationArrivals`の未読だけに限定します。既読/未読の変更だけで通知し直さず、クリア済みのスレッドは新しい返信等を検知するまで件数へ戻しません。同一起動中の再読込やフォルダー復帰は既存未読を再通知せず、監視OFF/ON・Applet再起動は初回取り込みをやり直します。確認範囲は受信トレイ先頭ページの可視行のみです。

Google認証の許可先には`https://accounts.youtube.com`も含めます。[GoogleChromeLabsのログイン用例外一覧](https://github.com/GoogleChromeLabs/managed-guest-testing)に掲載され、[GoogleのYouTubeヘルプ](https://support.google.com/youtube/answer/69961?hl=ja)にもサービス間のGoogleログイン連携が説明されています。任意のYouTubeページやワイルドカードには広げず、GmailのDOM観測先は`https://mail.google.com`のままです。manifestの変更はホスト起動時の再読込が必要です。

- `src/index.ts`: Node Applet。2秒ごとに画面観測結果を取得し、アカウント別判定・通知・パネル・トレイを更新。ページを再読み込みしてポーリングしません。
- `web/observer.js`: Gmail専用の読取処理。MutationObserverでDOMの世代を更新し、800ms静まった状態を読む。受信トレイ先頭ページのスレッド/最終メッセージIDと未読行フラグ、`.yW`の送信元・`.bog`の件名だけを取得。`.y2`プレビューや本文は対象外。詳細は最大40行・12KB、観測全体は55KBまでに制限し、詳細がない行も識別子で新着検知する。
- `src/monitor.ts`: 初回基準、先頭行への追加、未読スレッドのメッセージID更新、重複排除、アカウント別新着状態を処理。先頭の基準スレッドに返信が同時到着しても、スレッドIDで位置を照合する。ID履歴はセッション内・最大4096件を目安に保持し、2048件へ整理。型付き`Arrival`で検知数・送信元・件名・検知時刻・クリア済み状態を保持し、履歴は最大50件かつreport用JSON48KB以内。停止・監視OFFで消去する。
- `renderer/`: Reactの受信トレイ・新着一覧・アカウント設定。`ResizeObserver`でローカル画面の表示領域を`viewport`へ渡し、一覧/設定ではnullでWebContentsViewを隠す。背後のページは保持して監視する。
- ホストの[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md): 共通のBrowserWindow/WebContentsView、永続セッション、操作IPC、停止・破棄を担当。

既存のElectron表示テストで実ログインを確認でき、AppDockもElectronなのでWebContentsViewを採用しました。WebView2 Evergreenを別途導入する必要がなく、UI/起動/保存領域をホストに揃えられます。Gmail固有のセレクターと判定はAppletへ置き、ホストはWebサービスごとの宣言を受ける構成です。

0.2.0はAppDock 0.13.0の`report(..., data)`と`viewport`を使用します。送信元・件名はメモリー内のローカルUI向けreportへ渡し、診断には残しません。通知への詳細表示は`notificationDetails: false`を既定とし、通知設定変更では基準・履歴を消去しません。将来の本文取得→ローカルLLM→TTSは独立した取消可能なジョブとして扱い、DOM読取と通知を待たせません。検知したスレッド更新数と実メール件数は別の値です。

## 0.7.0のページ表示

最低AppDockは0.18.0です。manifestにpages capabilityとsource:web-accountsのgmailページ、既存openコマンドを宣言します。React UI・監視・通知は共用し、表示先とログイン済みViewの載せ替えはホストが担当します。表示方法はAppletの一般設定値と別にextensions.at365.gmail.pages.gmail.displayへ保存します。詳細は[ホストのAppletページAPI](../AppDock.at365/docs/applet-pages.md)を参照してください。

ホストのscripts/applet-pages-ui-test.cjsは本体ページを検証します。既存Gmailのtest-gui/test-accounts/test-ui-features/test-background/test-auth-redirectは表示方法をwindowへ明示し、Electron contextのpagesから独立UI WebContentsを取得します。WindowはcontentView内のUI所有関係で照合します。GUIを実行する前にホストとAppletをビルドし、試験中にout/mainを再生成しないでください。
0.8.0のローカルUIはアカウント数/切替バー/重複する監視状態を取り除きます。header高さとtoolbar高さを共通CSS変数にし、左側のaccount-list-spacerと右側mainに同じ高さを使います（受信トレイ64px、他タブ80px）。次/前のコマンドとキーは保持します。AppDockのscripts/ribbon-layout-ui-test.cjsでページ表示時、test-gui.cjsで別Window時の領域を確認します。

0.9.0はAppDock0.20.0のcontext.webAccounts.navigate(action)を利用し、4コマンドとUIの操作を同じホスト実装へ渡します。snapshot.navigationRevisionの変更で受信トレイタブへ戻ります。showToolbarは全タブのtoolbarとmain領域、account-list-offsetは受信トレイ基準の固定余白です。ビルド時にpackage.jsonの版をVite defineへ渡し、重複した版定数を持ちません。externalLinkSettingは自身のboolean設定を宣言し、確認チェックをホストの設定保存経路へ渡します。scripts/test-toolbar.cjsは通知オブジェクトのshow/外部アプリ呼出し/確認だけを隔離fixtureへ置き換え、実click handler・コマンド・WebContentsと永続設定を確認します。

新着一覧のunreadOnlyはmanifestのboolean設定として保存します。UIの「未読だけ」と「絞り込みを解除」、AppDock側設定は同じ値へ反映し、保存失敗時は下書きを戻します。監視・履歴・未読集計のデータは変更しません。

## 更新配布物の発行

`publish.bat`は通常の発行先を生成した後、兄弟のAppDockリポジトリにある`scripts/pack-applet-update.ps1`で`publish/update.json`と`publish/update.zip`を自動生成します。共通パッカーのビルドに.NET 10 SDKが必要です。Gmail以外のAppletは、このパッケージ生成のためにNode.jsを導入する必要はありません。

ZIP直下に`extension.json`と実行ファイル一式を置き、JSONにID・版・必要な本体版・ZIPのサイズとSHA256を記録します。`OutputDirectory`を指定できる発行スクリプトでも、指定先の配布内容を読み、更新用JSON/ZIPの出力先はこのリポジトリの`publish`です。通常配置用サブフォルダーへJSON/ZIPを混ぜず、`deploy.bat`の配置対象も増やしません。

Web配布やGitHub Releaseには同じ発行で生成したJSONとZIPを一緒に置き、JSONを最後に公開してください。ソースコードの自動生成ZIPは使用しません。発行スクリプトから外部公開は行いません。[共通更新仕様](../AppDock.at365/docs/updates.md)と[配布先の確認手順](../AppDock.at365/docs/update-checklist.md)を参照してください。

## 開発生成物の保存先

開発・テストの生成物は`.artifacts`へ保存します。2026-10-10に旧`artifacts`を中身を保持して改名しました。過去の検証記録内の当repoの`artifacts/`は`.artifacts/`へ読み替えてください。保存済みログ/JSONの内部パスは実行当時の値として保持しています。作業完了時の整理は[AppDockの共通手順](../AppDock.at365/DEVELOPMENT.md#作業完了時のテストフォルダー整理)に従い、実行中・状態不明・未解決の失敗記録・再利用する資料を保持します。
