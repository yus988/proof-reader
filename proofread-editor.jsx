import { useState, useRef, useCallback, useMemo } from "react";

/* ══════════════════════════════════════
   DATA
   ══════════════════════════════════════ */

const ORIGINAL = `Hapbeat の山崎です。今月はほぼ開発に集中し、Bluetooth 版のプロトタイプ、Hapbeat 無線版のユーザーの開発環境の形が見えてきました。

各種取組は以下のように分類します（無い場合は打ち消し線）。プロダクト関連：販売するプロダクト開発や進捗などイベント関連：イベントや展示会への出展報告や準備など検証・広報・その他：今後の方針に関する検討や広報活動など

プロダクト関連

Bluetooth（以後、BT）モデル基板設計〜基板動作確認

先月動作検証を行った各部品（FSC-BT1038A・ADAU1701JSTZ-RL・STM32F401RET6）を搭載した基板を設計し、動作確認まで終えました。 ひとまず最低限、BT で動作かつ DSP を適用させたプロトタイプはできそうです。

普段は JLCPCB のパーツリストで揃えるようにしていますが、今回の BT モジュール FSC-BT1038A は取り扱いがなく、JLCPCB の倉庫に郵送する必要がありました。Feasycom は中国のメーカーなので、直接届けてもらうことに。メーカーに JLCPCB の倉庫を発送先として登録し、決済は Alibaba で行いました。JLCPCB で Consigned Parts を使うのは初めてでしたが、このあたりもシステム化されていて大きなトラブルなく実現できました。

基板は発注後 13 日程度で到着。ひとまず書き込み〜 BT 経由で音出しまで確認できたので一安心です。プロトタイプはこの基板で試せそうです。ちなみに STM への書き込みは WeAct DAPLink STLink V2.1 で行いました。約 600 円・USB-C 対応・トラブルなく使えるので、STM 系マイコンを使っている方にはおすすめです。

【BT版基板】左：Duo 2 と BT版

ただ動作検証のときにかなりつまずきました。デバッガーの 3V3 電源をつないだ状態で電源 ON するとまともに音が聞こえるのですが、バッテリーのみで電源 ON すると音がガビガビに鳴る問題が発生しました。最初は ADAU1701 の起動順やクリスタル周りを疑っていましたが、最終的に問題があったのはヘッドホンアンプの TPA6132A2 でした。この KiCad シンボルの HPVDD が VDD と並列にされていたせいで、誤って電源につないでしまい、バッテリーのみだと出力に負の電圧が出ない状態となっていました。

kicad-symbols で提供されていたので鵜呑みにしていたのですが……間違ってはいないものの、自分ルールだと電源につなぐピンは上・GND につなぐピンは下にしているので、つい電源につないでしまったという経緯です。データシートにも HPVDD ピンの警告がちゃんと書かれているのですが、軽んじていました。幸い、電源への配線はパターンカットしやすい位置にあったので修正は容易で、プロト検証としては大きな問題ではありませんでしたが、次回基板で要修正です。

【基板やらかし】左：やらかした回路図／右：基板修正（物理）

従来の有線版 Duo 2 と異なり、DSP のフィルタ回路設計や BT 周りの接続処理、スマホ版アプリなど、ソフトウェアの工数が重いものの、このあたりは Claude Code や Codex などのおかげでなんとかなりそうなところが救いです。

Hapbeat SDK 開発

SDKアーキテクチャー

これまでの無線版についてはユーザー側で VSCode + PlatformIO をインストールしてもらい、ファームを書き込んでもらっていたのですが、さすがに今後ユーザーに使用していただくにあたり、労力的に現実的ではありません。 対象が組み込み系の開発者であればともかく、メインターゲットは Unity や TouchDesigner などのゲームエンジンやクリエイティブ系ソフトを使用する方々です。もちろんエンジニアの方であれば導入自体は難しくありませんが、環境構築が必要な時点で導入への心理的ハードルが上がるのは確実です。加えて、それに起因する Q&A のコミュニケーションコストが発生してしまうのは、双方にとって損でしかありません。

そこで、今後 XR コンテンツ開発者やクリエイターの方に使っていただくことを考えた場合、少なくとも現状の触覚デバイス程度の使用感で導入できるべきと考え、ファームウェアをまったく触らず GUI で Wi-Fi 接続や固有アドレスなどのデバイス設定や、再生する振動用音声波形の差し替えなどを行えるようにします。

また、ビジネスの場で利用される XR コンテンツ・アプリケーションはスタンドアロン VR HMD がスタンダードです。しかし、現状の ESP-NOW を用いた方法の場合、PC のように HMD の USB 端子からシリアル通信を行うことが難しい、という問題がありました。  そこで、ESP-NOW はオプションとして残しつつ、基本的には Wi-Fi UDP を利用することで、PC・VR HMD 両方で同じように稼働させることを目指します。この点が SDK 開発の一番の決め手となりました。

SDK 群のアーキテクチャーは以下の通りです。SDK は極力各種ゲームエンジンの仕様に依存せず、汎用的に使えるような設計となるよう心がけています。

SDK 群のアーキテクチャーは冒頭画像の通りです。SDK は極力各種ゲームエンジンの仕様に依存せず、汎用的に使えるような設計となるよう心がけています。

現状の開発進捗は以下の通りです。4 月中をめどにユーザーが使える状態にし、How-to ページの作成や Unity SDK 用のサンプルシーンを作成することを目標とします。

Studio：ディスプレイ編集および書き込みはOK。細かい点の改善は必要。波形エディタおよびライブラリ機能は開発始めの段階。

Manager：機能面ほぼ完成。後は実際に使いながら都度修正

SDK：まずは Unity を仕上げ、その後に Unreal Engine や Touch designer などに順次取り組む予定。Unity では Quest 2 での単独アプリでの動作を確認。

【開発中のSDK UI】左上：Manager／右上：Studio (Display editor） 左下：Studio (Wave editor）／右下：Unity SDK

スタンドアロンHMD（Quest 2）Wifi 接続での動作

ESP-NOW での音声ストリーミング

【動画】ESP-NOW streaming vs 有線遅延比較

前回のダンス検証時に、M5Stick を加速度ロガーとして使用した際、1 kHz のサンプルレートでも問題なく送れたことを機に、これなら音声データもストリーミングで送れるのではないかと思い、試してみました。

結果としては、かなり実用的である見込みとなりました。ESP モジュールが送信機として必要にはなりますが、ブロードキャストはもちろん、遅延についても、体感にはなりますが、最も低遅延な aptX Low Latency よりも低遅延、つまり 40 ms 未満は十分に実現できていることになります。有線と比べるとさすがに違いは分かりますが、無線で複数台に音声ストリーミングさせるのであれば最適解になるかもしれません（もちろん業務用放送機器であれば同等のことができるとは思いますが）。

BT 版の LE Audio がうまく使えるようになれば不要になるかもしれませんが、有償で提供すると Bluetooth SIG のライセンスが必要になる都合上、当面は ESP-NOW 方式でイベント活用などを行っていこうと思います。

結合パーツ／着脱の調整

【今回の試作ロット】嵌合時の感触や、取り付けやすさなどについては実物で試さないと分からない。

Hapbeat の損耗部をユーザーが交換できるように改良中です。リボンユニットとの結合パーツについては先月の設計どおり、モーターのボビンは糸やゴムを通す穴の部分に筋を入れ、ユーザーが糸通しなどを使わなくても手で交換できるようにしています。

こちらは試行錯誤中なので、設計が固まり次第、交換方法などの動画を撮影するとともに、今後の Hapbeat のスタンダードにする予定です。

検証・広報・その他

XR 施設視察

今後、Hapbeat を XR施設の事業者に提案していくにあたり、現時点で商用で稼働している XR 施設に市場調査という名目で、出張時に都合が良かった施設を３件ほど体験してきました。

TYFFONIUM（お台場）

【TYFFONIUM お台場店の施設写真】左上：店舗外観／中上・右上：フロント左下・中下：待合室／右下：体験場（怪獣のすみか）

TYFFONIUM お台場店では、Hapbeat と相性が良さそうな「かいじゅうのすみか VR」を体験してきました。

まず印象的だったのは、店舗の世界観です。いかにも中世の怪しげな魔法使いの館、といった雰囲気で、ここが非日常の空間であることを訴えかけています。XR の LBE については、XR 体験中だけではなく、その前後の体験も重要なのだと学びました。これは Apple 製品などが箱のデザインや、蓋を持ち上げた際に上箱が抜けきるまでの時間を計算して設計していることにも通じる内容だと感じました。

体験者はフロントでチケットを購入後、待合室にて待機。体験の準備ができたら、スタッフ 1 名が体験場にアテンドし、HMD などを装着、体験開始、という流れです。体験中は別のところに待機していたかと思われます。

「かいじゅうのすみか VR」は、惑星探索で怪獣を見つけて手持ちのレーダー（コントローラー）でスキャンする、というライド形式の体験です。プレイヤーは探索用のバギーに乗り、自動で進むアトラクション方式で、着座して体験する形式でした。ゲームに慣れない方でも問題ない程度のインタラクションでコンテンツへの集中度を担保しつつ、360° に広がる未知の惑星および生息する怪獣との邂逅が売りのコンテンツです。

椅子の裏には振動子が設置されていて、バギーの振動などに連動していました。振動としてはそこまでパワフルではなく、強弱の表現に限界が感じられたものの、ないよりはあったほうが段違いに体験が良くなることは間違いなく、開発者の方もそうした身体的な感覚に重きを置いていたのが伝わります。ただそれ以外のフィードバックはなく、特に怪獣が唸ったり目の前に現れた場合に触覚フィードバックがないのは、せっかく迫力のある映像なだけにもったいなく感じました。ぜひ Hapbeat を使っていただきたいと強く思います。

全体的にさすが商用と言えるほどきちんと作り込まれていると感じた一方で、体験時間や総合的な満足度からすると、2,500 円という金額は、遊園地のフリーパスと比較してしまっているからか、単体としてみると正直高いかなと感じる部分もあります。

Art Masters：プラド美術館所蔵品 VR 展

【Art Masters 施設写真】

Art Masters：プラド美術館所蔵品 VR 展では、プラド美術館を舞台に、館内を案内人である警備員と一緒にめぐり、5 つの代表的な絵画について、絵画にまつわるストーリーや絵画内の世界に入り込んで体感できる内容でした。所要時間はだいたい 30〜40 分程度で、絵画にあまり興味がない私でも、時間を忘れるくらい没入できて楽しい体験でした。

個人的に、広い空間でのフリーローム型 VR 体験の没入感は素晴らしいと感じました。コントローラーも持たず、HMD を装着して歩き回るだけなので、誰でも楽しめるのはもちろん、自分の脚で VR 空間内を歩き回ることができるのは、ライド式やコントローラー操作とは体験の質が一段上になります。

体験チケットは平日で 4,000 円と少々お高めですが、納得感のある価格だと思います。また東京タワーのチケットがあれば割引されて 2,500 円で入れたので、非常におすすめできるコンテンツです。

一方で、当然ながら触覚フィードバックはまったくありません。美術館探索ではそこまで相性が良くないのかなとも体験前は思っていましたが、実際に体験してみると、ハンドトラッキングのインタラクションのフィードバックや、絵画の世界の中での雨や燃焼といった感覚は、触覚フィードバックの有無で体験がかなり良くなるとも感じます。Hapbeat は装着が容易で装着者の動きを妨げず、30〜40 分程度なら負担にならないことが見込まれるので、フリーローム型の VR アトラクションとはとても相性が良いと感じます。前述のとおり、触覚フィードバックは有無の時点で大きく体験が変わるので、VR スーツだとオペレーション的に現実的ではないケースでも Hapbeat なら訴求できそうだと感じました。

今度、横浜の IMMERSIVE JOURNEY さんのコンテンツもぜひ体験しに行きたいと思いました。

RED° TOKYO TOWER

【RED° 主なVRアトラクション】左上：BOAT RACE／中上：RED° VR ADVENTURE／右上：VS 真田幸村下段：LEKE VR（Flying Cinema／Flash Racing／使用 VR HMD）

同じく東京タワー内にあるデジタルアミューズメント施設 RED° TOKYO TOWER に行きました。1 時間券なら 2,300 円なので、比較的気軽に体験できると思います。こちらは入場料だけで、一部のアトラクションを除きアトラクション体験し放題というのが特徴です。

今回 VR 作品としては、BOAT RACE※・VS 真田幸村・LEKE VR（Flying Cinema・Flash Racing）を体験してきました。全体の感想としてはいずれも 1 回 5〜10 分程度で、単体の体験としては不足感があるものの、入場料に包括されていることを加味すると十分満足できる印象です。平日夜はほとんど並ばずに体験できると思うので、満足感も高いかと。※BOAT RACE は RED° 内ではなく 1 階にあり、入場料ではなく回数券制です。この日は 1 回だけ無料キャンペーンが開催されていたので体験させていただきました。

特に目を引いた  LEKE VR（Flying Cinema・Flash Racing）については、中国発で「世界 40 か国以上に展開し、累計 7,000 万人以上がプレイしている世界的に人気のある VR ライド・アトラクションブランド」とのことです。Flying Cinema については「海底の旅」を体験しましたが、見た目どおりかなり激しく動き回るので、期待できる楽しさがありました。ただ、背中〜お尻を刺激するピストン系のアクチュエータが何を表しているのかよく分からなかったのと、駆動時のプシューという音が断続的にかなりの音量で発生していて、これほど騒音が大きくてコンテンツ体験を妨げても許容されるのかと、設計の豪快さに驚きがありました。Hapbeat の本体から出るノイズを不安に感じていましたが、もしかしたら杞憂に終わるかもしれません（笑）。一方、Flash Racing については一般的なVR体験に比べて、ハンドル操作できること以外の利点が感じられず残念でした。

これらの VR コンテンツ自体は、かなり画質が悪く、第一世代の VR 感があります。体感では Oculus Go よりも低画質に感じました。RED° に導入されたのは 2024 年とのことですが、コンテンツが開発されたのはもう 2、3 年前という印象です。使用されている VR HMD はおそらく下記の DPVR E3C か、それよりも古い型のようです。とはいえ、入場料に含まれるアトラクションなら十分だと思いますし、何より、大型筐体のおかげで体験が面白そうという期待感を動画で表現できるので、テーマパークへの集客という観点では一つの正解なのかなと思います。Hapbeat は目立ちにくい分、この点が弱いのが悩みです。

【RED° 施設写真】

ここまで VR アトラクションについて記述しましたが、施設としては VR メインではなく、さまざまなアクティビティを楽しめる総合型エンタメ施設といった色合いが強いです。館内は想像以上に広くて開放的で、HADO や VALO JUMP などのデジタル×スポーツのアトラクションが多く、一番イメージが近いのはラウンドワンのスポッチャだと感じました。友達と一緒に訪れるととても楽しめると思います。

【活用事例】株式会社シネマレイ様「衝撃デバイス連携体感型VR」

【衝撃デバイス連携体感型VR体験中の様子】

AI/DX 営業・マーケティング展にて出展されていた、株式会社シネマレイ様の「衝撃デバイス連携体感型 VR」を体験させていただきました。コンテンツとしては 360° 動画で、ヘリや自動車が接近する際の重低音を体験できるもので、シンプルかつ Hapbeat の効果が分かりやすいデモとなっていました。

現状は導入に向けていろいろと動かれているようです。さまざまな場面でも導入しやすくなるよう、SDK の開発を急ぎたいと思います。

4月の予定

hapbeat-sdk の開発、リリースできる直前まで

BT版のプロトタイプ開発、体験できるようにするまで

ここまでお読みいただきありがとうございます。少しでもご興味をお持ちいただけましたら Hapbeat X アカウントをフォローいただいたり、この記事を SNS 等でシェアしていただけると嬉しいです！まだ Hapbeat を未体験の方は、ぜひレンタルをお試しください！

法人のお客様も大歓迎です！Hapbeat の試用・ご購入、イベント活用、その他 Hapbeat に限らず触覚技術の活用にご興味がある場合はぜひ下記フォームよりご相談ください！`;


