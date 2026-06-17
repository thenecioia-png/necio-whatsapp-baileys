const fs = require('fs');
const path = require('path');

let pdfParse = null;
let mammoth = null;
let xlsx = null;

try { pdfParse = require('pdf-parse'); } catch (e) { pdfParse = null; }
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }
try { xlsx = require('xlsx'); } catch (e) { xlsx = null; }

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath, ext);

  try {
    if (ext === '.pdf' && pdfParse) {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return `# ${filename.toUpperCase()}\n\n${data.text || '[PDF sin texto extraíble]'}`;
    }

    if ((ext === '.docx' || ext === '.doc') && mammoth) {
      const result = await mammoth.extractRawText({ path: filePath });
      return `# ${filename.toUpperCase()}\n\n${result.value || '[DOCX sin texto]'}`;
    }

    if ((ext === '.xlsx' || ext === '.xls' || ext === '.csv') && xlsx) {
      const workbook = xlsx.readFile(filePath);
      let md = `# ${filename.toUpperCase()}\n\n`;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        md += `## Hoja: ${sheetName}\n\n`;
        for (const row of json) {
          if (row.length === 0) continue;
          md += row.map(c => String(c || '').replace(/\|/g, '\\|')).join(' | ') + '\n';
        }
        md += '\n';
      }
      return md;
    }

    const text = fs.readFileSync(filePath, 'utf8');
    return text;
  } catch (e) {
    console.error(`[!] Error parseando ${ext}:`, e.message);
    return `# ${filename.toUpperCase()}\n\n[Error al leer el documento: ${e.message}]`;
  }
}

module.exports = { parseDocument };
