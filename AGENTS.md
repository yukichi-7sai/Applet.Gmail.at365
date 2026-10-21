# Gmail Appletの作業ルール

実装時のテスト選択、コミット前の必要回帰、リリース前のコミット/プッシュ確認と検証証跡の再利用は、[本体・Applet共通手順](../AppDock.at365/docs/development-workflow.md)に従います。この文書の試験コマンドは、その段階に応じて実行します。

最初に[A:の入口](../../AGENTS.md)、[共通作業ルール](../AGENTS.md)、[AppDockの指示](../AppDock.at365/AGENTS.md)を読む。READMEはインストール方法とビルド方法だけとし、機能・操作・設定・既定値はdocs/usage.md、開発情報の入口はDEVELOPMENT、実測はVERIFICATIONへ保存する。

- ホスト共通の保存先・IPC・登録素材の仕様は[設定同期](../AppDock.at365/docs/settings-sync.md)と[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md)を正本にする。本文をこのrepoへ複製しない。
- Gmailはat365.googleアカウントグループを宣言する。名簿は共有data、ログイン・選択・監視・通知音割当はPC専用。同じグループのAppletだけが名簿と同じPCのsessionを共用する。WebApplet枠との共用は行わない。移行・復旧の正本は[グループ設計](../AppDock.at365/docs/web-account-groups-design.md)。
- 通知音はホストのsnapshot.registeredSoundsとsetSound/pickSound/testSoundを使う。ファイル名をIDにし、独自のID対応表を追加しない。同名別内容を自動上書き・自動改名しない。枠の削除で共有素材を削除しない。
- Nodeのaudio.playへ渡す通知音のファイル名はホストが自身のAppletの登録素材へ解決する。リモートGmailへNode/ホストAPIを公開しない。
- build/test/publishはAppDockのローカルNodeと既存publish.batを使う。実装完了時はGmailを版更新して自身の40.ARTIFACT配下へ発行する。commit/push/Release/deployは別の依頼に従う。
- 音声UIの変更ではtests、scripts/test-ui-features.cjs、ホストのsettings-sync-ui-test.cjsを確認する。GUIは隔離profileで直列実行し、ビルド中のout再生成と重ねない。実Googleログイン・実メール・実2PC同期とオフラインfixtureを区別する。

- 外部公開コマンドは自身のextension.jsonで宣言する。ホストへGmail専用の許可一覧を戻さない。契約は[共通操作API](../AppDock.at365/docs/automation.md#appletによる公開宣言)を参照する。

- 音声再生は[共通音声再生API](../AppDock.at365/docs/audio-playback.md)へ集約する。WAV未選択は無音。新着通知は宣言済みnew-mailとnotifications.publish/endを使い、旧showや独自プレイヤーへ戻さない。