const CORRECTED_MD = `Hapbeat の山崎です。
今月はほぼ開発に集中しており、BT 版のプロトタイプと、無線版 Hapbeat のユーザー向け開発環境（SDK）の形が見えてきました。

各トピックは以下のカテゴリに分類しています（該当なしの場合は打ち消し線）。
プロダクト関連：販売するプロダクトの開発や進捗など
イベント関連：イベントや展示会への出展報告・準備など
検証・広報・その他：今後の方針に関する検討や広報活動など

プロダクト関連

**Bluetooth（以後、BT）モデル 基板設計〜動作確認**

先月動作検証を行った各部品（FSC-BT1038A・ADAU1701JSTZ-RL・STM32F401RET6）を搭載した基板を設計し、動作確認まで終えました。
ひとまず最低限、BT で動作しかつ DSP を適用したプロトタイプはできる見込みです。

普段は JLCPCB のパーツリストで部品を揃えるようにしていますが、今回の BT モジュール FSC-BT1038A は取り扱いがなく、JLCPCB の倉庫に郵送する必要がありました。
Feasycom は中国のメーカーなので、直接倉庫に届けてもらうことにしました。メーカーに JLCPCB の倉庫を発送先として登録し、決済は Alibaba で行いました。
JLCPCB で Consigned Parts を使うのは初めてでしたが、このあたりもシステム化されていて大きなトラブルなく実現できました。

基板は発注後 13 日程度で到着。ひとまず書き込み〜BT 経由で音出しまで確認できたので一安心です。
プロトタイプはこの基板で試せそうです。
ちなみに STM への書き込みは WeAct DAPLink STLink V2.1 で行いました。約 600 円・USB-C 対応・トラブルなく使えるので、STM 系マイコンを使っている方にはおすすめです。

【BT版基板】左：Duo 2 と BT版

**動作検証でのトラブル**

動作検証ではかなりつまずきました。
デバッガーの 3V3 電源をつないだ状態で電源 ON するとまともに音が聞こえるのですが、バッテリーのみで電源 ON すると音がガビガビに鳴る問題が発生しました。

最初は ADAU1701 の起動順やクリスタル周りを疑っていましたが、最終的に問題があったのはヘッドホンアンプの TPA6132A2 でした。
この KiCad シンボルでは HPVDD が VDD と並列に配置されていたため、誤って電源につないでしまい、バッテリーのみだと出力に負の電圧が出ない状態になっていました。

kicad-symbols で提供されていたシンボルなので鵜呑みにしていたのですが、自分ルールでは電源につなぐピンは上・GND につなぐピンは下にしているため、つい電源につないでしまったという経緯です。
データシートにも HPVDD ピンについて「DO NOT connect HPVDD directly to VDD or an external supply voltage」と警告が明記されているのですが、軽んじていました。
幸い、パターンカットしやすい位置にあったので修正は容易で、プロト検証としては大きな問題ではありませんでしたが、次回基板で要修正です。

【基板やらかし】左：やらかした回路図／右：基板修正（物理）

従来の有線版 Duo 2 と異なり、DSP のフィルタ回路設計や BT 周りの接続処理、スマホ版アプリなど、ソフトウェアの工数が重い一方、このあたりは Claude Code や Codex などのおかげでなんとかなりそうなところが救いです。

**Hapbeat SDK 開発**

SDK アーキテクチャー

これまでの無線版では、ユーザー側で VSCode + PlatformIO をインストールし、ファームウェアを書き込む必要がありました。
しかし、**メインターゲットは Unity や TouchDesigner などのゲームエンジン・クリエイティブ系ソフトを使用する方々**であり、組み込み開発の環境構築を前提とするのは現実的ではありません。
エンジニアの方であれば導入自体は難しくないものの、環境構築が必要な時点で心理的ハードルが上がるのは確実ですし、それに起因するサポート対応のコストも双方にとって損でしかありません。

そこで、少なくとも他社の触覚デバイス程度の手軽さで導入できるべきと判断しました。
具体的には、ファームウェアにはいっさい触れず、**GUI で Wi-Fi 接続・固有アドレスなどのデバイス設定や、振動用音声波形の差し替え**を行えるようにします。

また、ビジネスの場で利用される XR コンテンツでは、スタンドアロン VR HMD がスタンダードです。
しかし、従来の ESP-NOW を用いた方法では、スタンドアロン HMD から PC のようにシリアル通信を行うことが難しいという問題がありました。
**スタンドアロン HMD に対応できること**が SDK 開発の一番の決め手です。
ESP-NOW はオプションとして残しつつ、基本的には Wi-Fi UDP を利用することで、PC・VR HMD 両方で同じように動作させることを目指します。

SDK 群のアーキテクチャーは冒頭画像のとおりです。
各種ゲームエンジンの仕様に極力依存せず、汎用的に使える設計を心がけています。

開発進捗

現在の開発進捗は以下のとおりです。
4 月中をめどにユーザーが使える状態にし、How-to ページと Unity SDK 用サンプルシーンの作成を目標とします。

Studio：ディスプレイ編集および書き込みは完了。細かい改善は必要。波形エディタおよびライブラリ機能は開発初期の段階。

Manager：機能面はほぼ完成。あとは実際に使いながら都度修正。

SDK：まずは Unity を仕上げ、その後 Unreal Engine や TouchDesigner などに順次対応予定。Unity では Quest 2 でのスタンドアロンアプリでの動作を確認済み。

【開発中のSDK UI】左上：Manager／右上：Studio (Display editor） 左下：Studio (Wave editor）／右下：Unity SDK

スタンドアロン HMD（Quest 2）Wi-Fi 接続での動作

**ESP-NOW での音声ストリーミング**

【動画】ESP-NOW streaming vs 有線遅延比較

前回のダンス検証時に M5Stick を加速度ロガーとして使用した際、1 kHz のサンプルレートでも問題なく送れたことをきっかけに、音声データもストリーミングできるのではないかと思い試してみました。

結果としては、かなり実用的な見込みです。
ESP モジュールが送信機として必要にはなりますが、ブロードキャストに対応しており、遅延についても体感では最も低遅延な aptX Low Latency（公称 40 ms 未満）よりもさらに低遅延と感じられます。
有線と比べるとさすがに差は分かりますが、無線で複数台に同時配信するユースケースでは最適解になりうると考えています（業務用放送機器であれば同等のことは可能だと思いますが）。

BT 版の LE Audio がうまく使えるようになれば不要になるかもしれませんが、有償で提供すると Bluetooth SIG のライセンスが必要になる都合上、当面は ESP-NOW 方式でイベント活用などを進めていく予定です。

**結合パーツ／着脱の調整**

【今回の試作ロット】嵌合時の感触や、取り付けやすさなどについては実物で試さないと分からない。

Hapbeat の損耗部をユーザーが交換できるように改良中です。
リボンユニットとの結合パーツについては先月の設計どおり、モーターのボビンは糸やゴムを通す穴の部分に筋を入れ、ユーザーが糸通しなどを使わなくても手で交換できるようにしています。

こちらは試行錯誤中なので、設計が固まり次第、交換方法の動画を撮影するとともに、今後の Hapbeat のスタンダードにする予定です。

検証・広報・その他

**XR 施設視察**

今後 Hapbeat を XR 施設の事業者に提案していくにあたり、商用で稼働している XR 施設 3 件を市場調査として体験してきました。

**TYFFONIUM（お台場）**

【TYFFONIUM お台場店の施設写真】左上：店舗外観／中上・右上：フロント左下・中下：待合室／右下：体験場（怪獣のすみか）

TYFFONIUM お台場店では、Hapbeat と相性が良さそうな「かいじゅうのすみか VR」を体験しました。

まず印象的だったのは、店舗の世界観です。中世の怪しげな魔法使いの館といった雰囲気で、ここが非日常の空間であることを訴えかけています。
XR の LBE（Location-Based Entertainment）では、XR 体験そのものだけでなく、前後の演出も重要なのだと学びました。Apple 製品が箱のデザインや開封時の動きまで計算して設計しているのと通じるものがあります。

体験者はフロントでチケットを購入後、待合室で待機。準備ができたらスタッフ 1 名が体験場にアテンドし、HMD を装着して体験開始という流れです。

「かいじゅうのすみか VR」は、惑星探索で怪獣を見つけてレーダー（コントローラー）でスキャンするライド形式の体験です。
プレイヤーはバギーに乗って自動で進むアトラクション方式のため、ゲームに慣れない方でも問題ありません。適度なインタラクションでコンテンツへの集中度を保ちつつ、360° に広がる未知の惑星と怪獣との邂逅を楽しめるコンテンツです。

椅子の裏には振動子が設置されており、バギーの振動に連動していました。パワフルとは言えず強弱の表現に限界は感じましたが、ないよりはあったほうが段違いに体験が良くなるのは間違いありません。
ただ、怪獣が唸ったり目の前に現れたりする場面で触覚フィードバックがないのは、迫力のある映像だけにもったいなく感じました。ぜひ Hapbeat を使っていただきたいところです。

全体的にさすが商用と言えるほど作り込まれている一方、体験時間と満足度を考えると 2,500 円という価格は、遊園地のフリーパスと比較してしまうと正直やや高く感じる部分もあります。

**Art Masters：プラド美術館所蔵品 VR 展**

【Art Masters 施設写真】

プラド美術館を舞台に、案内人の警備員と一緒に館内をめぐり、5 つの代表的な絵画にまつわるストーリーや絵画内の世界に入り込んで体感できる内容です。
所要時間は 30〜40 分程度。絵画にあまり興味がない私でも時間を忘れるほど没入でき、楽しい体験でした。

特に印象的だったのは、フリーローム型 VR 体験の没入感です。
コントローラーを持たず HMD を装着して歩き回るだけなので誰でも楽しめますし、自分の脚で VR 空間内を移動できるのは、ライド式やコントローラー操作とは体験の質が一段上です。

チケットは平日 4,000 円と少々高めですが、納得感のある価格です。東京タワーのチケットがあれば 2,500 円に割引されるので、非常におすすめです。

一方、触覚フィードバックはまったくありません。美術館探索では相性が良くないかとも思っていましたが、実際に体験すると、ハンドトラッキングのフィードバックや、絵画の世界における雨・燃焼といった感覚は、触覚の有無で体験の質がかなり変わると感じました。
Hapbeat は装着が容易で動きを妨げず、30〜40 分程度なら負担になりません。フリーローム型 VR アトラクションとはとても相性が良く、VR スーツではオペレーション的に現実的でないケースでも Hapbeat なら訴求できそうです。

今度は横浜の IMMERSIVE JOURNEY のコンテンツもぜひ体験してみたいと思います。

**RED° TOKYO TOWER**

【RED° 主なVRアトラクション】左上：BOAT RACE／中上：RED° VR ADVENTURE／右上：VS 真田幸村下段：LEKE VR（Flying Cinema／Flash Racing／使用 VR HMD）

同じく東京タワー内にあるデジタルアミューズメント施設 RED° TOKYO TOWER にも行きました。
1 時間券 2,300 円で、一部を除きアトラクションが体験し放題です。

今回は BOAT RACE※・VS 真田幸村・LEKE VR（Flying Cinema・Flash Racing）を体験しました。
いずれも 1 回 5〜10 分程度で単体では物足りなさがあるものの、入場料に含まれることを考えると十分満足できます。平日夜はほぼ並ばずに体験できるのもポイントです。
※BOAT RACE は RED° 内ではなく 1 階にあり、回数券制。この日は無料キャンペーンで体験しました。

特に目を引いた LEKE VR は中国発のブランドで、世界 40 か国以上に展開し累計 7,000 万人以上がプレイしているとのことです。
Flying Cinema の「海底の旅」はかなり激しく動くライドで期待感がありましたが、背中〜お尻を刺激するピストン系アクチュエータが何を表現しているのか分かりにくく、駆動時のプシューという音もかなりの音量でした。コンテンツ体験を妨げるほどの騒音でも許容されているのかと、設計の豪快さに驚きました。
Hapbeat の駆動音を不安に感じていましたが、杞憂に終わるかもしれません（笑）。
一方、Flash Racing はハンドル操作以外の利点が感じられず、やや残念でした。

VR コンテンツ自体は画質が低く、第一世代の VR という印象です。
RED° への導入は 2024 年とのことですが、コンテンツの開発時期はそれより 2〜3 年前ではないかと思われます。使用されている VR HMD は DPVR E3C かそれ以前の型に見えました。
とはいえ、大型筐体のおかげで「体験が面白そう」という期待感を動画で訴求しやすく、テーマパークへの集客という観点では効果的な手法だと感じます。Hapbeat は目立ちにくい分、この点が課題です。

【RED° 施設写真】

なお、施設全体としては VR メインではなく、HADO や VALO JUMP などデジタル×スポーツ系アトラクションを中心とした総合型エンタメ施設です。
館内は広く開放的で、イメージとしてはラウンドワンのスポッチャが近いと感じました。友人と一緒なら十分楽しめると思います。

**【活用事例】株式会社シネマレイ様「衝撃デバイス連携体感型 VR」**

【衝撃デバイス連携体感型VR体験中の様子】

AI/DX 営業・マーケティング展にて、株式会社シネマレイ様の「衝撃デバイス連携体感型 VR」を体験させていただきました。
360° 動画でヘリや自動車が接近する際の重低音を体感できるコンテンツで、シンプルながら Hapbeat の効果が分かりやすいデモです。

現在、導入に向けて動いていただいているとのことです。さまざまな場面で導入しやすくなるよう、SDK の開発を急ぎたいと思います。

**4 月の予定**

hapbeat-sdk の開発：リリース直前まで持っていく

BT 版プロトタイプ：体験できる状態にする

ここまでお読みいただきありがとうございます。
少しでもご興味をお持ちいただけましたら、Hapbeat の X アカウントをフォローいただいたり、この記事を SNS などでシェアしていただけるとうれしいです。
まだ Hapbeat を体験されていない方は、ぜひレンタルをお試しください。

法人のお客様も大歓迎です。Hapbeat の試用・ご購入、イベント活用、その他触覚技術の活用にご興味がある場合は、ぜひ下記フォームよりご相談ください。`;


