import "server-only";
import { inflateRawSync } from "node:zlib";

export type StudentRosterRow = {
  rowNumber: number;
  sequence: string;
  departmentGrade: string;
  studentId: string;
  name: string;
  schoolEmail: string;
  externalEmail: string;
  note: string;
};

type CellMap = Map<string, string>;

const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const FREE_SECTOR = 0xffffffff;
const END_OF_CHAIN = 0xfffffffe;

function hasPrefix(buffer: Buffer, prefix: Buffer) {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function normalizeHeader(value: string) {
  return clean(value).replace(/\s+/g, "");
}

function columnLettersToIndex(letters: string) {
  let value = 0;
  for (const ch of letters.toUpperCase()) value = value * 26 + (ch.charCodeAt(0) - 64);
  return value - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function parseRosterFromCells(cells: CellMap): StudentRosterRow[] {
  const rowNumbers = Array.from(cells.keys()).map((key) => Number(key.split(":", 1)[0]));
  const maxRow = Math.max(0, ...rowNumbers);
  let headerRow = -1;
  let headerMap = new Map<string, number>();

  for (let row = 0; row <= maxRow; row++) {
    const current = new Map<string, number>();
    for (let col = 0; col < 30; col++) {
      const value = normalizeHeader(cells.get(`${row}:${col}`) || "");
      if (value) current.set(value, col);
    }
    if (current.has("學號")) {
      headerRow = row;
      headerMap = current;
      break;
    }
  }

  if (headerRow < 0) throw new Error("找不到「學號」欄位，請確認名單格式與範例一致");

  const col = (name: string) => headerMap.get(name);
  const studentIdCol = col("學號");
  if (studentIdCol === undefined) throw new Error("找不到「學號」欄位");

  const result: StudentRosterRow[] = [];
  for (let row = headerRow + 1; row <= maxRow; row++) {
    const valueAt = (column: number | undefined) => column === undefined ? "" : clean(cells.get(`${row}:${column}`));
    const studentId = valueAt(studentIdCol).toUpperCase();
    if (!studentId) continue;
    result.push({
      rowNumber: row + 1,
      sequence: valueAt(col("編號")),
      departmentGrade: valueAt(col("系級")),
      studentId,
      name: valueAt(col("姓名")),
      schoolEmail: valueAt(col("校內電子信箱")),
      externalEmail: valueAt(col("校外電子信箱")),
      note: valueAt(col("備註")),
    });
  }

  if (!result.length) throw new Error("名單中找不到任何學生資料");
  return result;
}

function readSector(file: Buffer, sectorSize: number, sectorId: number) {
  const start = 512 + sectorId * sectorSize;
  return file.subarray(start, start + sectorSize);
}

function readOleWorkbook(file: Buffer) {
  const sectorSize = 1 << file.readUInt16LE(0x1e);
  const miniSectorSize = 1 << file.readUInt16LE(0x20);
  const fatSectorCount = file.readUInt32LE(0x2c);
  const firstDirectorySector = file.readUInt32LE(0x30);
  const miniStreamCutoff = file.readUInt32LE(0x38);
  const firstMiniFatSector = file.readUInt32LE(0x3c);
  const miniFatSectorCount = file.readUInt32LE(0x40);
  const firstDifatSector = file.readUInt32LE(0x44);
  const difatSectorCount = file.readUInt32LE(0x48);

  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const id = file.readUInt32LE(0x4c + i * 4);
    if (id !== FREE_SECTOR && id !== END_OF_CHAIN) difat.push(id);
  }

  let difatSector = firstDifatSector;
  for (let i = 0; i < difatSectorCount && difatSector !== END_OF_CHAIN; i++) {
    const block = readSector(file, sectorSize, difatSector);
    const count = sectorSize / 4;
    for (let j = 0; j < count - 1; j++) {
      const id = block.readUInt32LE(j * 4);
      if (id !== FREE_SECTOR) difat.push(id);
    }
    difatSector = block.readUInt32LE((count - 1) * 4);
  }

  const fat: number[] = [];
  for (const fatSector of difat.slice(0, fatSectorCount)) {
    const block = readSector(file, sectorSize, fatSector);
    for (let offset = 0; offset < sectorSize; offset += 4) fat.push(block.readUInt32LE(offset));
  }

  const chain = (start: number, table: number[]) => {
    const ids: number[] = [];
    const seen = new Set<number>();
    let current = start;
    while (current !== END_OF_CHAIN && current !== FREE_SECTOR && current < table.length && !seen.has(current)) {
      seen.add(current);
      ids.push(current);
      current = table[current];
      if (ids.length > 100000) throw new Error("Excel檔案的sector chain異常");
    }
    return ids;
  };

  const readNormalChain = (start: number) => Buffer.concat(chain(start, fat).map((id) => readSector(file, sectorSize, id)));
  const directory = readNormalChain(firstDirectorySector);
  const entries: Array<{ name: string; type: number; start: number; size: number }> = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directory.readUInt16LE(offset + 64);
    const name = nameLength >= 2 ? directory.subarray(offset, offset + nameLength - 2).toString("utf16le") : "";
    const type = directory[offset + 66];
    const start = directory.readUInt32LE(offset + 116);
    const size = Number(directory.readBigUInt64LE(offset + 120));
    entries.push({ name, type, start, size });
  }

  const workbook = entries.find((entry) => entry.type === 2 && (entry.name === "Workbook" || entry.name === "Book"));
  if (!workbook) throw new Error("Excel檔案中找不到Workbook資料流");

  if (workbook.size >= miniStreamCutoff) return readNormalChain(workbook.start).subarray(0, workbook.size);

  const root = entries.find((entry) => entry.type === 5);
  if (!root) throw new Error("Excel檔案缺少Root Entry");
  const miniStream = readNormalChain(root.start).subarray(0, root.size);
  const miniFatBytes = firstMiniFatSector === END_OF_CHAIN ? Buffer.alloc(0) : readNormalChain(firstMiniFatSector).subarray(0, miniFatSectorCount * sectorSize);
  const miniFat: number[] = [];
  for (let offset = 0; offset + 4 <= miniFatBytes.length; offset += 4) miniFat.push(miniFatBytes.readUInt32LE(offset));
  return Buffer.concat(chain(workbook.start, miniFat).map((id) => miniStream.subarray(id * miniSectorSize, (id + 1) * miniSectorSize))).subarray(0, workbook.size);
}

