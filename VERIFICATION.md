# 検証記録

## 2026-10-08: v0.6.0 Gmailウィンドウの設定タブ

- ユーザーが「うまくうごいた」と正常動作を報告し、コミットを明示指定（2026-10-08）。確認の詳細を個別項目まで推測せず、今回の設定タブ全体に対する動作確認として記録。検証済みコードに追加変更はない。

- 「アカウント設定」の隣へ「設定」を追加。新着監視・新着通知・送信元/件名表示と履歴の保存件数をホスト設定と共有し、即時保存・双方向同期。アカウント別監視・音は既存画面に保持。必要ホスト0.17.1。
- main/renderer型検査・Vite build・Gmail回帰21/21、ホスト型検査・回帰85/85成功。Prettierと両リポジトリのgit diff --check成功。
- 追加回帰で40件の未読を持つ状態から履歴を10件へ減らしても未読件数40を保持し、再観測で再通知せず、保存件数を増やしても消去した履歴を復元しないことを確認。以後の新着は新しい上限で保持する。
- 発行済みwin-unpackedホストでscripts/test-accounts.cjs成功: artifacts/accounts-1791452824168/result.json（ok:true）。4項目の既定値と履歴件数の選択・保存、Gmail→ホスト保存、ホスト→Gmail即時反映、未宣言キー/不正値拒否、全体監視OFFで全件クリア/ONで未読再取得、設定の再起動保持、900×640の設定画面を確認。既存の並べ替え・個別監視・名前・画像・テーマ・正常終了も成功。preferences-dark.png/history-limit-dark.pngを目視確認。
- 開発版の最初のGUI実行はビルドとの並行実行で生成済みnode-worker.jsが一時的に消え、途中の再起動で失敗した。発行完了後の固定した配布版で全試験を再実行し成功。
- 完成した単一EXE＋未改変Appletもartifacts/portable-1791452888173/result.jsonでok:true/host0.17.1/exitCode0。Gmailと対応ホストの発行済み。実利用先への配置・実アカウント操作・commit/pushは実施していない。

## 2026-10-08: v0.5.2 連続キー入力とログイン後の名前

- ホスト0.16.3と組み合わせ、Gmail内にフォーカスした初回切替後も、クリックし直さず次/前のキーを続けて使える。旧配布版の入力先消失を新しいGUI試験で再現してから修正。別Windowからの切替・未表示/非表示/最小化は前面とフォーカスを保持する。
- 初回/追加は「新しいアカウント」。observer V7が本人ヘッダーのaria-labelから名前（なければメール）を取得し、ホストが仮名のみ一度保存。手動renameはtemporaryName:falseとし、観測より優先する。旧番号名は互換対応。UUID/認証/選択/並び順/音/監視設定を保持。
- `publish.bat -Test`と最終build.cjs --test成功、main/renderer型検査・Vite・20/20回帰成功。ホストは92/92。最終配布版accounts-1791438434630で仮名、日本語名前、英語メールフォールバック、取得後の変更抑止、ログイン前の手動名、再起動保持、既存管理機能を確認。ui-features-1791438511879で次4回/前2回の再フォーカスなしの入力と変更キー、検索/未読/削除/音/テーマ/位置保存が成功。portable-1791438593328は未改変Appletと実単一EXE0.16.3、ok:true/exitCode0、停止・再開・正常終了成功。
- 実Gmailは保存済み開発ログイン2枠ともaccountNameDetected:true。既存accounts.jsonハッシュ不変、ログイン保持/GPUオフ、メール操作なし。diagnosticには本人名/メール/認証値を出力せず、artifacts/gmail-dev/live-result.jsonへ可否だけを保存。新規の実Googleログインからの自動改名、長期常駐/スリープは未確認。
- AppDock0.16.3/Gmail0.5.2を発行し、開発profileの資産だけ更新。実利用先deploy・commit・pushなし。追加fixtureのロード待ちと再起動後のlocator再取得を修正して最終成功。配布EXEハッシュ等は[ホスト検証記録](../AppDock.at365/VERIFICATION.md)を参照。

