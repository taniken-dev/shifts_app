import ExcelJS from 'exceljs'

// ============================================================
// ワークスケジュール表 (.xlsx) 生成ユーティリティ
//
// 1日1シート・前半 or 後半をまとめて1ファイルに出力する。
// 各シート = A4 横・出勤スタッフ行 × 1時間スロット列（:30境界があれば30分）・approved のみ黄色。
// ============================================================

const START_HOUR = 7
const END_HOUR   = 22
const A4_TOTAL_WIDTH_CHARS = 108

// 色定数 (ARGB)
const YELLOW      = 'FFFFFF00'  // シフト塗りつぶし
const HEADER_BG   = 'FFFFFFFF'  // ヘッダー行背景
const TITLE_BG    = 'FFFFFFFF'  // タイトル行背景
const BORDER_CLR  = 'FF9CA3AF'  // 罫線色

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// ---- 公開型 ----
export type StaffRow = {
  id:         string
  staff_code: string
  full_name:  string
}

export type ShiftRow = {
  profile_id: string
  shift_date: string   // "YYYY-MM-DD"
  start_time: string   // "HH:MM"
  end_time:   string   // "HH:MM"
  status:     string
}

export type Period = 'first' | 'second'

// ---- 内部ヘルパー ----

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function slotCovered(slotIdx: number, startMin: number, endMin: number, slotMinutes: number): boolean {
  const slotStart = START_HOUR * 60 + slotIdx * slotMinutes
  const slotEnd   = slotStart + slotMinutes
  return startMin < slotEnd && endMin > slotStart
}

function border(): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'thin'
  const c = { style: s, color: { argb: BORDER_CLR } }
  return { top: c, left: c, bottom: c, right: c }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function dateRange(year: number, month: number, period: Period): string[] {
  const last = lastDayOfMonth(year, month)
  const [from, to] = period === 'first' ? [1, 15] : [16, last]
  const pad = (n: number) => String(n).padStart(2, '0')
  return Array.from({ length: to - from + 1 }, (_, i) =>
    `${year}-${pad(month)}-${pad(from + i)}`
  )
}

