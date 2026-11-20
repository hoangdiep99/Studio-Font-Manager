const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { exec, execSync } = require('child_process');

const PORT = 3456;
const APP_DIR = __dirname;
const CUSTOM_FONTS_DIR = path.join(APP_DIR, 'fonts');
const TRASH_FONTS_DIR = path.join(APP_DIR, 'trash_fonts');
const DATA_DIR = path.join(APP_DIR, 'data');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

// Ensure directories exist
if (!fs.existsSync(CUSTOM_FONTS_DIR)) fs.mkdirSync(CUSTOM_FONTS_DIR, { recursive: true });
if (!fs.existsSync(TRASH_FONTS_DIR)) fs.mkdirSync(TRASH_FONTS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Default metadata
function loadMetadata() {
  if (!fs.existsSync(METADATA_FILE)) {
    const initial = {
      customFolders: [],
      includeWindowsFonts: true,
      hideSystemFonts: true,
      onlyVietnameseUnicode: true,
      fonts: {} // key: fontId -> { favorite: bool, hidden: bool, tags: [], customCode: '' }
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  } catch (e) {
    return {
      customFolders: [],
      includeWindowsFonts: true,
      hideSystemFonts: true,
      onlyVietnameseUnicode: false,
      fonts: {}
    };
  }
}

function saveMetadata(meta) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2), 'utf8');
}

// Common Windows system UI fonts that wedding studios usually don't use for wedding prints
const SYSTEM_FONT_PREFIXES = [
  'arial', 'calibri', 'cambria', 'candara', 'comicsans', 'consola', 'constan',
  'corbel', 'cour', 'ebrima', 'framd', 'gabriola', 'gadugi', 'georgia', 'himalaya',
  'impact', 'inkfree', 'javatext', 'leelawui', 'lucon', 'malgun', 'marlett',
  'micross', 'mingliu', 'mmrtext', 'monbaiti', 'msgothic', 'msyi', 'mvboli',
  'myantext', 'ntailu', 'pala', 'phagspa', 'angsana', 'browallia', 'cordia',
  'upcd', 'upce', 'upcf', 'upci', 'upcj', 'upck', 'upcl', 'segoe', 'simsun',
  'sitka', 'sylfaen', 'symbol', 'tahoma', 'times', 'trebuc', 'verdana', 'webdings',
  'wingding', 'yuGoth', 'bahnschrift', 'holomdl2', 'sansserifcollection', ' Cascadia'
].map(s => s.toLowerCase().trim());

// Vietnamese sample codepoints required for full Unicode Vietnamese support
const VN_REQUIRED_CHARS = 'ĐđĂăÂâÊêÔôƠơƯưẮắẰằẲẳẴẵẶặẤấẦầẨẩẪẫẬậẾếỀềỂểỄễỆệỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹÁáÀàẢảÃãẠạÉéÈèẺẻẼẽẸẹÍíÌìỈỉĨĩỊịÓóÒòỎỏÕõỌọÚúÙùỦủŨũỤụÝý';
const VN_CODEPOINTS = Array.from(VN_REQUIRED_CHARS).map(c => c.codePointAt(0));

/**
 * Fast binary parser for TrueType / OpenType (.ttf / .otf) to extract:
 * - Font Family / Full Name from 'name' table
 * - Unicode cmap coverage for Vietnamese characters
 */