## 2026-10-08: 実利用先へのdeploy

- 配置後の実利用について、ユーザーが正常動作を確認したと報告（2026-10-08）。

- ユーザーの明示指示により、AppDockと全6Appletの`deploy.bat`を引数なしで実行し、7件すべて終了コード0。配置先は`A:\00.ESSENTIAL\00.MainTools\AppDock.at365`。5つの.NET Appletは現ソース/SDKで`publish.bat`を先に実行し、Gmailはdeploy内で再発行した。
- AppDock0.16.2、Gmail0.5.1、WallpaperSlideshow0.3.0、Watch0.1.1（native）、WebBrowserTools0.2.4、WindowMover0.2.1、WindowsTools0.1.1を配置。Watchの古いDLL版manifestを配置せず、現ソースのnative版へ更新。
- 配置対象21ファイルのSHA256はすべて発行元と一致。現ソースと配置manifestの版/runtime/entry、minimumHostVersionも照合。settings.json・avatar.png・Gmail accounts.jsonの3ファイルは配置前後のハッシュ不変。
- 配置前後とも関連プロセスなし。実利用アプリは起動していないため、次回起動で反映する。旧ファイル退避は行わず、設定・認証領域を配置スクリプトで変更していない。結果は`../AppDock.at365/artifacts/deploy-2026-10-08-result.json`（本体では`artifacts/deploy-2026-10-08-result.json`）。

## 2026-10-08: AppDock 0.16.2の依存更新に対する検証

- ホストのElectron 44.6.0、Vite 8.3.3、@vitejs/plugin-react 6.1.2、pnpm 12.10.1を使用。独自の外部npm依存はなく、ホストの共通依存を使用する。Gmailのバージョン/最低ホスト版/設定仕様は変更なし。
- `publish.bat -Test`で型検査・Vite・20/20回帰成功。オフラインのaccounts-1791435471926とui-features-1791435496597で画像/認証枠分離、前面を変えない切替、個別監視、検索/未読/削除反映、キー、テーマ、通知音コピー、順序/入力/位置/サイズの保存成功。
- `test-native-background.cjs --packed-core`のnative-background-1791435598245はPlaywrightなしの通常Electronで最終発行app.asarを使用。未表示2枠の初回描画・自身の状態更新・選択保持・reload・認証解除・終了成功。
- `test-portable.cjs`のportable-1791435656782は最終単一EXE0.16.2、ok:true/exitCode0。WebContentsView・到着判定・停止/再開・正常終了成功。実Gmailのメール/認証にはアクセスせず、実利用先deployなし。詳細は[本体検証記録](../AppDock.at365/VERIFICATION.md)を参照。

## 2026-10-08: 0.5.1 右上のアバター一致・切替のフォーカス保持

