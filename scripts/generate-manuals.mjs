import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
  convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";

// ── スタイルユーティリティ ──────────────────────────────

const FONT = "游ゴシック";
const COLOR_ACCENT = "1B6EC2"; // 青
const COLOR_HEADER_BG = "2E5F9A";
const COLOR_TABLE_HEADER = "D6E4F7";
const COLOR_GRAY = "666666";

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: COLOR_HEADER_BG,
        font: FONT,
      }),
    ],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT },
    },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: COLOR_ACCENT,
        font: FONT,
      }),
    ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({ text, bold: true, size: 22, color: "333333", font: FONT }),
    ],
  });
}

function body(text, { bold = false, color = "111111", size = 20 } = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, bold, color, size, font: FONT })],
  });
}

function bullet(text, indent = 0) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.3 + indent * 0.3) },
    children: [
      new TextRun({ text: `● ${text}`, size: 20, font: FONT, color: "222222" }),
    ],
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: convertInchesToTwip(0.2) },
    children: [
      new TextRun({
        text: `⚠️ ${text}`,
        size: 18,
        color: "B85C00",
        italics: true,
        font: FONT,
      }),
    ],
  });
}

function tip(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: convertInchesToTwip(0.2) },
    children: [
      new TextRun({
        text: `💡 ${text}`,
        size: 18,
        color: "1A6B1A",
        font: FONT,
      }),
    ],
  });
}

function blank() {
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function tableHeader(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(
      (text) =>
        new TableCell({
          shading: { fill: COLOR_TABLE_HEADER, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 18,
                  font: FONT,
                  color: "1A3A6B",
                }),
              ],
            }),
          ],
        })
    ),
  });
}

function tableRow(cells) {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: String(text), size: 18, font: FONT }),
              ],
            }),
          ],
        })
    ),
  });
}

function simpleTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeader(headers), ...rows.map(tableRow)],
  });
}

// ══════════════════════════════════════════════════════════════
//  スタッフ向け説明書
// ══════════════════════════════════════════════════════════════