function parseFontFile(filePath) {
  let fd;
  try {
    const stat = fs.statSync(filePath);
    // Read full buffer if < 15MB, otherwise skip
    if (stat.size > 25 * 1024 * 1024 || stat.size < 64) return null;
    const buf = fs.readFileSync(filePath);

    const tag = buf.toString('ascii', 0, 4);
    let offset = 0;
    if (tag === 'ttcf') {
      // TrueType Collection: read first font offset
      if (buf.length < 16) return null;
      offset = buf.readUInt32BE(12);
    } else if (tag !== '\x00\x01\x00\x00' && tag !== 'OTTO' && tag !== 'true') {
      return null;
    }

    if (offset + 12 > buf.length) return null;
    const numTables = buf.readUInt16BE(offset + 4);
    let nameTableOffset = 0;
    let nameTableLength = 0;
    let cmapTableOffset = 0;
    let cmapTableLength = 0;

    for (let i = 0; i < numTables; i++) {
      const recOffset = offset + 12 + i * 16;
      if (recOffset + 16 > buf.length) break;
      const tTag = buf.toString('ascii', recOffset, recOffset + 4);
      const tOffset = buf.readUInt32BE(recOffset + 8);
      const tLength = buf.readUInt32BE(recOffset + 12);
      if (tTag === 'name') {
        nameTableOffset = tOffset;
        nameTableLength = tLength;
      } else if (tTag === 'cmap') {
        cmapTableOffset = tOffset;
        cmapTableLength = tLength;
      }
    }

    // Parse 'name' table
    let familyName = '';
    let fullName = '';
    let subfamilyName = '';
    if (nameTableOffset && nameTableOffset + 6 <= buf.length) {
      const count = buf.readUInt16BE(nameTableOffset + 2);
      const stringOffset = nameTableOffset + buf.readUInt16BE(nameTableOffset + 4);
      for (let i = 0; i < count; i++) {
        const rOff = nameTableOffset + 6 + i * 12;
        if (rOff + 12 > buf.length) break;
        const platformID = buf.readUInt16BE(rOff);
        const encodingID = buf.readUInt16BE(rOff + 2);
        const languageID = buf.readUInt16BE(rOff + 4);
        const nameID = buf.readUInt16BE(rOff + 6);
        const length = buf.readUInt16BE(rOff + 8);
        const strOff = stringOffset + buf.readUInt16BE(rOff + 10);

        if (strOff + length > buf.length) continue;
        if (nameID !== 1 && nameID !== 2 && nameID !== 4 && nameID !== 16) continue;

        let str = '';
        if (platformID === 3 || platformID === 0) {
          // UTF-16BE
          const chars = [];
          for (let j = 0; j < length; j += 2) {
            chars.push(buf.readUInt16BE(strOff + j));
          }
          str = String.fromCharCode(...chars).replace(/\0/g, '').trim();
        } else if (platformID === 1 && encodingID === 0) {
          str = buf.toString('latin1', strOff, strOff + length).replace(/\0/g, '').trim();
        }

        if (!str) continue;
        // Prefer English (0x0409) or first valid
        const isPreferred = (platformID === 3 && (languageID === 0x0409 || languageID === 0));
        if (nameID === 1 && (!familyName || isPreferred)) familyName = str;
        if (nameID === 2 && (!subfamilyName || isPreferred)) subfamilyName = str;
        if (nameID === 4 && (!fullName || isPreferred)) fullName = str;
        if (nameID === 16 && isPreferred) familyName = str;
      }
    }

    // Parse 'cmap' table for Unicode coverage
    let unicodeChecker = null;
    if (cmapTableOffset && cmapTableOffset + 4 <= buf.length) {
      const numSubtables = buf.readUInt16BE(cmapTableOffset + 2);
      let format4Offset = 0;
      let format12Offset = 0;

      for (let i = 0; i < numSubtables; i++) {
        const sOff = cmapTableOffset + 4 + i * 8;
        if (sOff + 8 > buf.length) break;
        const platformID = buf.readUInt16BE(sOff);
        const encodingID = buf.readUInt16BE(sOff + 2);
        const subOffset = cmapTableOffset + buf.readUInt32BE(sOff + 4);
        if (subOffset + 4 > buf.length) continue;

        const isUnicode = (platformID === 0) || (platformID === 3 && (encodingID === 1 || encodingID === 10));
        if (!isUnicode) continue;

        const format = buf.readUInt16BE(subOffset);
        if (format === 12) format12Offset = subOffset;
        else if (format === 4 && !format4Offset) format4Offset = subOffset;
      }

      if (format12Offset && format12Offset + 16 <= buf.length) {
        const nGroups = buf.readUInt32BE(format12Offset + 12);
        const groups = [];
        for (let i = 0; i < nGroups; i++) {
          const gOff = format12Offset + 16 + i * 12;
          if (gOff + 12 > buf.length) break;
          groups.push([buf.readUInt32BE(gOff), buf.readUInt32BE(gOff + 4)]);
        }
        unicodeChecker = (cp) => {
          let lo = 0, hi = groups.length - 1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const [start, end] = groups[mid];
            if (cp < start) hi = mid - 1;
            else if (cp > end) lo = mid + 1;
            else return true;
          }
          return false;
        };
      } else if (format4Offset && format4Offset + 14 <= buf.length) {
        const segCountX2 = buf.readUInt16BE(format4Offset + 6);
        const segCount = segCountX2 / 2;
        const endCountOffset = format4Offset + 14;
        const startCountOffset = endCountOffset + segCountX2 + 2;
        const idDeltaOffset = startCountOffset + segCountX2;
        const idRangeOffsetOffset = idDeltaOffset + segCountX2;

        if (idRangeOffsetOffset + segCountX2 <= buf.length) {
          const segments = [];
          for (let i = 0; i < segCount; i++) {
            const endCode = buf.readUInt16BE(endCountOffset + i * 2);
            const startCode = buf.readUInt16BE(startCountOffset + i * 2);
            const idDelta = buf.readInt16BE(idDeltaOffset + i * 2);
            const idRangeOffset = buf.readUInt16BE(idRangeOffsetOffset + i * 2);
            if (startCode === 0xFFFF && endCode === 0xFFFF) break;
            segments.push({ startCode, endCode, idDelta, idRangeOffset, idxOffset: idRangeOffsetOffset + i * 2 });
          }
          unicodeChecker = (cp) => {
            for (let i = 0; i < segments.length; i++) {
              const s = segments[i];
              if (cp >= s.startCode && cp <= s.endCode) {
                if (s.idRangeOffset === 0) {
                  return ((cp + s.idDelta) & 0xFFFF) !== 0;
                } else {
                  const glyphAddress = s.idxOffset + s.idRangeOffset + (cp - s.startCode) * 2;
                  if (glyphAddress + 2 > buf.length) return false;
                  const glyphId = buf.readUInt16BE(glyphAddress);
                  return glyphId !== 0;
                }
              }
            }
            return false;
          };
        }
      }
    }

    let vnSupportedCount = 0;
    if (unicodeChecker) {
      for (const cp of VN_CODEPOINTS) {
        if (unicodeChecker(cp)) vnSupportedCount++;
      }
    }
    const vnCoverageRatio = VN_CODEPOINTS.length > 0 ? (vnSupportedCount / VN_CODEPOINTS.length) : 0;

    const baseName = path.basename(filePath, path.extname(filePath));
    const displayName = fullName || familyName || baseName;
    const lowerName = displayName.toLowerCase();
    const lowerFile = baseName.toLowerCase();

    // Detect encoding type
    let encoding = 'Unicode';
    if (lowerName.startsWith('.vn') || lowerFile.startsWith('vn') && lowerName.includes('.vn')) {
      encoding = 'TCVN3 (.Vn)';
    } else if (lowerName.startsWith('vni-') || lowerName.startsWith('vni ') || lowerFile.startsWith('vni')) {
      encoding = 'VNI';
    } else if (vnCoverageRatio >= 0.85) {
      encoding = 'Unicode Tiếng Việt';
    } else if (vnCoverageRatio >= 0.3) {
      encoding = 'Thiếu một số dấu TV';
    } else {
      encoding = 'Không có dấu TV (ASCII)';
    }

    // Auto-suggest category tags based on font name
    const autoCategory = detectAutoCategory(displayName, subfamilyName);

    const isSystemFont = SYSTEM_FONT_PREFIXES.some(prefix =>
      lowerFile.startsWith(prefix) || lowerName.startsWith(prefix)
    );

    return {
      displayName,
      familyName: familyName || baseName,
      subfamilyName,
      vnCoverage: Math.round(vnCoverageRatio * 100),
      isVietnameseUnicode: vnCoverageRatio >= 0.85,
      encoding,
      isSystemFont,
      autoCategory
    };
  } catch (err) {
    return null;
  }
}