- 0.5.0の画像要求はcredentials:omitだった。実Gmailの右上画像URLを未認証で取り直すとGoogleの標準画像が返り、取得成功/PNG有無だけでは正しい画像の証拠にならなかった。AppDock 0.16.1は当該アカウント固有のsessionとcredentials:includeを使用する。転送先の厳密なorigin、最大3転送/5秒/64KBの境界は維持し、Cookie値をUI・Node・診断へ出力しない。
- 実Gmailの右上画像だけをcapturePageで切り出し、匿名取得/認証済み取得/修正後の画像を比較した。対象枠の未認証画像は860 bytesの標準画像、認証済み画像は8,411 bytesの設定済みアバター。修正後は右上と同じアバターを目視確認した（`artifacts/avatar-match-live/result.json`と同フォルダーの画像）。別枠は右上自体が標準画像で、両取得で一致した。名前・画像URL・Cookie・メール本文を診断へ出力せず、実メールの送信/削除/既読変更なし。
- 切替コマンドのcycleからopen/focusを除去。既存Viewとselectedだけを変更し、初回未表示はUIを作成せず、表示中でも前面に出さず、最小化/非表示を保持する。「Gmailを開く」の明示操作は従来の表示動作を維持する。
- 型検査/Vite、ホスト90/90・Gmail20/20成功。最終win-unpacked EXEの`artifacts/accounts-1791424612946/result.json`で、アカウントごとのCookie jarと画像要求の認証ポリシー、色の異なる画像の分離、未表示/表示/最小化/非表示で別Windowの前面/フォーカス保持、既存の並べ替え・監視・再起動・画像差替え・10枠上限を確認。custom protocolのRequestはCookieヘッダーを公開しないため、fixtureはnative要求の認証ポリシーと当該sessionのCookie jarでサーバーを再現する。
- 最終既存UI回帰: `artifacts/ui-features-1791424637416/result.json`（ローカル/remoteの既定・変更キー、検索/未読、メールを開く、音/テーマ/位置保存等）。最終単一EXE: `artifacts/portable-1791424613849/result.json`（本体0.16.1、exitCode0、停止/再開/正常終了）。新規試験の実行位置ミスを修正して全試験終了前だけに検証するよう直し、連続保存のWindows EPERMはfixtureの操作間隔を確保して再検証した。
- 最終EXE100,446,218 bytes、SHA256 `8D5243653108108368DD5E04CC2C12DCBA688B4C028D07A53E6CF2CFF02C4B7F`。.NET framework-dependentクリーン発行、Runtime混入なし。Gmail0.5.1は最低host0.16.1。開発用publish/extensionsへ全資産のSHA256を照合して配置。Prettier/diff check成功、関連文書のローカルリンク65件成功。既存の未配置GmailCheckerへの参照は確認不可。実利用先deploy/外部pushなし。長期常駐・スリープ復帰は未確認。

## 2026-10-08: 0.5.0 アカウント管理・アバター・個別監視

- AppDock 0.16.0とGmail 0.5.0。アカウントを上下に並べ替え、一覧と循環切替に保存順を使用。UUID・選択・ログイン領域・通知音を維持する。追加ボタンはアカウント設定中だけ表示し、追加後はログイン用の受信トレイへ移る。表示名はEnter保存・未保存変更の取消に対応。
- 個別監視は旧データも既定ON。OFFでは対象の履歴・件数・attentionを消去し、検知/通知/音を抑制する。他のアカウントとログイン/音の設定は維持。再開時は確認できる未読を取り込む。全体監視とのAND、read間のOFF→ONの基準reset、OFF後の古いreportの抑制も確認。
- ヘッダーのGoogleアカウント画像を取得し64px PNGとしてローカルUIだけへ渡す。実Gmailでlh3.googleusercontent.comとlh3.google.comを確認。後者は転送を含み、Session.fetchのmanual redirectは取消エラーだった。ClientRequestのredirectイベントで転送先を再検証する方式へ修正。Cookieなし、宣言済みの厳密なHTTPS origin、最大3転送、合計5秒、入力/出力64KBで制限し、削除・停止で取消。取得失敗時は先頭文字へ代替し、本文・プレビューは対象外。
- 最終型検査/Vite、Gmail回帰21/21、ホスト回帰90/90成功。最終win-unpacked EXEの`artifacts/accounts-1791404902870/result.json`で、転送を含む2画像・消失/差替え、設定中だけの追加、並べ替え/選択保持/循環順、個別OFF中の他方の新着、再開取り込み、入力保持/Enter、再起動後の設定保持、10枠上限、900×640のライト/ダーク、正常停止を確認。両テーマの画像を目視確認。
- 最終app.asarの通常Electron背景試験: `artifacts/native-background-1791404906576/result.json`。最終単一EXEと未改変Applet: `artifacts/portable-1791404908006/result.json`（本体0.16.0、exitCode0、停止/再開/正常終了）。既存検索・キー・通知音・テーマ等は中間配布版の`artifacts/ui-features-1791404353562/result.json`と`artifacts/gui-1791404385769/result.json`でも成功。portable試験の古い固定ホスト版はpackage.jsonの版との照合へ修正した。
- 実GmailはPlaywrightなしの通常起動・主プロセスInspectorの読取のみ。保存済み2アカウントの両画像を、UI未表示のまま取得できた（`artifacts/account-avatar-live.json`、avatars=[true,true]、monitoring=[true,true]、pending=[0,0]、GPUオフ）。メール送信・削除・既読変更・本文/認証値の出力なし。実新着を使う個別OFF/ON、長期常駐・スリープ復帰は未確認。
- 最終本体EXE100,447,550 bytes、SHA256 `55860971131436395A82378679A93AC6CF766A5B90F44CFC9936A14E3C423BB7`。.NETはframework-dependentクリーン発行、Runtime混入なし。開発用publish/extensionsへ全資産をSHA256照合して配置し、保存認証/GPUオフの通常テストアプリを起動。README/DEVELOPMENT/ホストAPI文書を更新、ローカルリンク88件・Prettier・git diff check成功。実利用先deploy・外部pushなし。