/* ── MD解析 ── */
function parseMd(md) {
  let plain = "";
  const bolds = [];
  let i = 0;
  while (i < md.length) {
    if (md[i] === "*" && md[i + 1] === "*") {
      const end = md.indexOf("**", i + 2);
      if (end >= 0) {
        const start = plain.length;
        const content = md.slice(i + 2, end);
        plain += content;
        bolds.push({ start, end: plain.length });
        i = end + 2;
        continue;
      }
    }
    plain += md[i];
    i++;
  }
  return { plain, bolds };
}

const { plain: CORRECTED, bolds: BOLD_RANGES } = parseMd(CORRECTED_MD);
const CORRECTED_MD_PARAS = CORRECTED_MD.split("\n\n");

/* ── アノテーション ── */
const ANNOTATIONS_DEF = [
  { origFrom: "今月はほぼ開発に集中し、Bluetooth 版のプロトタイプ、Hapbeat 無線版のユーザーの開発環境の形が見えてきました。", corrFrom: "今月はほぼ開発に集中しており、BT 版のプロトタイプと、無線版 Hapbeat のユーザー向け開発環境（SDK）の形が見えてきました。", reason: "「Bluetooth版」→「BT版」：直後に略称導入するため先取り。「開発環境」に「SDK」を補足" },
  { origFrom: "各種取組は以下のように分類します（無い場合は打ち消し線）。プロダクト関連：販売するプロダクト開発", corrFrom: "各トピックは以下のカテゴリに分類しています（該当なしの場合は打ち消し線）。\nプロダクト関連：販売するプロダクトの開発", reason: "「取組」→「トピック」。「無い」→「該当なし」。分類項目を改行で分離" },
  { origFrom: "BT で動作かつ DSP を適用させたプロトタイプはできそうです。", corrFrom: "BT で動作しかつ DSP を適用したプロトタイプはできる見込みです。", reason: "「適用させた」→「適用した」。「できそう」→「できる見込み」：トーン統一" },
  { origFrom: "ただ動作検証のときにかなりつまずきました。デバッガーの", corrFrom: "動作検証ではかなりつまずきました。\nデバッガーの", reason: "小見出し「動作検証でのトラブル」を追加。成果報告とトラブル報告を分離" },
  { origFrom: "この KiCad シンボルの HPVDD が VDD と並列にされていたせいで", corrFrom: "この KiCad シンボルでは HPVDD が VDD と並列に配置されていたため", reason: "シンボル上の配置の話であることを明確に" },
  { origFrom: "間違ってはいないものの、自分ルールだと", corrFrom: "自分ルールでは", reason: "「間違ってはいないものの」削除：シンボル自体の正否と誤配線は別の話" },
  { origFrom: "軽んじていました。幸い、電源への配線はパターンカット", corrFrom: "軽んじていました。\n幸い、パターンカット", reason: "改行追加。「電源への配線は」は文脈から自明なため削除" },
  { origFrom: "ファームを書き込んでもらっていたのですが、さすがに今後ユーザーに使用していただくにあたり、労力的に現実的ではありません。 対象が組み込み系の開発者であればともかく、メインターゲットは", corrFrom: "ファームウェアを書き込む必要がありました。\nしかし、**メインターゲットは", reason: "結論を先に。「ファーム」→「ファームウェア」。「労力的に現実的ではない」は後続で具体化するため省略" },
  { origFrom: "Q&A のコミュニケーションコスト", corrFrom: "サポート対応のコスト", reason: "「Q&A」→「サポート対応」：記事の文脈で適切" },
  { origFrom: "現状の触覚デバイス程度の使用感で導入できるべきと考え、ファームウェアをまったく触らず", corrFrom: "他社の触覚デバイス程度の手軽さで導入できるべきと判断しました。\n具体的には、ファームウェアにはいっさい触れず", reason: "一文を分割。「現状の」→「他社の」：比較対象を明確に" },
  { origFrom: "PC のように HMD の USB 端子からシリアル通信を行うことが難しい、という問題がありました。  そこで、ESP-NOW はオプションとして残しつつ、基本的には Wi-Fi UDP を利用することで、PC・VR HMD 両方で同じように稼働させることを目指します。この点が SDK 開発の一番の決め手となりました。", corrFrom: "スタンドアロン HMD から PC のようにシリアル通信を行うことが難しいという問題がありました。\n**スタンドアロン HMD に対応できること**が SDK 開発の一番の決め手です。\nESP-NOW はオプションとして残しつつ、基本的には Wi-Fi UDP を利用することで、PC・VR HMD 両方で同じように動作させることを目指します。", reason: "「この点」の指示先を明確化。HMD対応が決め手であることを先に。「稼働」→「動作」" },
  { origFrom: "SDK 群のアーキテクチャーは以下の通りです。SDK は極力各種ゲームエンジンの仕様に依存せず、汎用的に使えるような設計となるよう心がけています。\n\nSDK 群のアーキテクチャーは冒頭画像の通りです。", corrFrom: "SDK 群のアーキテクチャーは冒頭画像のとおりです。", reason: "重複段落を統合。「通り」→「とおり」" },
  { origFrom: "How-to ページの作成や Unity SDK 用のサンプルシーンを作成することを目標とします。", corrFrom: "How-to ページと Unity SDK 用サンプルシーンの作成を目標とします。", reason: "「作成」の重複を解消" },
  { origFrom: "書き込みはOK。", corrFrom: "書き込みは完了。", reason: "「OK」→「完了」：トーン統一" },
  { origFrom: "開発始めの段階。", corrFrom: "開発初期の段階。", reason: "「始め」→「初期」" },
  { origFrom: "後は実際に使いながら都度修正", corrFrom: "あとは実際に使いながら都度修正。", reason: "「後」→「あと」：形式名詞。句点補足" },
  { origFrom: "Touch designer など", corrFrom: "TouchDesigner など", reason: "公式表記（スペースなし）" },
  { origFrom: "単独アプリでの動作を確認。", corrFrom: "スタンドアロンアプリでの動作を確認済み。", reason: "「単独」→「スタンドアロン」：技術用語統一" },
  { origFrom: "Wifi 接続での動作", corrFrom: "Wi-Fi 接続での動作", reason: "「Wifi」→「Wi-Fi」：正式表記" },
  { origFrom: "送れたことを機に、これなら", corrFrom: "送れたことをきっかけに、音声データも", reason: "「を機に」→「をきっかけに」：より自然" },
  { origFrom: "最も低遅延な aptX Low Latency よりも低遅延、つまり 40 ms 未満は十分に実現できていることになります。", corrFrom: "最も低遅延な aptX Low Latency（公称 40 ms 未満）よりもさらに低遅延と感じられます。", reason: "aptX LL の遅延値を括弧で補足。体感ベースの表現に修正" },
  { origFrom: "XR施設の事業者に提案していくにあたり、現時点で商用で稼働している XR 施設に市場調査という名目で、出張時に都合が良かった施設を３件ほど体験してきました。", corrFrom: "XR 施設の事業者に提案していくにあたり、商用で稼働している XR 施設 3 件を市場調査として体験してきました。", reason: "全角数字→半角。「出張時に都合が良かった」は読者に不要な情報なので削除" },
  { origFrom: "体験してきました。\n\nまず印象的だったのは、店舗の世界観です。いかにも中世の怪しげな魔法使いの館、といった雰囲気", corrFrom: "体験しました。\n\nまず印象的だったのは、店舗の世界観です。中世の怪しげな魔法使いの館といった雰囲気", reason: "「いかにも」削除：ややカジュアル" },
  { origFrom: "箱のデザインや、蓋を持ち上げた際に上箱が抜けきるまでの時間を計算して設計している", corrFrom: "箱のデザインや開封時の動きまで計算して設計している", reason: "冗長な説明を簡潔に" },
  { origFrom: "この記事を SNS 等でシェアしていただけると嬉しいです！まだ Hapbeat を未体験の方は", corrFrom: "この記事を SNS などでシェアしていただけるとうれしいです。\nまだ Hapbeat を体験されていない方は", reason: "「等」→「など」、「嬉しい」→「うれしい」、「！」→「。」、「未体験」→「体験されていない」" },
  { origFrom: "法人のお客様も大歓迎です！", corrFrom: "法人のお客様も大歓迎です。", reason: "「！」→「。」：閉じの段落はさらっと" },
];