function detectAutoCategory(name, subfamily = '') {
  const s = (name + ' ' + subfamily).toLowerCase();
  if (
    s.includes('script') || s.includes('hand') || s.includes('sign') ||
    s.includes('brush') || s.includes('callig') || s.includes('wedding') ||
    s.includes('love') || s.includes('rose') || s.includes('angel') ||
    s.includes('daisy') || s.includes('honey') || s.includes('beauty') ||
    s.includes('charm') || s.includes('dance') || s.includes('romance') ||
    s.includes('butter') || s.includes('hello') || s.includes('sweet')
  ) {
    return 'Viết tay / Chữ ký';
  }
  if (
    s.includes('serif') && !s.includes('sans') ||
    s.includes('display') || s.includes('bodoni') || s.includes('didot') ||
    s.includes('playfair') || s.includes('cormorant') || s.includes('cinzel') ||
    s.includes('luxury') || s.includes('royal') || s.includes('classic') ||
    s.includes('roman') || s.includes('garamond') || s.includes('antiqua')
  ) {
    return 'Sang trọng';
  }
  if (
    s.includes('sans') || s.includes('modern') || s.includes('geometric') ||
    s.includes('futura') || s.includes('montserrat') || s.includes('Gotham') ||
    s.includes('avenir') || s.includes('proxima') || s.includes('minimal')
  ) {
    return 'Hiện đại';
  }
  return 'Nghệ thuật / Khác';
}

// Cache parsed fonts by file path + mtime
const fontParseCache = new Map();