function buildStaffManual() {
  const children = [
    // 表紙
    blank(),
    blank(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 200 },
      children: [
        new TextRun({
          text: "M shift",
          bold: true,
          size: 72,
          color: COLOR_HEADER_BG,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
      children: [
        new TextRun({
          text: "スタッフ向け 操作マニュアル",
          bold: true,
          size: 40,
          color: COLOR_GRAY,
          font: FONT,
        }),
      ],
    }),
    blank(),
    blank(),

    // ─ はじめに ─
    pageBreak(),
    h1("はじめに"),
    body(
      "このマニュアルは、シフト管理アプリ「M shift」をスタッフが使うための手順書です。"
    ),
    body("スマートフォン・パソコンどちらからでも利用できます。"),
    blank(),
    body("主にできること："),
    bullet("シフト希望を提出する"),
    bullet("提出したシフトの承認状況を確認する"),
    bullet("プロフィール情報を確認する"),
    blank(),
    tip("LINEアカウントがあれば、パスワードなしで簡単にログインできます。"),

    // ─ ログイン ─
    h1("1. ログイン"),
    h2("1-1. LINEログイン（おすすめ）"),
    body(
      "LINEを使えば、メールアドレスやパスワードを入力せずにログインできます。"
    ),
    blank(),
    body("手順："),
    bullet("①「LINEでログイン」ボタンをタップ"),
    bullet("② LINEの認証画面で「許可する」をタップ"),
    bullet("③ 自動的にシフト画面へ移動します"),
    blank(),
    note("初回ログイン時は店長の承認が必要です。承認されるまでお待ちください。"),

    blank(),
    h2("1-2. メール・パスワードでログイン"),
    body("店長から招待メールが届いた場合の手順："),
    blank(),
    bullet("① 招待メール内のリンクをクリック"),
    bullet("② パスワードを設定する画面でパスワードを入力・確定"),
    bullet("③ ログイン画面でメールアドレスとパスワードを入力"),
    blank(),
    note("招待メールの有効期限は24時間です。期限切れの場合は店長に再送を依頼してください。"),

    // ─ 承認待ち ─
    h2("1-3. 承認待ち画面について"),
    body(
      "初めてログインすると「承認待ちです」という画面が表示されることがあります。"
    ),
    body("これは店長がアカウントを確認・承認するまでの待機画面です。"),
    body("承認されると自動的にシフト画面へ移動します（最大10秒ごとに確認）。"),

    // ─ シフト希望提出 ─
    pageBreak(),
    h1("2. シフト希望の提出"),
    h2("2-1. 提出の流れ"),
    blank(),
    simpleTable(
      ["ステップ", "操作内容"],
      [
        ["① 期間を選ぶ", '「前半（1〜15日）」または「後半（16〜末日）」を選択'],
        ["② 日付を設定", "カレンダーの日付をタップして出勤・休みを設定"],
        ["③ 時刻を入力", "出勤日の開始時刻と終了時刻を入力"],
        ["④ 提出する", '「提出する」ボタンをタップ'],
      ]
    ),

    blank(),
    h2("2-2. 日付の設定方法"),
    body("カレンダーの各日付をタップすると、以下の選択肢が表示されます："),
    blank(),
    bullet("出勤 → 開始・終了時刻を入力できる状態になります"),
    bullet("休み → その日は休みとして登録されます"),
    blank(),
    body("時刻の入力："),
    bullet("時刻は30分単位で入力します（例：9:00 / 9:30 / 10:00）"),
    bullet("終了時刻は開始時刻より後でなければなりません"),
    blank(),
    tip("「〇」は時刻を確定させずに「前後できる」という意味です。店長が調整します。"),
    tip("「◎」は開始・終了どちらも店長に一任する場合に使います。"),

    blank(),
    h2("2-3. 一括入力プリセット"),
    body("よく使う時間帯はプリセットから素早く設定できます："),
    blank(),
    simpleTable(
      ["プリセット", "内容"],
      [
        ["11〜17", "11:00 〜 17:00（固定）"],
        ["11〜15", "11:00 〜 15:00（固定）"],
        ["〇〜17", "開始可変 〜 17:00"],
        ["〇〜15", "開始可変 〜 15:00"],
        ["17〜〇", "17:00 〜 終了可変"],
        ["◎", "開始・終了ともに店長に一任"],
      ]
    ),

    blank(),
    h2("2-4. 提出期限"),
    body("シフト希望には提出期限があります。期限を過ぎると提出できなくなります。"),
    blank(),
    simpleTable(
      ["シフト期間", "提出期限"],
      [
        ["前半（1日〜15日）", "前月の20日 23:59"],
        ["後半（16日〜末日）", "当月の5日 23:59"],
      ]
    ),
    blank(),
    note("期限を過ぎるとフォームが灰色になり、編集・提出ができなくなります。忘れずに提出してください。"),

    blank(),
    h2("2-5. 提出後の修正"),
    body("提出後も、承認される前であれば修正できます。"),
    bullet("シフト希望画面で同じ期間を開き、内容を変更して再提出します"),
    bullet("承認済みのシフトは変更できません"),
    blank(),
    note("承認後に変更が必要な場合は、直接店長に連絡してください。"),

    // ─ 履歴確認 ─
    pageBreak(),
    h1("3. 提出済みシフトの確認"),
    h2("3-1. 確認方法"),
    body('メニューの「提出済みシフト」から、提出したシフトをカレンダーで確認できます。'),
    blank(),
    simpleTable(
      ["表示", "意味"],
      [
        ["提出中", "店長がまだ確認・承認していない状態"],
        ["承認済み", "店長が確認・確定したシフト"],
      ]
    ),
    blank(),
    tip("承認後に時刻が変わっている場合は、店長が調整した結果です。"),

    // ─ プロフィール ─
    h1("4. プロフィール"),
    body("メニューの「プロフィール」から自分の登録情報を確認できます。"),
    blank(),
    bullet("氏名"),
    bullet("スタッフコード"),
    bullet("メールアドレス"),
    blank(),
    note("氏名やスタッフコードの変更が必要な場合は店長に依頼してください。"),

    // ─ よくあるQ&A ─
    pageBreak(),
    h1("5. よくある質問"),
    blank(),
    simpleTable(
      ["質問", "回答"],
      [
        [
          "ログインできない",
          "メールアドレスとパスワードを確認してください。LINEログインも試してみてください。",
        ],
        [
          "「承認待ちです」のまま変わらない",
          "店長がまだ承認していません。店長に連絡してください。",
        ],
        [
          "シフトが提出できない（灰色になっている）",
          "提出期限が過ぎています。直接店長に連絡してください。",
        ],
        [
          "提出したのに反映されていない",
          "「提出済みシフト」画面を更新してください。それでも消えている場合は店長へ。",
        ],
        [
          "時刻の入力でエラーになる",
          "終了時刻が開始時刻より前になっていないか確認してください。30分単位で入力してください。",
        ],
        [
          "招待メールが届かない",
          "迷惑メールフォルダを確認するか、店長に再送を依頼してください。",
        ],
      ]
    ),

    blank(),
    blank(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new TextRun({
          text: "不明な点は店長までお気軽にお問い合わせください。",
          size: 18,
          color: COLOR_GRAY,
          font: FONT,
        }),
      ],
    }),
  ];

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
        },
      },
    },
    sections: [{ children }],
  });
}

