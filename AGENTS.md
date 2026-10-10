# Gmail Appletの作業ルール

最初に[A:の入口](../../AGENTS.md)、[共通作業ルール](../AGENTS.md)、[AppDockの指示](../AppDock.at365/AGENTS.md)を読む。利用者向け説明はREADME、開発情報はDEVELOPMENT、実測はVERIFICATIONへ保存する。

- ホスト共通の保存先・IPC・登録素材の仕様は[設定同期](../AppDock.at365/docs/settings-sync.md)と[WebアカウントAPI](../AppDock.at365/docs/web-accounts.md)を正本にする。本文をこのrepoへ複製しない。
- Gmailの専用枠・ログイン・枠ごとの通知音割り当てはPC専用。WebApplet枠と共用しない。登録音声だけはAppDockフォルダー内で共有する。
- 通知音はホストのsnapshot.registeredSoundsとsetSound/pickSound/testSoundを使う。ファイル名をIDにし、独自のID対応表を追加しない。同名別内容を自動上書き・自動改名しない。枠の削除で共有素材を削除しない。
- Nodeのaudio.playへ渡す通知音のファイル名はホストが自身のAppletの登録素材へ解決する。リモートGmailへNode/ホストAPIを公開しない。
- build/test/publishはAppDockのローカルNodeと既存publish.batを使う。実装完了時はGmailを版更新して自身のpublishへ発行する。commit/push/Release/deployは別の依頼に従う。
- 音声UIの変更ではtests、scripts/test-ui-features.cjs、ホストのsettings-sync-ui-test.cjsを確認する。GUIは隔離profileで直列実行し、ビルド中のout再生成と重ねない。実Googleログイン・実メール・実2PC同期とオフラインfixtureを区別する。
