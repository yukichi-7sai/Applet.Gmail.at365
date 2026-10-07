# 検証記録

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

実Gmailの再起動後ログイン保持・受信トレイ表示・実DOM解析は確認済み。新着検知/返信はオフラインDOM更新で検証したもので、**実メール到着、複数の実Googleアカウント、Google再認証、空の実受信トレイ、Windows通知の実表示/クリック/音、スリープ復帰、長時間常駐**は未確認。画面差分による判定の制約はREADMEを参照。

実利用先へのAppDock更新・新Applet配置は行っていない。開発profileへの配置・起動と、プロジェクト内の発行物は別に扱う。