function decodeRk(rk: number) {
  const divideBy100 = (rk & 1) !== 0;
  const isInteger = (rk & 2) !== 0;
  let value: number;
  if (isInteger) value = (rk >> 2);
  else {
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32LE(0, 0);
    bytes.writeUInt32LE(rk & 0xfffffffc, 4);
    value = bytes.readDoubleLE(0);
  }
  return divideBy100 ? value / 100 : value;
}

function parseLegacyXls(file: Buffer) {
  const workbook = readOleWorkbook(file);
  let offset = 0;
  let firstSheetOffset = -1;
  let sstPayload: Buffer | null = null;

  while (offset + 4 <= workbook.length) {
    const id = workbook.readUInt16LE(offset);
    const length = workbook.readUInt16LE(offset + 2);
    const payload = workbook.subarray(offset + 4, offset + 4 + length);
    if (id === 0x0085 && firstSheetOffset < 0 && payload.length >= 8) firstSheetOffset = payload.readUInt32LE(0);
    if (id === 0x00fc) {
      sstPayload = payload;
      const next = offset + 4 + length;
      if (next + 4 <= workbook.length && workbook.readUInt16LE(next) === 0x003c) {
        throw new Error("此.xls名單的文字資料超出目前支援範圍，請另存為.xlsx後再匯入");
      }
    }
    offset += 4 + length;
    if (id === 0x000a && firstSheetOffset >= 0) break;
  }

  if (firstSheetOffset < 0 || !sstPayload) throw new Error("無法解析.xls工作表");
  const uniqueCount = sstPayload.readUInt32LE(4);
  const sharedStrings: string[] = [];
  let cursor = 8;
  for (let i = 0; i < uniqueCount; i++) {
    if (cursor + 3 > sstPayload.length) throw new Error(".xls共用字串資料不完整");
    const charCount = sstPayload.readUInt16LE(cursor); cursor += 2;
    const flags = sstPayload[cursor++];
    const hasRichText = (flags & 0x08) !== 0;
    const hasExtended = (flags & 0x04) !== 0;
    const isUnicode = (flags & 0x01) !== 0;
    let richRuns = 0;
    let extendedLength = 0;
    if (hasRichText) { richRuns = sstPayload.readUInt16LE(cursor); cursor += 2; }
    if (hasExtended) { extendedLength = sstPayload.readUInt32LE(cursor); cursor += 4; }
    const byteLength = charCount * (isUnicode ? 2 : 1);
    const raw = sstPayload.subarray(cursor, cursor + byteLength); cursor += byteLength;
    sharedStrings.push(raw.toString(isUnicode ? "utf16le" : "latin1"));
    cursor += richRuns * 4 + extendedLength;
  }

  const cells: CellMap = new Map();
  offset = firstSheetOffset;
  while (offset + 4 <= workbook.length) {
    const id = workbook.readUInt16LE(offset);
    const length = workbook.readUInt16LE(offset + 2);
    const payload = workbook.subarray(offset + 4, offset + 4 + length);
    if (id === 0x000a) break;
    if (id === 0x00fd && payload.length >= 10) {
      const row = payload.readUInt16LE(0);
      const col = payload.readUInt16LE(2);
      const stringIndex = payload.readUInt32LE(6);
      cells.set(`${row}:${col}`, sharedStrings[stringIndex] ?? "");
    } else if (id === 0x0203 && payload.length >= 14) {
      cells.set(`${payload.readUInt16LE(0)}:${payload.readUInt16LE(2)}`, String(payload.readDoubleLE(6)));
    } else if (id === 0x027e && payload.length >= 10) {
      cells.set(`${payload.readUInt16LE(0)}:${payload.readUInt16LE(2)}`, String(decodeRk(payload.readUInt32LE(6))));
    } else if (id === 0x00bd && payload.length >= 12) {
      const row = payload.readUInt16LE(0);
      const firstCol = payload.readUInt16LE(2);
      const lastCol = payload.readUInt16LE(payload.length - 2);
      for (let i = 0; i <= lastCol - firstCol; i++) {
        cells.set(`${row}:${firstCol + i}`, String(decodeRk(payload.readUInt32LE(6 + i * 6))));
      }
    }
    offset += 4 + length;
  }
  return parseRosterFromCells(cells);
}