function scanDirectoryForFonts(dirPath, sourceType, sourceLabel) {
  const results = [];
  if (!dirPath || !fs.existsSync(dirPath)) return results;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Recurse 1 level for custom folders
      if (sourceType === 'custom') {
        results.push(...scanDirectoryForFonts(fullPath, sourceType, sourceLabel));
      }
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.ttf', '.otf'].includes(ext)) continue;

    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    const cacheKey = `${fullPath}|${stat.mtimeMs}`;
    let parsed = fontParseCache.get(cacheKey);
    if (!parsed) {
      parsed = parseFontFile(fullPath);
      if (parsed) fontParseCache.set(cacheKey, parsed);
    }
    if (!parsed) continue;

    const id = Buffer.from(fullPath).toString('base64url');
    results.push({
      id,
      fileName: entry.name,
      filePath: fullPath,
      sourceType,
      sourceLabel,
      ...parsed
    });
  }
  return results;
}

function getAllFonts() {
  const meta = loadMetadata();
  const allFonts = [];
  const seenPaths = new Set();

  // 1. Built-in custom fonts folder ./fonts
  const appFonts = scanDirectoryForFonts(CUSTOM_FONTS_DIR, 'custom', 'Thư mục App (./fonts)');
  for (const f of appFonts) {
    if (!seenPaths.has(f.filePath.toLowerCase())) {
      seenPaths.add(f.filePath.toLowerCase());
      allFonts.push(f);
    }
  }

  // 2. Additional custom folders added by user
  if (Array.isArray(meta.customFolders)) {
    for (const folder of meta.customFolders) {
      const list = scanDirectoryForFonts(folder, 'custom', folder);
      for (const f of list) {
        if (!seenPaths.has(f.filePath.toLowerCase())) {
          seenPaths.add(f.filePath.toLowerCase());
          allFonts.push(f);
        }
      }
    }
  }

  // 3. Windows Installed Fonts (User & System)
  if (meta.includeWindowsFonts !== false) {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const userFontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
    const sysFontsDir = 'C:\\Windows\\Fonts';

    const userFonts = scanDirectoryForFonts(userFontsDir, 'user_win', 'Font cài riêng trên máy');
    for (const f of userFonts) {
      if (!seenPaths.has(f.filePath.toLowerCase())) {
        seenPaths.add(f.filePath.toLowerCase());
        allFonts.push(f);
      }
    }

    const sysFonts = scanDirectoryForFonts(sysFontsDir, 'system_win', 'Windows Fonts');
    for (const f of sysFonts) {
      if (!seenPaths.has(f.filePath.toLowerCase())) {
        seenPaths.add(f.filePath.toLowerCase());
        allFonts.push(f);
      }
    }
  }

  // Track which fonts are installed in Windows (by name or fileName)
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const userFontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
  const sysFontsDir = 'C:\\Windows\\Fonts';
  const installedKeys = new Set();
  const installedFileNames = new Set();
  for (const f of allFonts) {
    if (f.sourceType === 'user_win' || f.sourceType === 'system_win') {
      installedKeys.add(`${f.displayName}|${f.subfamilyName}`.toLowerCase());
      installedFileNames.add(f.fileName.toLowerCase());
    }
  }
  try {
    if (fs.existsSync(userFontsDir)) {
      fs.readdirSync(userFontsDir).forEach(fn => installedFileNames.add(fn.toLowerCase()));
    }
    if (fs.existsSync(sysFontsDir)) {
      fs.readdirSync(sysFontsDir).forEach(fn => installedFileNames.add(fn.toLowerCase()));
    }
  } catch (e) {}

  // Remove duplicates (same font installed in both user & system folders)
  const seenNames = new Set();
  const uniqueFonts = allFonts.filter((f) => {
    const key = `${f.displayName}|${f.subfamilyName}`.toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // Attach user metadata (favorite, hidden, tags, customCode)
  const enriched = uniqueFonts.map((f) => {
    const userMeta = (meta.fonts && meta.fonts[f.id]) || (meta.fonts && meta.fonts[f.fileName]) || {};
    const tags = Array.isArray(userMeta.tags) ? userMeta.tags : [f.autoCategory];
    const key = `${f.displayName}|${f.subfamilyName}`.toLowerCase();
    const isInstalled = f.sourceType === 'user_win' || f.sourceType === 'system_win' ||
      installedKeys.has(key) || installedFileNames.has(f.fileName.toLowerCase());
    return {
      ...f,
      isInstalled,
      canDelete: !(f.sourceType === 'system_win' && f.isSystemFont),
      favorite: !!userMeta.favorite,
      hidden: !!userMeta.hidden,
      tags,
      note: userMeta.note || ''
    };
  });

  // Sort nicely: Favorites first, then custom folders, then alphabetical by displayName
  enriched.sort((a, b) => {
    if (a.sourceType === 'custom' && b.sourceType !== 'custom') return -1;
    if (a.sourceType !== 'custom' && b.sourceType === 'custom') return 1;
    return a.displayName.localeCompare(b.displayName, 'vi');
  });

  return {
    fonts: enriched,
    settings: {
      customFolders: meta.customFolders || [],
      includeWindowsFonts: meta.includeWindowsFonts !== false,
      hideSystemFonts: meta.hideSystemFonts !== false,
      onlyVietnameseUnicode: !!meta.onlyVietnameseUnicode,
      lastPreviewText: meta.lastPreviewText || 'Hoàng Điệp & Trịnh Hướng',
      recentTexts: Array.isArray(meta.recentTexts) ? meta.recentTexts : ['Hoàng Điệp & Trịnh Hướng', 'Đức Huy & Hà My'],
      appFontsDir: CUSTOM_FONTS_DIR
    }
  };
}

// Helper to read JSON body
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Open native Windows Folder Picker dialog via PowerShell
function pickFolderDialog() {
  return new Promise((resolve) => {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Chọn thư mục chứa Phông chữ (.ttf, .otf)"
$f.ShowNewFolderButton = $false
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
if ($f.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $f.SelectedPath
}
`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -STA -EncodedCommand ${encoded}`, (err, stdout) => {
      if (err) return resolve('');
      resolve((stdout || '').trim());
    });
  });
}

// Open native Windows File Picker dialog to select .ZIP or .TTF/.OTF files for installation
function pickFontOrZipFilesDialog() {
  return new Promise((resolve) => {
    const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.Title = "Chọn file Font (.ttf, .otf) hoặc file nén (.zip) để cài đặt vào máy"
$f.Filter = "Font & File Nén ZIP (*.zip;*.ttf;*.otf)|*.zip;*.ttf;*.otf|File nén ZIP (*.zip)|*.zip|File Font (*.ttf;*.otf)|*.ttf;*.otf"
$f.Multiselect = $true
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
if ($f.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) {
  foreach ($p in $f.FileNames) {
    Write-Output $p
  }
}
`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -STA -EncodedCommand ${encoded}`, { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve([]);
      const lines = (stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      resolve(lines);
    });
  });
}

// Pure Node.js extractor for .TTF / .OTF files inside a .ZIP archive buffer
function extractFontsFromZipBuffer(zipBuf) {
  const results = [];
  // Find End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minPos = Math.max(0, zipBuf.length - 65557);
  for (let i = zipBuf.length - 22; i >= minPos; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return results;

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = zipBuf.readUInt32LE(eocdOffset + 16);
  let pos = centralDirOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > zipBuf.length) break;
    if (zipBuf.readUInt32LE(pos) !== 0x02014b50) break;

    const method = zipBuf.readUInt16LE(pos + 10);
    const compSize = zipBuf.readUInt32LE(pos + 20);
    const nameLen = zipBuf.readUInt16LE(pos + 28);
    const extraLen = zipBuf.readUInt16LE(pos + 30);
    const commentLen = zipBuf.readUInt16LE(pos + 32);
    const localHeaderOffset = zipBuf.readUInt32LE(pos + 42);

    const entryName = zipBuf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    const baseName = path.basename(entryName);
    const ext = path.extname(baseName).toLowerCase();
    if (!['.ttf', '.otf'].includes(ext)) continue;
    if (entryName.includes('__MACOSX') || baseName.startsWith('._')) continue;

    if (localHeaderOffset + 30 > zipBuf.length) continue;
    if (zipBuf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = zipBuf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compSize > zipBuf.length) continue;

    const compSlice = zipBuf.subarray(dataStart, dataStart + compSize);
    try {
      let dataBuf = null;
      if (method === 0) {
        dataBuf = Buffer.from(compSlice);
      } else if (method === 8) {
        dataBuf = zlib.inflateRawSync(compSlice);
      }
      if (dataBuf && dataBuf.length > 64) {
        results.push({ fileName: baseName, data: dataBuf });
      }
    } catch (e) {}
  }
  return results;
}