## 2026-10-08: 0.4.3 削除した新着の除去・見つからないメールの待ち時間

- 実Gmailの空状態は`table.TB tr.TD > td.TC`の「新着メールはありません。」だった。旧observerの`.aRv`だけではready:false/no-row-idsとなり、最後の削除後にpendingが残り、空状態で起動したアカウントのkeepActive初期化も始まらなかった。履歴も消失を未確認へ変えるだけで保持していた。UIはopenItem:false後に受信トレイを再ロードし、観測を最大8秒待っていた。
- 空状態と全件範囲の明示的な根拠を追加し、同じcontextの確認範囲から消えたスレッドを履歴と件数から除去。カテゴリ・並べ替え・ページ境界からの押し出し・不明な行を削除と断定しない。履歴上限より多いpending、同一スレッドへの複数返信履歴、クリア済み履歴も整理し、復元だけでは再通知しない。読み込み済みの受信トレイで見つからない場合は再ロードせず直ちに案内。別フォルダー/本文からの移動・更新中の待機は維持し、待機中は受信トレイを表示する。
- ユーザーの許可に基づき、開発用2アカウント間だけに固定のテストメールを計2通送信し、今回の受信メールだけをGmailの削除操作でゴミ箱へ移した。旧版: 行0/空状態ありでもready:false、pending1、該当履歴1（`artifacts/delete-test-0.4.2.json`）。修正版: 空状態のまま起動した未表示アカウントにも到着しpending1。削除後はready:true/complete:true、pending0、該当履歴0（`artifacts/delete-test-0.4.3.json`）。既存メールの削除・本文取得・認証値出力なし。ゴミ箱を空にする操作は行っていない。
- TypeScript main/renderer、Vite、回帰19/19成功。最終AppDock0.15.2 win-unpackedでのGUI: `artifacts/ui-features-1791402070870/result.json`。削除直後の開く操作は48msで案内、HTTP fixtureロード回数の増加なし。通常の別アカウントの同一IDを開く操作、最後の削除、日英の空状態、全件/ページ範囲・ID不明行、既存の検索/未読/キー/テーマ/通知音/保存/再起動が成功。正常に開く途中でWeb画面へ切り替える候補はGUI試験で失敗したため、openItem完了後の切替を保持した。旧バージョン情報に固定された試験の見出しを実行ホスト版に依存しない条件へ修正した。
- 本体の実装・版は0.15.2を維持、Gmailは0.4.3。開発配置のみ更新し、保存認証/GPUオフの通常テストアプリを起動。外部push/実利用先deployなし。削除/アーカイブの区別やページ範囲外の削除確定は行わず、不明な消失は履歴を保持する。長期常駐・実スリープ復帰は未確認。
- 最終単一EXEと未改変のGmail0.4.3: `artifacts/portable-1791402101133/result.json`（本体0.15.2、exitCode0）。Web分離、DOM到着、履歴UI、クリア、停止/再開、正常終了が成功。deploy.batは開発用配布先の全資産のSHA256を照合し、start-dev.batで同じ保存profileを通常起動した。BAT/PS1、本体EXE、セッション領域の移行処理は変更なし。