// ============================================================
// 1シート分の描画（ワークブックに ws を追加する）
// ============================================================
function addDaySheet(
  wb:     ExcelJS.Workbook,
  date:   string,
  staff:  StaffRow[],
  shifts: ShiftRow[],  // この日の全シフト（全ステータス）
): void {
  const [year, month, day] = date.split('-').map(Number)
  const weekday   = WEEKDAYS[new Date(year, month - 1, day).getDay()]
  const dateLabel = `${month}月${day}日（${weekday}）`
  const sheetName = `${month}月${day}日`

  // approved シフトのみ対象
  const shiftMap = new Map<string, ShiftRow>()
  for (const s of shifts) {
    if (s.status === 'approved') shiftMap.set(s.profile_id, s)
  }

  // 確定シフト（approved）のあるスタッフのみ行として表示
  const activeStaff = staff.filter(m => shiftMap.has(m.id))

  // approved シフトに :30 の境界があれば 30分刻み、なければ 1時間刻み
  const approvedList = [...shiftMap.values()]
  const slotMinutes  = approvedList.some(s =>
    toMinutes(s.start_time) % 60 !== 0 || toMinutes(s.end_time) % 60 !== 0
  ) ? 30 : 60
  const totalSlots  = ((END_HOUR - START_HOUR) * 60) / slotMinutes
  const colsPerHour = 60 / slotMinutes

  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize:   9,
      orientation: 'landscape',
      fitToPage:   true,
      fitToWidth:  1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.55, bottom: 0.55, header: 0.25, footer: 0.25 },
    },
    headerFooter: {
      oddHeader: `&C&"游ゴシック,Bold"ワークスケジュール表　${dateLabel}`,
    },
  })
  ws.views = [{ showGridLines: false }]

  // ---- 列幅 ----
  const nameColWidth = 14
  ws.getColumn(1).width = nameColWidth
  const minSlotWidth = slotMinutes === 30 ? 2.4 : 4.8
  const slotColWidth = Math.max(
    minSlotWidth,
    (A4_TOTAL_WIDTH_CHARS - nameColWidth * 2) / totalSlots,
  )
  // 左側の氏名列幅に近い分だけ右側へ空列を追加して、左右余白の見え方を対称に近づける
  const extraRightSlots = Math.max(1, Math.round(nameColWidth / slotColWidth))
  const totalCols = totalSlots + extraRightSlots
  for (let i = 2; i <= totalCols + 1; i++) {
    ws.getColumn(i).width = slotColWidth
  }

  const midCol = Math.floor(totalCols / 2) + 1

  // ---- 行1: タイトル ----
  const r1 = ws.getRow(1)
  r1.height = 20

  ws.mergeCells(1, 1, 1, midCol - 1)
  const t1 = ws.getCell(1, 1)
  t1.value     = 'ワークスケジュール表'
  t1.font      = { bold: true, size: 10, color: { argb: 'FF1A1A1A' } }
  t1.alignment = { horizontal: 'center', vertical: 'middle' }
  t1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BG } }
  t1.border    = border()

  ws.mergeCells(1, midCol, 1, totalCols + 1)
  const t2 = ws.getCell(1, midCol)
  t2.value     = dateLabel
  t2.font      = { bold: true, size: 10, color: { argb: 'FF1A1A1A' } }
  t2.alignment = { horizontal: 'right', vertical: 'middle' }
  t2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_BG } }
  t2.border    = border()

  // ---- 行2: 時間ヘッダー ----
  const r2 = ws.getRow(2)
  r2.height = 15

  const nh = ws.getCell(2, 1)
  nh.value     = ''
  nh.font      = { bold: true, size: 9 }
  nh.alignment = { horizontal: 'center', vertical: 'middle' }
  nh.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
  nh.border    = border()

  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const colStart = 2 + (hour - START_HOUR) * colsPerHour
    const colEnd   = colStart + colsPerHour - 1
    if (colsPerHour > 1) ws.mergeCells(2, colStart, 2, colEnd)
    const hc     = ws.getCell(2, colStart)
    hc.value     = hour
    hc.font      = { bold: true, size: 9 }
    hc.alignment = { horizontal: 'center', vertical: 'middle' }
    hc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    hc.border    = border()
  }
  for (let col = totalSlots + 2; col <= totalCols + 1; col++) {
    const c = ws.getCell(2, col)
    c.value = ''
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    c.border = border()
  }

  // ---- 行3〜: スタッフ行（1人あたり「名前行 + 空白行」） ----
  activeStaff.forEach((member, idx) => {
    const nameRowNum   = idx * 2 + 3
    const spacerRowNum = nameRowNum + 1
    const nameRow      = ws.getRow(nameRowNum)
    const spacerRow    = ws.getRow(spacerRowNum)
    nameRow.height     = 15
    spacerRow.height   = 15

    const nc     = ws.getCell(nameRowNum, 1)
    nc.value     = member.full_name
    nc.font      = { size: 9 }
    nc.alignment = { horizontal: 'left', vertical: 'middle' }
    nc.border    = border()
    const ncSpacer = ws.getCell(spacerRowNum, 1)
    ncSpacer.value = ''
    ncSpacer.border = border()

    const shift    = shiftMap.get(member.id)!
    const startMin = toMinutes(shift.start_time)
    const endMin   = toMinutes(shift.end_time)

    for (let slotIdx = 0; slotIdx < totalCols; slotIdx++) {
      const nameCell   = ws.getCell(nameRowNum, slotIdx + 2)
      const spacerCell = ws.getCell(spacerRowNum, slotIdx + 2)
      nameCell.border = border()
      spacerCell.border = border()
      if (slotIdx < totalSlots && slotCovered(slotIdx, startMin, endMin, slotMinutes)) {
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } }
      }
    }
  })

  const lastRow = activeStaff.length > 0 ? activeStaff.length * 2 + 2 : 2
  ws.pageSetup.printArea = `A1:${columnLetter(totalCols + 1)}${lastRow}`
}

/** 列番号 → Excel 列文字 (1→A, 27→AA …) */
function columnLetter(col: number): string {
  let letter = ''
  while (col > 0) {
    const rem = (col - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    col = Math.floor((col - 1) / 26)
  }
  return letter
}

// ============================================================
// 公開 API: 前半 or 後半まとめて1ファイル生成
// ============================================================
export async function generatePeriodWorkScheduleXlsx(
  month:  string,   // "YYYY-MM"
  period: Period,
  staff:  StaffRow[],
  shifts: ShiftRow[], // 対象期間の全シフト（日付・ステータス混在可）
): Promise<Buffer> {
  const [year, monthNum] = month.split('-').map(Number)
  const dates = dateRange(year, monthNum, period)

  // 日付 → シフト配列のマップを事前構築（ループ内で都度 filter しない）
  const shiftsByDate = new Map<string, ShiftRow[]>()
  for (const s of shifts) {
    const existing = shiftsByDate.get(s.shift_date) ?? []
    existing.push(s)
    shiftsByDate.set(s.shift_date, existing)
  }

  const wb = new ExcelJS.Workbook()
  wb.creator  = 'M shift'
  wb.created  = new Date()
  wb.modified = new Date()

  for (const date of dates) {
    addDaySheet(wb, date, staff, shiftsByDate.get(date) ?? [])
  }

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

// ============================================================
// 後方互換: 1日単体出力（既存の route から呼ばれる場合用）
// ============================================================
export async function generateWorkScheduleXlsx(
  date:   string,
  staff:  StaffRow[],
  shifts: ShiftRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'M shift'
  addDaySheet(wb, date, staff, shifts)
  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