// ══════════════════════════════════════════════════════════════
//  店長（管理者）向け説明書
// ══════════════════════════════════════════════════════════════

function buildAdminManual() {
  const children = [
    // 表紙
    blank(),
    blank(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 200 },
      children: [
        new TextRun({
          text: "M shift",
          bold: true,
          size: 72,
          color: COLOR_HEADER_BG,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
      children: [
        new TextRun({
          text: "店長（管理者）向け 操作マニュアル",
          bold: true,
          size: 40,
          color: COLOR_GRAY,
          font: FONT,
        }),
      ],
    }),
    blank(),
    blank(),

    // ─ はじめに ─
    pageBreak(),
    h1("はじめに"),
    body(
      "このマニュアルは、シフト管理アプリ「M shift」を店長（管理者）が使うための手順書です。"
    ),
    blank(),
    body("主にできること："),
    bullet("スタッフを招待・管理する"),
    bullet("スタッフのシフト希望を確認する"),
    bullet("確定シフトを作成・編集する"),
    bullet("Excelファイルでシフト表をエクスポートする"),
    blank(),
    tip("すべての操作はスマートフォン・パソコンどちらからでも行えます。"),

    // ─ ログイン ─
    h1("1. ログイン"),
    body("ログインは「LINEでログイン」または「メール・パスワード」で行います。"),
    body("詳細な手順はスタッフ向けマニュアルと同じです。"),
    blank(),
    note("管理者アカウントは最初から店長に設定されています。自分でロールを変更することはできません。"),

    // ─ スタッフ管理 ─
    pageBreak(),
    h1("2. スタッフの追加・管理"),
    h2("2-1. スタッフを招待する"),
    body('「スタッフ管理」画面を開き、「スタッフを招待」ボタンをタップします。'),
    blank(),
    simpleTable(
      ["入力項目", "説明"],
      [
        ["氏名", "スタッフのフルネーム（50文字以内）"],
        ["スタッフコード", "半角英数字で10文字以内の識別コード（例：S001）"],
        ["メールアドレス", "招待メールを送る先のアドレス"],
      ]
    ),
    blank(),
    body("入力後、「招待メールを送信」をタップします。"),
    body("スタッフにメールが届き、リンクからパスワードを設定してもらいます。"),
    blank(),
    note("招待メールの有効期限は24時間です。届かない場合は迷惑メールフォルダを確認するよう伝えてください。"),

    blank(),
    h2("2-2. スタッフを承認する"),
    body(
      "スタッフが初めてログインすると「未承認」状態になります。承認するまでスタッフはアプリを使えません。"
    ),
    blank(),
    body("承認手順："),
    bullet("① 「スタッフ管理」画面を開く"),
    bullet('② 「未承認スタッフ」セクションを展開する'),
    bullet("③ 承認するスタッフにチェックを入れる"),
    bullet('④ 「まとめて承認」ボタンをタップ'),
    blank(),
    tip("LINEログインで登録したスタッフは「PENDING-○○○○」というコードで表示されます。編集して正しいコードに変更してください。"),

    blank(),
    h2("2-3. スタッフ情報を編集する"),
    body("スタッフ一覧の各スタッフ横の編集ボタンから、以下の情報を変更できます："),
    blank(),
    bullet("氏名・スタッフコード"),
    bullet("メールアドレス・パスワード"),
    bullet("権限（スタッフ ↔ 管理者）"),
    bullet("スキル・習熟度"),
    bullet("アカウントの有効・無効"),
    blank(),
    note("退職したスタッフは「アカウント有効」をオフにしてください。削除すると復元できません。"),

    blank(),
    h2("2-4. スキルの設定"),
    body("スタッフごとに対応できる業務を設定できます："),
    blank(),
    bullet("時間帯責任者可（リーダースキル）"),
    bullet("基本スキル：調理、接客、仕込み、配送など"),
    blank(),
    tip("リーダースキルをオンにすると、関連する基本スキルが自動でオンになります。"),

    // ─ シフト確認 ─
    pageBreak(),
    h1("3. シフト希望の確認"),
    h2("3-1. シフト希望一覧"),
    body('「シフト管理」画面では、スタッフが提出したシフト希望を一覧で確認できます。'),
    blank(),
    body("操作："),
    bullet("月・期間（前半/後半）を選択して絞り込む"),
    bullet("スタッフ名やスタッフコードで検索する"),
    blank(),
    h2("3-2. 各スタッフのシフト状況"),
    simpleTable(
      ["ステータス", "意味"],
      [
        ["提出中", "スタッフが希望を提出済み、まだ確定していない"],
        ["承認済み", "確定シフトとして登録済み"],
        ["未提出", "まだシフト希望が届いていない"],
      ]
    ),

    // ─ ワークスケジュール ─
    pageBreak(),
    h1("4. ワークスケジュール（確定シフト）の作成"),
    h2("4-1. 画面の開き方"),
    body('メニューの「ワークスケジュール」から開きます。'),
    body("期間（月・前半/後半）を選択すると、その期間の日別シフト一覧が表示されます。"),

    blank(),
    h2("4-2. 確定シフトの割り当て"),
    body("各日付をタップすると、その日の詳細編集画面が開きます。"),
    blank(),
    bullet("スタッフごとのシフト希望を確認"),
    bullet("確定時刻を入力（希望時刻からの変更も可）"),
    bullet("全スタッフ分入力後、保存する"),
    blank(),
    note("「〇」や「◎」で提出されたシフトは、ここで具体的な時刻に変更してください。"),
    blank(),
    tip("希望時刻をそのまま使う場合は、時刻フィールドを変更せず保存できます。"),

    blank(),
    h2("4-3. Excelエクスポート"),
    body("確定したシフトをExcelファイルでダウンロードできます。"),
    blank(),
    simpleTable(
      ["エクスポート種別", "内容"],
      [
        ["日単位", "特定の1日分のシフト一覧をExcelに出力"],
        ["期間単位", "前半または後半のシフト全体を日付別シートで出力"],
      ]
    ),
    blank(),
    body("エクスポートに含まれる情報："),
    bullet("スタッフコード・氏名"),
    bullet("出勤日・開始時刻・終了時刻"),
    bullet("ステータス（提出中 / 承認済み）"),
    blank(),
    tip("エクスポートされるのは「有効なスタッフ」のみです。無効化したスタッフは含まれません。"),

    // ─ よくあるQ&A ─
    pageBreak(),
    h1("5. よくある質問"),
    blank(),
    simpleTable(
      ["質問", "回答"],
      [
        [
          "スタッフが「承認待ち」のままアプリを使えない",
          "「スタッフ管理」→「未承認スタッフ」セクションから承認してください。",
        ],
        [
          "招待メールが届かないとスタッフから言われた",
          "迷惑メールフォルダを確認するよう伝えてください。それでも届かない場合は再度招待してください。",
        ],
        [
          "スタッフが退職した",
          "編集ダイアログで「アカウント有効」をオフにしてください。シフト履歴は残ります。",
        ],
        [
          "シフト希望が提出されていない",
          "スタッフに直接確認するか、締め切りを再周知してください。",
        ],
        [
          "Excelが文字化けする",
          "Excelを開く前に「データ→外部データの取り込み」ではなく、ファイルを直接ダブルクリックで開いてください。",
        ],
        [
          "スタッフが誤ってシフトを提出できなかった",
          "期限超過の場合、アプリ上では提出できません。紙または口頭で確認し、管理者側で手動入力してください。",
        ],
      ]
    ),

    blank(),
    blank(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new TextRun({
          text: "操作に関して不明な点があればご連絡ください。",
          size: 18,
          color: COLOR_GRAY,
          font: FONT,
        }),
      ],
    }),
  ];

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20 },
        },
      },
    },
    sections: [{ children }],
  });
}

// ── 出力 ──────────────────────────────────────────────────────

async function main() {
  console.log("📝 スタッフ向けマニュアルを生成中...");
  const staffDoc = buildStaffManual();
  const staffBuf = await Packer.toBuffer(staffDoc);
  writeFileSync("Mshift_スタッフ向けマニュアル.docx", staffBuf);
  console.log("✅ Mshift_スタッフ向けマニュアル.docx を出力しました");

  console.log("📝 店長向けマニュアルを生成中...");
  const adminDoc = buildAdminManual();
  const adminBuf = await Packer.toBuffer(adminDoc);
  writeFileSync("Mshift_店長向けマニュアル.docx", adminBuf);
  console.log("✅ Mshift_店長向けマニュアル.docx を出力しました");
}

main().catch(console.error);