## 2026-10-08: 0.4.2 初回未表示の実受信と同期再開

- 0.4.1/AppDock0.15.1でも、未表示タブでは受信せず、その後表示しても反映せず、受信トレイへ/再読み込みだけで反映するとの報告。実利用EXEとmanifestの版を読み取り照合。ユーザーが2つ目の開発用アカウントをログインし、アカウント1/3をそれぞれメールアドレスへ改名した。ユーザーの送受信テストの指示を受け、その2アカウント間だけで固定の件名・本文のテストメールを計5通送信した。送信前にアカウント/宛先/件名/本文を照合し、既存メールの本文・認証値は取得せず、既読/未読の操作は行っていない。
- テスト01: 送信完了後179秒でも未表示側は未反映。受信側を表示・native focusしても191秒時点で未反映。背景へ戻してアクティブ状態を1回更新すると243秒時点で反映。テスト02は追加操作なしで20秒時点に反映した。paint/rAF（約110回/秒）/タイマー/オンライン状態/ページのfocusは維持されていても、Gmailの受信同期が始まらないケースを再現した。
- DOMのobserver.ready:true後にアクティブ化するだけの候補でも、テスト03は64秒時点で未反映。受信側を一度も表示せずアクティブ状態を更新すると133秒時点で反映。readyだけを同期開始の証拠にせず、背景で30秒ごとに250msだけ解除して再適用するホスト0.15.2を最終方式にした。操作中のnative focusはエミュレーションを解除し、通常のfocus/blurを優先する。画面の自動切替・Windowsフォーカス移動・定期reloadは行わない。
- 最終候補のテスト04: 再起動後、受信側を一度も表示せず15秒時点で新規行と未読新着を確認。テスト05: もう一度再起動し逆方向に送信。受信側未表示のまま、15秒時点では未反映、81秒時点で反映（正確な到着秒数はこの観測区間内）。背景周期に加えてGoogleの通信時間があるため、30秒以内の到着を保証するものではない。`artifacts/delivery-renewal-cold-start.json`、`artifacts/delivery-renewal-cold-reverse-later.json`、`artifacts/gmail-dev/startup-native-renewal-luna.json`、`artifacts/gmail-dev/startup-native-renewal-alice.json`に記録。両方ともGPUオフ、保存認証保持。
- 通常Electronのfixtureも、DOM準備後に受信処理が遅れて初期化される条件へ強化。初期化待ちだけの旧条件で失敗を確認後、2枠の背景同期/未読状態/hash・history移動/再読み込み/認証/正常破棄が成功。最終app.asar: `artifacts/native-background-1791399095693/result.json`。型検査/Vite、ホスト86/86・Gmail15/15成功。単一EXE: `artifacts/portable-1791399100255/result.json`（0.15.2、exitCode0、停止/再開/正常終了）。認証: `artifacts/auth-redirect-1791399111873/result.json`（Google/YouTube/日本向けGoogle/Workspace、GPUオフ、認証中の解除）。
- 最終EXE100,442,774 bytes、SHA256 `11D9CABB02DAF33388768D1E227DEB9DD1FEB990B1657EE4D03AAB203C8C4D95`。.NETはframework-dependent、Runtime混入なし。Gmail0.4.2は本体0.15.2も必要。開発配置のみ更新し、保存認証を保持したGPUオフの通常テストアプリを起動。外部push/実利用先deployなし。実長期常駐・実スリープ復帰は未確認。
- Windows画面操作ツールの初期化はhelper_unknown_errorで失敗。ユーザーによる完全終了後、開発アプリの主プロセスInspectorで対象アカウントとGmailの実DOMを照合して検証した。診断の--manualは自動終了なしとし、quit指示で正常終了する。途中の送信前チェックは宛先確定後の入力残りを検出して中止し、宛先1件と入力欄の空を確認してから送信したため、その失敗時の重複送信はない。

