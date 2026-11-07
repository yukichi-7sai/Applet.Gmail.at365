# 検証記録

## 2026-11-07 共通音ライブラリーと現行契約（0.13.0）

- 旧パネル送信とui capabilityを除去し、音の選択/表示/解除/試聴を本体の共通ライブラリーへ接続した。通知はnew-mailのpublish/endと共通audio.playを継続。旧転送容量に由来する行数・本文・履歴の切り捨てを除去し、利用者が選ぶ履歴保持件数を維持した。既存音と割り当ての移行は本体0.180.0が担当する。
- build/標準回帰26件、発行EXEのオフライン2アカウント試験、音声・通知GUIに成功。未使用音を含む移行、元ファイル不変、ID/名前/選択/ON・OFF、共通選択の取消・確定、OFF中の試聴、元音の変更・削除後の保管コピー、DOM新着/履歴/解除/停止・再起動を確認した。本体側の移行失敗/競合・再試行と2配置の同期試験も成功した。
- 古いGUI試験のMCP形式、管理コマンド・設定公開範囲、既定値省略保存、起動待ち、2つのリモート画面の識別と再有効化後のページ表示を現行契約へ修正して再検証した。初期失敗ログは保持する。実Googleログイン・実メールと物理音声出力は未確認。フルUI試験のうち変更に関係する音声モードと固定EXE移行試験を選び、無関係な全回帰は追加していない。
- 最低本体版引き上げでminor更新。publish.bat -Testで40.ARTIFACTへ発行し、manifest/feed/ZIPの版・最低本体版・サイズ・SHA256を照合した。証跡は`../AppDock.at365/.artifacts/legacy-api-retirement-20261107/`、コミット照合は同repoの`.artifacts/commit-validation-legacy-api-retirement-20261107/`。実利用データは変更しておらず、初回起動時の自動移行で引き継ぐ。mainでローカルコミットし、push・Release・実利用先配置は行わない。

## 2026-11-03 配置ツール整理のコミット前照合

- 実装時の最終差分と削除状態、試験入力・成功ログ・発行先185ファイルのSHA256を照合した。関連試験6件と構文・参照検査の成功を再利用し、追加の製品回帰・再発行は行っていない。
- 共通指示と本体・8Appletの今回差分だけをコミット対象とした。再利用判定、stage treeとcommit treeの照合結果は`../AppDock.at365/.artifacts/commit-validation-deploy-removal-20261103/`に保存する。push・Release・実利用先配置は行わない。

## 2026-11-03 開発用配置スクリプトの除去

- deployment一式と40.ARTIFACT内の配置用スクリプト・記入例・配置先設定を、存在する範囲で削除した。publishから専用コピー処理を外し、開発文書と不要なGit除外規則を整理した。
- 差分レビューで既存のビルドと更新ZIP/JSON生成を保持していることを確認した。変更スクリプトの構文・現行の廃止ファイル参照・git diff --checkと、本体を含む全9repoの発行先計算を確認した。発行先の配置ツール以外のファイルは削除前後のSHA256が一致した。
- 製品コード・manifest・依存・設定/保存仕様と配布payloadは変更していない。開発用配置ツールの整理として製品版更新・再ビルド・再発行なし。製品回帰・GUI・実利用先配置・commit・push・Releaseは実施していない。共通の削除一覧・ハッシュ・検証結果は../AppDock.at365/.artifacts/deploy-removal-20261103/を参照する。過去の検証記録は履歴として保持する。

## 2026-11-02 Applet共通実行場所のコミット前照合

- 利用者の受け入れとコミット依頼を受け、今回のテスト基盤/開発文書10ファイルをコミット対象として再確認した。変更はGUI/開発テストの起動・隔離設定で、製品コード・標準製品回帰・依存・SDKは不変。実装時の共通ヘルパー52件、8種類のprofile分離と関連するランチャー/GUIの成功ログを照合して再利用した。無関係な製品回帰の一律再実行は追加しない。
- 実装入力1,249件・配布物706ファイル・成功ログと保存対象6,347ファイルのハッシュが一致し、不要コピー55組の整理結果も維持されている。入力や対象機能の変更がないため成功結果を再利用する。版更新・publish・pushは追加しない。
- 証跡は本repoの`.artifacts/commit-validation-applet-shared-runtime-20261102/` の `validation.json`、`stage.json`、`commit.json`。共同の照合結果はAppDock側の同フォルダーの `reuse.json` を参照する。

## 2026-11-02 テスト実行場所の共通化