type ZipEntry = { method: number; compressedSize: number; uncompressedSize: number; localHeaderOffset: number };

function unzipEntries(file: Buffer) {
  let eocd = -1;
  for (let offset = Math.max(0, file.length - 65557); offset <= file.length - 22; offset++) {
    if (file.readUInt32LE(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error(".xlsx ZIP結構不完整");
  const entryCount = file.readUInt16LE(eocd + 10);
  let cursor = file.readUInt32LE(eocd + 16);
  const index = new Map<string, ZipEntry>();
  for (let i = 0; i < entryCount; i++) {
    if (file.readUInt32LE(cursor) !== 0x02014b50) throw new Error(".xlsx中央目錄格式錯誤");
    const method = file.readUInt16LE(cursor + 10);
    const compressedSize = file.readUInt32LE(cursor + 20);
    const uncompressedSize = file.readUInt32LE(cursor + 24);
    const nameLength = file.readUInt16LE(cursor + 28);
    const extraLength = file.readUInt16LE(cursor + 30);
    const commentLength = file.readUInt16LE(cursor + 32);
    const localHeaderOffset = file.readUInt32LE(cursor + 42);
    const name = file.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    index.set(name.replace(/^\//, ""), { method, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return (name: string) => {
    const entry = index.get(name.replace(/^\//, ""));
    if (!entry) return null;
    if (entry.uncompressedSize > 25 * 1024 * 1024) throw new Error(".xlsx內部資料過大");
    const local = entry.localHeaderOffset;
    if (file.readUInt32LE(local) !== 0x04034b50) throw new Error(".xlsx本機檔案標頭格式錯誤");
    const nameLength = file.readUInt16LE(local + 26);
    const extraLength = file.readUInt16LE(local + 28);
    const start = local + 30 + nameLength + extraLength;
    const compressed = file.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return inflateRawSync(compressed);
    throw new Error(`不支援.xlsx壓縮方式：${entry.method}`);
  };
}

function xmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name.replace(":", "\\:")}=["']([^"']*)["']`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseXlsx(file: Buffer) {
  const readEntry = unzipEntries(file);
  const workbookXml = readEntry("xl/workbook.xml")?.toString("utf8");
  const relsXml = readEntry("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbookXml || !relsXml) throw new Error(".xlsx缺少workbook資料");
  const firstSheetTag = workbookXml.match(/<sheet\b[^>]*\br:id=["'][^"']+["'][^>]*\/?\s*>/i)?.[0];
  if (!firstSheetTag) throw new Error(".xlsx找不到工作表");
  const relationId = xmlAttribute(firstSheetTag, "r:id");
  const relationshipTags = relsXml.match(/<Relationship\b[^>]*\/?\s*>/gi) || [];
  const relation = relationshipTags.find((tag) => xmlAttribute(tag, "Id") === relationId);
  if (!relation) throw new Error(".xlsx找不到第一個工作表關聯");
  let target = xmlAttribute(relation, "Target").replace(/\\/g, "/");
  if (target.startsWith("/")) target = target.slice(1);
  else if (!target.startsWith("xl/")) target = `xl/${target.replace(/^\.\//, "")}`;
  const sheetXml = readEntry(target)?.toString("utf8");
  if (!sheetXml) throw new Error(".xlsx找不到第一個工作表內容");

  const sharedStrings: string[] = [];
  const sharedXml = readEntry("xl/sharedStrings.xml")?.toString("utf8");
  if (sharedXml) {
    for (const si of sharedXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/gi) || []) {
      const texts = Array.from(si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi), (match) => decodeXml(match[1]));
      sharedStrings.push(texts.join(""));
    }
  }

  const cells: CellMap = new Map();
  for (const cellTag of sheetXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) || []) {
    const open = cellTag.match(/^<c\b[^>]*>/i)?.[0] || "";
    const ref = xmlAttribute(open, "r");
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) continue;
    const row = Number(match[2]) - 1;
    const col = columnLettersToIndex(match[1]);
    const type = xmlAttribute(open, "t");
    let value = "";
    if (type === "inlineStr") {
      value = Array.from(cellTag.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi), (m) => decodeXml(m[1])).join("");
    } else {
      const raw = cellTag.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      value = type === "s" ? (sharedStrings[Number(raw)] ?? "") : decodeXml(raw);
    }
    cells.set(`${row}:${col}`, value);
  }
  return parseRosterFromCells(cells);
}

export function parseStudentRoster(input: Uint8Array | Buffer): StudentRosterRow[] {
  const file = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (file.length < 8) throw new Error("Excel檔案內容為空或不完整");
  if (hasPrefix(file, XLS_MAGIC)) return parseLegacyXls(file);
  if (hasPrefix(file, ZIP_MAGIC)) return parseXlsx(file);
  throw new Error("不支援此檔案格式，請上傳.xls或.xlsx學生名單");
}