function buildPosAnns() {
  const anns = [];
  for (const a of ANNOTATIONS_DEF) {
    const oi = ORIGINAL.indexOf(a.origFrom);
    const ci = CORRECTED.indexOf(a.corrFrom);
    if (oi >= 0) anns.push({ start: oi, end: oi + a.origFrom.length, side: "orig", reason: a.reason });
    if (ci >= 0) anns.push({ start: ci, end: ci + a.corrFrom.length, side: "corr", reason: a.reason });
  }
  return anns;
}
const POS_ANNS = buildPosAnns();

function getReason(side, posStart, posEnd) {
  for (const a of POS_ANNS) {
    if (a.side === side && posStart < a.end && posEnd > a.start) return a.reason;
  }
  return null;
}

/* ══════════════════════════════════════
   DIFF ENGINE
   ══════════════════════════════════════ */

function computeDiff(oldText, newText) {
  const oldC = [...oldText], newC = [...newText];
  const m = oldC.length, n = newC.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldC[i - 1] === newC[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const raw = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldC[i - 1] === newC[j - 1]) { raw.unshift({ type: "same", char: oldC[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { raw.unshift({ type: "add", char: newC[j - 1] }); j--; }
    else { raw.unshift({ type: "del", char: oldC[i - 1] }); i--; }
  }
  const merged = [];
  for (const r of raw) {
    if (merged.length && merged[merged.length - 1].type === r.type) merged[merged.length - 1].text += r.char;
    else merged.push({ type: r.type, text: r.char });
  }
  return merged;
}

function annotateDiff(diff) {
  let origPos = 0, corrPos = 0;
  const result = [];
  for (const d of diff) {
    const len = d.text.length;
    if (d.type === "del") {
      const reason = getReason("orig", origPos, origPos + len);
      result.push({ ...d, reason, bold: false });
      origPos += len;
    } else {
      const startCorr = corrPos;
      const cuts = new Set([0, len]);
      for (const b of BOLD_RANGES) {
        const rs = b.start - startCorr, re = b.end - startCorr;
        if (rs > 0 && rs < len) cuts.add(rs);
        if (re > 0 && re < len) cuts.add(re);
      }
      const sorted = [...cuts].sort((a, b) => a - b);
      for (let k = 0; k < sorted.length - 1; k++) {
        const from = sorted[k], to = sorted[k + 1];
        const subText = d.text.slice(from, to);
        if (!subText) continue;
        const absFrom = startCorr + from, absTo = startCorr + to;
        let bold = false;
        for (const b of BOLD_RANGES) { if (absFrom >= b.start && absTo <= b.end) { bold = true; break; } }
        const reason = d.type === "add" ? getReason("corr", absFrom, absTo) : null;
        result.push({ type: d.type, text: subText, reason, bold });
      }
      corrPos += len;
      if (d.type === "same") origPos += len;
    }
  }
  return result;
}

function splitIntoParagraphs(adiff) {
  const groups = [[]];
  for (const d of adiff) {
    if (d.type === "del") { groups[groups.length - 1].push(d); continue; }
    const parts = d.text.split("\n\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) groups.push([]);
      if (parts[i]) groups[groups.length - 1].push({ ...d, text: parts[i] });
    }
  }
  return groups;
}

/* ══════════════════════════════════════
   STYLES & UTILS
   ══════════════════════════════════════ */

const C = {
  bg: "#faf7f2", surface: "#fff", surfaceAlt: "#f3efe9",
  text: "#2c2825", muted: "#8a8078", border: "#e2dbd2",
  accent: "#b44d2d", accentSoft: "#f0ddd5",
  addBg: "#d6f0d6", addText: "#1a6b2c",
  delBg: "#fcdcda", delText: "#a4271a",
  header: "#2c2825", headerText: "#faf7f2",
  tipBg: "#2c2825", tipText: "#faf7f2",
  copyFlash: "#e8ddd0",
};
const F = "'Meiryo', 'Hiragino Sans', sans-serif";

function copyText(text) {
  if (!text) return;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch (e) {}
}

/* ══════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════ */

export default function DiffViewer() {
  const [viewMode, setViewMode] = useState("side");
  const [tooltip, setTooltip] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const copyTimerRef = useRef(null);

  const diff = useMemo(() => computeDiff(ORIGINAL, CORRECTED), []);
  const adiff = useMemo(() => annotateDiff(diff), [diff]);
  const paraGroups = useMemo(() => splitIntoParagraphs(adiff), [adiff]);
  const changes = adiff.filter(d => d.type !== "same").length;

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);
  const syncScroll = useCallback((src) => {
    if (syncing.current) return;
    syncing.current = true;
    const s = src === "l" ? leftRef.current : rightRef.current;
    const t = src === "l" ? rightRef.current : leftRef.current;
    if (s && t) t.scrollTop = s.scrollTop / (s.scrollHeight - s.clientHeight || 1) * (t.scrollHeight - t.clientHeight || 1);
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  const showTip = useCallback((reason, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ reason, x: rect.left + rect.width / 2, y: rect.top - 6 });
  }, []);
  const hideTip = useCallback(() => setTooltip(null), []);

  const flashCopy = useCallback((id) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopiedIdx(id);
    copyTimerRef.current = setTimeout(() => setCopiedIdx(null), 800);
  }, []);

  const copyParagraph = useCallback((paraIdx, e) => {
    // テキスト選択中はブラウザ標準のコピーを優先
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    const md = CORRECTED_MD_PARAS[paraIdx] || "";
    if (md) { copyText(md); flashCopy(paraIdx); }
  }, [flashCopy]);

  const copyAll = useCallback(() => {
    copyText(CORRECTED_MD);
    flashCopy("all");
  }, [flashCopy]);

  const textStyle = { fontFamily: F, fontSize: 15, lineHeight: 2, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-all" };

  const renderSpan = (d, i, filter) => {
    if (filter && d.type !== "same" && d.type !== filter) return null;
    if (d.type === "same") return <span key={i} style={d.bold ? { fontWeight: 700 } : undefined}>{d.text}</span>;
    const isDel = d.type === "del";
    const baseStyle = isDel
      ? { background: C.delBg, color: C.delText, textDecoration: "line-through", textDecorationColor: `${C.delText}66` }
      : { background: C.addBg, color: C.addText };
    return (
      <span key={i}
        onMouseEnter={d.reason ? (e) => showTip(d.reason, e) : undefined}
        onMouseLeave={d.reason ? hideTip : undefined}
        style={{ ...baseStyle, fontWeight: d.bold ? 700 : "normal", borderRadius: 2, padding: "0 1px",
          cursor: d.reason ? "help" : "default",
          borderBottom: d.reason ? `2px dotted ${isDel ? C.delText : C.addText}88` : "none",
        }}>{d.text}</span>
    );
  };

  const renderParagraph = (group, paraIdx, filter) => (
    <div key={paraIdx} onClick={(e) => copyParagraph(paraIdx, e)}
      style={{ padding: "2px 4px", marginBottom: 4, borderRadius: 4, cursor: "text",
        transition: "background 0.15s", background: copiedIdx === paraIdx ? C.copyFlash : "transparent",
        userSelect: "text",
      }} title="クリックで段落コピー（md）／ドラッグで部分選択">
      {group.map((d, i) => renderSpan(d, i, filter))}
    </div>
  );

  const Btn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, cursor: "pointer",
      border: `1.5px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentSoft : "transparent",
      color: active ? C.accent : C.muted, transition: "all 0.15s",
    }}>{children}</button>
  );

  const PanelHeader = ({ color, label }) => (
    <div style={{ padding: "10px 20px", background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
      fontFamily: F, fontSize: 12, fontWeight: 700, color: C.muted,
      letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, opacity: 0.6 }} />
      {label}
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: F }}>
      <header style={{ background: C.header, color: C.headerText, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>校正ビューワー</h1>
          <span style={{ fontSize: 11, opacity: 0.45, letterSpacing: "0.08em" }}>DIFF VIEWER</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, background: C.accent, color: "#fff", borderRadius: 20, padding: "4px 14px" }}>
          {changes} 箇所修正
        </span>
      </header>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn active={viewMode === "side"} onClick={() => setViewMode("side")}>◫ 並列</Btn>
          <Btn active={viewMode === "inline"} onClick={() => setViewMode("inline")}>≡ インライン</Btn>
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>クリックで段落コピー（md） ／ ドラッグで部分選択 ／ 点線ホバーで修正理由</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {viewMode === "side" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Column headers */}
            <div style={{ display: "flex", flexShrink: 0 }}>
              <div style={{ flex: 1, borderRight: `1px solid ${C.border}` }}>
                <PanelHeader color={C.delText} label="原文" />
              </div>
              <div style={{ flex: 1 }}>
                <PanelHeader color={C.addText} label="校正後" />
              </div>
            </div>
            {/* Aligned rows */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
              {paraGroups.map((g, pi) => (
                <div key={pi} style={{ display: "flex", borderBottom: `1px solid ${C.border}22`, minHeight: 20 }}>
                  <div style={{ flex: 1, padding: "4px 22px", borderRight: `1px solid ${C.border}` }}>
                    <div style={textStyle}>{renderParagraph(g, pi, "del")}</div>
                  </div>
                  <div style={{ flex: 1, padding: "4px 22px" }}>
                    <div style={textStyle}>{renderParagraph(g, pi, "add")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 20px", background: C.surfaceAlt, borderBottom: `1px solid ${C.border}`,
              fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.06em",
              display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <span>インライン比較</span>
              <span style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 500, letterSpacing: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: C.delBg, border: `1px solid ${C.delText}33` }} /> 削除
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: C.addBg, border: `1px solid ${C.addText}33` }} /> 追加
                </span>
              </span>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 26 }}>
              <div style={{ ...textStyle, lineHeight: 2.2 }}>{paraGroups.map((g, pi) => renderParagraph(g, pi, null))}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 24px", background: copiedIdx === "all" ? C.copyFlash : C.surface,
        borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", flexShrink: 0,
        transition: "background 0.15s" }}>
        <button onClick={copyAll} style={{
          fontFamily: F, fontSize: 13, fontWeight: 600, padding: "6px 18px", borderRadius: 6,
          border: "none", cursor: "pointer",
          background: copiedIdx === "all" ? C.addText : C.accent,
          color: "#fff", boxShadow: `0 2px 8px ${C.accent}44`, transition: "background 0.15s",
        }}>{copiedIdx === "all" ? "✓ コピーしました" : "📋 全文コピー（md）"}</button>
      </div>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)",
          background: C.tipBg, color: C.tipText, fontSize: 12, fontWeight: 500, lineHeight: 1.6,
          padding: "8px 14px", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          maxWidth: 280, whiteSpace: "normal", wordBreak: "keep-all", overflowWrap: "break-word",
          zIndex: 9999, pointerEvents: "none",
        }}>
          {tooltip.reason}
          <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${C.tipBg}` }} />
        </div>
      )}

      {copiedIdx !== null && copiedIdx !== "all" && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: C.header, color: C.headerText, fontSize: 13, fontWeight: 600,
          padding: "8px 20px", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
        }}>✓ 段落をコピーしました</div>
      )}
    </div>
  );
}
