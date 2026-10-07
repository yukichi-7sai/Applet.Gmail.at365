# 検証記録

## 2026-10-07: 0.1.3 日本向けGoogle認証先

- テスト用AppDockのログインが`https://accounts.google.co.jp`への未対応転送として停止したとの報告。利用者から、確認中のアカウントはGoogle Workspaceアカウントとの追加情報を受領。Workspaceがこの転送を発生させた原因とは断定しない。
- Google公式のsupported_domainsに.google.co.jpが掲載され、accounts.google.co.jpの公開入口がaccounts.google.comの正式ログイン画面へ転送されることを確認。Gmail manifestと旧Webテストの許可先に、この正確な認証originを追加。GmailのobserveOrigin、HTTPS/資格情報/ポート/類似ドメインの境界、GPUオフを維持。
- 型検査/Vite/新Gmail8回帰、旧Webテストの型検査/Vite/2回帰成功。発行版ホストのオフライン302でGoogle→YouTube認証→accounts.google.co.jp→Google→Gmailを再現し、ログアウト/再ログイン、境界遮断、GPU無効も成功。結果: `artifacts/auth-redirect-1791365829812/result.json`。
- 実利用manifestを独自変更なしと照合して0.1.3へ原子的に更新し、発行元SHA256一致。ユーザーがテスト用AppDockを完全終了したことを確認し、0.1.3をGPUオフで起動してGmail画面を表示した。ログイン領域は保持。Google Workspaceでの実ログイン完了はユーザー確認待ち。

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

実Gmailの再起動後ログイン保持・受信トレイ表示・実DOM解析は確認済み。2026-10-07、ユキちゃん自身が試しにメールを送信し、Windowsの新着通知が表示されたことを報告。実メール到着から新着検知・通知表示までの動作をユーザー確認済みとして記録する。返信検知はオフラインDOM更新で検証したもので、**実スレッドへの返信、複数の実Googleアカウント、Google再認証、空の実受信トレイ、Windows通知のクリック/音、スリープ復帰、長時間常駐**は未確認。画面差分による判定の制約はREADMEを参照。

実利用先へのAppDock更新・新Applet配置は行っていない。開発profileへの配置・起動と、プロジェクト内の発行物は別に扱う。