function installFontBuffersToWindows(fontItems) {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const userFontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
  if (!fs.existsSync(userFontsDir)) fs.mkdirSync(userFontsDir, { recursive: true });

  let installedCount = 0;
  let alreadyCount = 0;
  const installedPaths = [];

  for (const item of fontItems) {
    const safeName = path.basename(item.fileName).replace(/[^a-zA-Z0-9._\-\s()\u00C0-\u1EF9]/g, '_');
    const destPath = path.join(userFontsDir, safeName);
    const sysPath = path.join('C:\\Windows\\Fonts', safeName);

    if (fs.existsSync(destPath) || fs.existsSync(sysPath)) {
      alreadyCount++;
      continue;
    }

    try {
      fs.writeFileSync(destPath, item.data);
      const parsed = parseFontFile(destPath);
      const ext = path.extname(safeName).toLowerCase();
      const typeLabel = ext === '.otf' ? '(OpenType)' : '(TrueType)';
      const regName = `${(parsed && parsed.displayName) || path.basename(safeName, ext)} ${typeLabel}`.replace(/"/g, '');
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${regName}" /t REG_SZ /d "${destPath}" /f`, { stdio: 'ignore' });
      installedPaths.push(destPath);
      installedCount++;
    } catch (e) {
      console.error('Install buffer error:', e.message);
    }
  }

  if (installedPaths.length > 0) {
    const psNotify = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class FontBroadcast {
    [DllImport("gdi32.dll", CharSet = CharSet.Auto)]
    public static extern int AddFontResource(string lpszFilename);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
${installedPaths.map(p => `[FontBroadcast]::AddFontResource('${p.replace(/'/g, "''")}') | Out-Null`).join('\n')}
$res = [IntPtr]::Zero
[FontBroadcast]::SendMessageTimeout([IntPtr]0xffff, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$res) | Out-Null
`;
    const encoded = Buffer.from(psNotify, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -EncodedCommand ${encoded}`);
  }

  return { installedCount, alreadyCount, totalFound: fontItems.length };
}

// Fast pure-Node.js ZIP archive builder (DEFLATE + UTF-8 filenames)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Buf(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const rawData = fs.readFileSync(entry.filePath);
    const compressed = zlib.deflateRawSync(rawData);
    const nameBuf = Buffer.from(entry.fileName, 'utf8');
    const crc = crc32Buf(rawData);

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // flags: bit 11 = UTF-8
    localHeader.writeUInt16LE(8, 8);          // compression: 8 = deflate
    localHeader.writeUInt16LE(0, 10);         // mod time
    localHeader.writeUInt16LE(0x5721, 12);    // mod date
    localHeader.writeUInt32LE(crc, 14);       // crc32
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(rawData.length, 22);    // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);    // file name length
    localHeader.writeUInt16LE(0, 28);         // extra field length
    nameBuf.copy(localHeader, 30);

    localParts.push(localHeader, compressed);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // flags: UTF-8
    centralHeader.writeUInt16LE(8, 10);         // compression: deflate
    centralHeader.writeUInt16LE(0, 12);         // mod time
    centralHeader.writeUInt16LE(0x5721, 14);    // mod date
    centralHeader.writeUInt32LE(crc, 16);       // crc32
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // extra length
    centralHeader.writeUInt16LE(0, 32);         // comment length
    centralHeader.writeUInt16LE(0, 34);         // disk number
    centralHeader.writeUInt16LE(0, 36);         // internal attrs
    centralHeader.writeUInt32LE(0, 38);         // external attrs
    centralHeader.writeUInt32LE(offset, 42);    // local header offset
    nameBuf.copy(centralHeader, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // API: Get all fonts + settings
    if (pathname === '/api/fonts' && req.method === 'GET') {
      const data = getAllFonts();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(data));
    }

    // API: Serve binary font file by ID
    if (pathname.startsWith('/api/font-file/') && req.method === 'GET') {
      const id = pathname.replace('/api/font-file/', '');
      const filePath = Buffer.from(id, 'base64url').toString('utf8');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.otf' ? 'font/otf' : 'font/ttf';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // API: Update font metadata (favorite, hidden, tags, bulk actions)
    if (pathname === '/api/font-meta' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const meta = loadMetadata();
      if (!meta.fonts) meta.fonts = {};

      const updates = Array.isArray(body.updates) ? body.updates : [body];
      for (const u of updates) {
        if (!u.id) continue;
        const current = meta.fonts[u.id] || {};
        if (typeof u.favorite === 'boolean') current.favorite = u.favorite;
        if (typeof u.hidden === 'boolean') current.hidden = u.hidden;
        if (Array.isArray(u.tags)) current.tags = u.tags;
        if (typeof u.note === 'string') current.note = u.note;
        meta.fonts[u.id] = current;
      }
      saveMetadata(meta);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // API: Update settings / custom folders / recent preview texts
    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const meta = loadMetadata();
      if (typeof body.includeWindowsFonts === 'boolean') meta.includeWindowsFonts = body.includeWindowsFonts;
      if (typeof body.hideSystemFonts === 'boolean') meta.hideSystemFonts = body.hideSystemFonts;
      if (typeof body.onlyVietnameseUnicode === 'boolean') meta.onlyVietnameseUnicode = body.onlyVietnameseUnicode;
      if (Array.isArray(body.customFolders)) meta.customFolders = body.customFolders;
      if (typeof body.lastPreviewText === 'string') meta.lastPreviewText = body.lastPreviewText;
      if (Array.isArray(body.recentTexts)) meta.recentTexts = body.recentTexts.slice(0, 15);
      saveMetadata(meta);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // API: Pick a folder using Windows native dialog
    if (pathname === '/api/pick-folder' && req.method === 'POST') {
      const folderPath = await pickFolderDialog();
      if (folderPath && fs.existsSync(folderPath)) {
        const meta = loadMetadata();
        if (!Array.isArray(meta.customFolders)) meta.customFolders = [];
        if (!meta.customFolders.includes(folderPath)) {
          meta.customFolders.push(folderPath);
          saveMetadata(meta);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, folderPath }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false }));
    }

    // API: Open Windows File Dialog to pick .ZIP or .TTF/.OTF files and install directly into Windows
    if (pathname === '/api/pick-and-install-fonts' && req.method === 'POST') {
      const selectedPaths = await pickFontOrZipFilesDialog();
      if (!selectedPaths || selectedPaths.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, cancelled: true }));
      }

      const fontItems = [];
      for (const p of selectedPaths) {
        if (!fs.existsSync(p)) continue;
        const ext = path.extname(p).toLowerCase();
        if (ext === '.zip') {
          const zipBuf = fs.readFileSync(p);
          const extracted = extractFontsFromZipBuffer(zipBuf);
          fontItems.push(...extracted);
        } else if (ext === '.ttf' || ext === '.otf') {
          fontItems.push({ fileName: path.basename(p), data: fs.readFileSync(p) });
        }
      }

      const result = installFontBuffersToWindows(fontItems);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ...result }));
    }

    // API: Upload font files or .ZIP directly from browser and install into Windows
    if (pathname === '/api/upload-fonts' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const files = Array.isArray(body.files) ? body.files : [];
      const fontItems = [];
      for (const f of files) {
        if (!f.name || !f.dataBase64) continue;
        const ext = path.extname(f.name).toLowerCase();
        const buf = Buffer.from(f.dataBase64, 'base64');
        if (ext === '.zip') {
          fontItems.push(...extractFontsFromZipBuffer(buf));
        } else if (['.ttf', '.otf'].includes(ext)) {
          fontItems.push({ fileName: path.basename(f.name), data: buf });
        }
      }
      const result = installFontBuffersToWindows(fontItems);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, savedCount: result.installedCount, ...result }));
    }

    // API: Open ./fonts folder in Windows Explorer
    if (pathname === '/api/open-fonts-folder' && req.method === 'POST') {
      exec(`explorer "${CUSTOM_FONTS_DIR}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // API: Open ./trash_fonts folder in Windows Explorer
    if (pathname === '/api/open-trash-folder' && req.method === 'POST') {
      exec(`explorer "${TRASH_FONTS_DIR}"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // API: Install selected fonts into Windows User Fonts + Registry
    if (pathname === '/api/install-fonts' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
      const userFontsDir = path.join(localAppData, 'Microsoft', 'Windows', 'Fonts');
      if (!fs.existsSync(userFontsDir)) fs.mkdirSync(userFontsDir, { recursive: true });

      let installedCount = 0;
      let alreadyCount = 0;
      const installedPaths = [];

      for (const id of ids) {
        let srcPath;
        try {
          srcPath = Buffer.from(id, 'base64url').toString('utf8');
        } catch (e) { continue; }
        if (!srcPath || !fs.existsSync(srcPath)) continue;

        const fileName = path.basename(srcPath);
        const destPath = path.join(userFontsDir, fileName);
        const sysPath = path.join('C:\\Windows\\Fonts', fileName);

        if (srcPath.toLowerCase() === destPath.toLowerCase() || srcPath.toLowerCase() === sysPath.toLowerCase() || fs.existsSync(destPath) || fs.existsSync(sysPath)) {
          alreadyCount++;
          continue;
        }

        try {
          fs.copyFileSync(srcPath, destPath);
          const parsed = parseFontFile(destPath);
          const ext = path.extname(fileName).toLowerCase();
          const typeLabel = ext === '.otf' ? '(OpenType)' : '(TrueType)';
          const regName = `${(parsed && parsed.displayName) || path.basename(fileName, ext)} ${typeLabel}`;
          // Register in HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts
          const safeRegName = regName.replace(/"/g, '');
          execSync(`reg add "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${safeRegName}" /t REG_SZ /d "${destPath}" /f`, { stdio: 'ignore' });
          installedPaths.push(destPath);
          installedCount++;
        } catch (e) {
          console.error('Install font error:', e.message);
        }
      }

      // Broadcast WM_FONTCHANGE so Photoshop / Illustrator / Corel / Excel immediately see new fonts
      if (installedPaths.length > 0) {
        const psNotify = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class FontBroadcast {
    [DllImport("gdi32.dll", CharSet = CharSet.Auto)]
    public static extern int AddFontResource(string lpszFilename);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
${installedPaths.map(p => `[FontBroadcast]::AddFontResource('${p.replace(/'/g, "''")}') | Out-Null`).join('\n')}
$res = [IntPtr]::Zero
[FontBroadcast]::SendMessageTimeout([IntPtr]0xffff, 0x001D, [IntPtr]::Zero, [IntPtr]::Zero, 2, 1000, [ref]$res) | Out-Null
`;
        const encoded = Buffer.from(psNotify, 'utf16le').toString('base64');
        exec(`powershell -NoProfile -EncodedCommand ${encoded}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, installedCount, alreadyCount }));
    }

    // API: Delete / Uninstall selected fonts (moves safely to ./trash_fonts backup folder)
    if (pathname === '/api/delete-fonts' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let deletedCount = 0;
      let skippedSystemCount = 0;

      for (const id of ids) {
        let srcPath;
        try {
          srcPath = Buffer.from(id, 'base64url').toString('utf8');
        } catch (e) { continue; }
        if (!srcPath || !fs.existsSync(srcPath)) continue;

        const parsed = parseFontFile(srcPath);
        const isWinSysDir = srcPath.toLowerCase().startsWith('c:\\windows\\fonts');
        if (isWinSysDir && parsed && parsed.isSystemFont) {
          skippedSystemCount++;
          continue;
        }

        const fileName = path.basename(srcPath);
        const backupName = `${Date.now()}_${fileName}`;
        const trashPath = path.join(TRASH_FONTS_DIR, backupName);

        try {
          fs.copyFileSync(srcPath, trashPath);
          fs.unlinkSync(srcPath);
          deletedCount++;

          // If it was in User Windows Fonts, also clean up HKCU Registry entry
          if (srcPath.toLowerCase().includes('\\microsoft\\windows\\fonts\\') && parsed) {
            const ext = path.extname(fileName).toLowerCase();
            const typeLabel = ext === '.otf' ? '(OpenType)' : '(TrueType)';
            const regName = `${parsed.displayName} ${typeLabel}`.replace(/"/g, '');
            try {
              execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${regName}" /f`, { stdio: 'ignore' });
            } catch (e) {}
          }
        } catch (e) {
          console.error('Delete font error:', e.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, deletedCount, skippedSystemCount }));
    }

    // API: Export selected fonts as a compressed .ZIP archive
    if (pathname === '/api/export-zip' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const entries = [];
      const usedNames = new Set();

      for (const id of ids) {
        let srcPath;
        try {
          srcPath = Buffer.from(id, 'base64url').toString('utf8');
        } catch (e) { continue; }
        if (!srcPath || !fs.existsSync(srcPath)) continue;

        let fileName = path.basename(srcPath);
        if (usedNames.has(fileName.toLowerCase())) {
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          fileName = `${base}_${entries.length + 1}${ext}`;
        }
        usedNames.add(fileName.toLowerCase());
        entries.push({ fileName, filePath: srcPath });
      }

      if (entries.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Không tìm thấy file font để nén ZIP' }));
      }

      const zipBuf = createZipBuffer(entries);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="Bo-Font-Da-Chon.zip"',
        'Content-Length': zipBuf.length
      });
      return res.end(zipBuf);
    }

    // Serve static files from ./public
    let staticPath = pathname === '/' ? '/index.html' : pathname;
    const fullStaticPath = path.join(APP_DIR, 'public', staticPath);
    if (fullStaticPath.startsWith(path.join(APP_DIR, 'public')) && fs.existsSync(fullStaticPath) && fs.statSync(fullStaticPath).isFile()) {
      const ext = path.extname(fullStaticPath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      return fs.createReadStream(fullStaticPath).pipe(res);
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  PHAN MEM QUAN LY & CHON FONT CHU ANH CUOI (DAU RE)`);
  console.log(`  Dang chay tai: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