- AppDock本体の共通EXEを利用し、既存の`--test-profile`等で本repoの設定・data・必要なextensionsと結果・ログを分離する。対象スクリプト8本を切り替え、設定fixtureは現行のdata/settings.jsonへ揃えた。
- 発行済みmanifestを無効のまま隔離profileへ読み込み、同じ固定EXEとprofile内のChromium状態を実機確認。共通Electronランチャーによる外部profileの実機起動も確認。実Googleログイン・メール処理は実行していない。
- 不要と確認した旧成功コピー0組を整理した。ログ・設定・data・manifest・必要なfixtureは保持し、失敗・状態不明・保全用・固定build出力は削除しない。共通ヘルパーの52件、本体MCP7項目、8種類の分離・再起動保持、ランチャー2方式、ネイティブ2種類の検証結果と整理監査はAppDockの`.artifacts/applet-runtime-20261102/`を参照する。
- レビューではprofile境界・排他・配布物全体のSHA256・再起動・fixture保持・削除範囲を確認。テスト基盤と開発文書のみの変更で、製品の版更新・publishは対象外。コミット・pushは今回行わない。

## 2026-10-29: 情報metadataのコミット前照合

- icon/taglineと版の変更、配置manifest/entry、更新ZIP/feedを先行発行時の入力とSHA256へ照合し一致。本体0.101.9の固定EXEでも既存8Appletの情報表示を確認した。実装入力は不変で、先行の発行・表示試験を再利用し、追加の版更新・再発行は行わない。
- 共通レビューと再利用判断は`../AppDock.at365/.artifacts/commit-validation-applet-information-20261029/{review,reuse,validation}.json`、stage/commitとGitHub origin/mainの照合結果は同じ場所の`stage.json`・`commits.json`・`push.json`を参照する。先行の検証資料は保持。実サービス・実利用のApplet起動・GitHub Release・実利用deployは今回の検証対象外。

対象の現行版は`0.12.2`。以下は記録した条件での検証結果であり、外部サービスや実機条件の現在の動作保証とは区別する。

## 2026-10-29: Applet情報のアイコンとキャッチコピー 0.12.2

- main/追跡先とcleanを確認し、通常環境のpull --ff-only後に、manifestの任意表示情報 `icon: mail` と `tagline: メールの確認を、もっと身近に。` を設定。設定・コマンド・保存・権限・最低本体版は変更せず、0.12.1→0.12.2のパッチ更新として関連する版の正本を揃えた。発行前にmetadataと版の差分をレビューし、阻害事項なし。
- 標準publish.batで40.ARTIFACTへ発行。配置manifest/ZIP内manifest/feedのID・版・icon/tagline、ZIPのサイズ/SHA256を照合し成功。native/.NETはProductVersionも一致。本体0.101.6の固定EXEへ発行物をコピーし、停止状態で情報パネルの表示を確認した。通常のApplet起動や外部サービス・実入力は実行していない。
- 共通の入力・完全ログ・配布照合は`../AppDock.at365/.artifacts/applet-branding-20261029/`、本体の`VERIFICATION.md`、本repoの`.artifacts/applet-branding-20261029/validation.json`を参照。機能別の標準全回帰は今回実行せず、表示情報と配布の影響に必要な範囲を検証した。既存の再利用資料を保持し、今回の整理による削除なし。コミット/プッシュ/Release/実利用deployは行っていない。

## 2026-10-19: GitHub更新元の新アカウント対応（0.12.1）

- 開始時main／clean、現在のorigin/mainからpull --ff-only成功（Already up to date）。更新元を`yukichi-7sai/Applet.Gmail.at365`へ統一。updateRepository未登録を追加。publish.bat -Testの型検査・ビルドと標準25/25成功。

- 発行前レビューは指摘なし。設定項目・保存ファイル・公開APIの追加削除なしのためパッチ更新。既存publish.batで自身の40.ARTIFACT配下へ発行成功。ZIP/feed/同梱manifestのID・版・size・SHA256・runtimeの存在が一致。

- 最終AppDock 0.62.4 EXE（SHA256 043d72acd4f4176d0417bbc4166a111cecc5aaa7e8740baf21b8d6647b0e85ab）と最終Applet一式を隔離コピー。全6Appletを停止した状態で、保存済み旧指定の保持、新しい既定値の説明、版表示、「既定に戻す」後の画面／メモリ／settings.jsonの一致、停止状態維持を各Appletで確認。正常終了0。

- 証跡: `.artifacts/github-account-20261019/validation.json`。共通GUI/画像: `../AppDock.at365/.artifacts/applet-github-account-20261019/profile-1792345747763/`。入力hashは前後一致、hostはb27bd046b704e1a27ad31fdc2f481f80ea086b31。変更と無関係な全回帰・実アカウント・実Google受信・実GitHub Release取得・各機能の実Windows効果は未実施。今回と過去の成功/失敗・再利用資料を保持し削除0件。

- 本体のGitHub参照修正は先にb27bd04へコミット済み。今回のApplet変更は未コミット。push・Release・実利用先deployなし。