## 2026-10-08: 0.4.1 初回未表示の更新開始と終了エラー

- ユーザーが0.4.0/AppDock0.15.0でも、一度Web画面を表示した枠だけ更新されると報告。前回のPlaywright検証は自動のEmulation.setFocusEmulationEnabledにより通常起動のフォーカス条件を変えていた。前回のrAF/paint確認だけでは実Gmailの更新開始の証拠として不十分だった。
- Playwrightを使わない通常起動を追加。`artifacts/gmail-dev/startup-native-before.json`では、透明/画面外の実Gmailがfocus:false/painted:false、更新用sync完了0で止まった。WindowsのCalculateNativeWinOcclusionを無効にすると初回描画/sync3が成立するが、focus:falseのままでは新着が反映されないことも確認した。
- ユーザーが送った2通の開発用メールで比較。1通目は旧条件で表示/フォーカスだけでは反映されず、再読込後に15行/未読2として反映。2通目は描画条件を直しても未表示のままでは止まり、ページ内のアクティブ状態を有効にすると画面未表示のままsync3→6、15→16行、未読2→3へ更新した。WindowsのnativeFocus/親Windowのfocusはfalse、opacity0を維持。記録: `artifacts/gmail-dev/startup-native-mail-arrival.json`。メール本文/他の件名/認証値は取得・出力せず、既読・未読を操作していない。
- ホスト0.15.1とmanifest.keepActive:trueを実装。observeOriginのGmailだけをChromiumでアクティブにし、メインフレーム移動開始時/認証ページでは解除。WebページJS・認証・入力の偽装、画面/アカウントの自動切替は行わない。修正版の通常起動でも画面を開く前に16行/未読3/新着3を確認（GPUオフ、保存認証保持）。記録: `artifacts/gmail-dev/startup-native-probe.json`。実受信トレイは1枠、2枠目は認証待ち。実複数アカウント/長時間/スリープは未確認。
- 新しい通常起動fixtureの修正前条件: `artifacts/native-background-1791393028469/result.json`（更新開始の不足を再現）。最終発行コード: `artifacts/native-background-1791394005659/result.json`。テストツールのfocus overrideなしで2枠の初回描画/ページ自身のfetch更新・未読集計・選択保持・非表示reload・認証時解除・正常破棄を確認。
- ユーザーから終了時のエラー画像を受領。`WebContents.dispose`で`Object has been destroyed`。破棄後にwc.debuggerを取り直していた箇所を修正し、Debugger参照を生存中に保持、削除/停止前に明示解放する。対応する破棄済みgetterの回帰と、最終単一EXEの停止/再開/正常終了が成功。旧検証版の当該ダイアログは所有PIDとportable profileを照合して閉じた。
- 型検査/Vite、Gmail15/15・ホスト82/82成功。最終portable: `artifacts/portable-1791394017868/result.json`（0.15.1、exitCode0、終了ダイアログなし）。Google/YouTube/日本向けGoogle/Workspaceの認証とGmail限定のDebugger適用は配布EXEで確認。最終認証試験: `artifacts/auth-redirect-1791394123364/result.json`。
- 最終本体EXEは100,443,530 bytes、SHA256 `D246228B7F8EB393FAA51E4ECAC25E4BD85EED0914C851AE764B755382ADAB8F`。.NETはframework-dependent、Runtime混入なし。開発配置のみ更新。通常使用版は本体EXEも0.15.1へ更新する必要がある。

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
