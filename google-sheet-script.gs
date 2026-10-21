// Paste this into your Google Sheet: Extensions → Apps Script → replace everything → Save.
// Then Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → Deploy.
// Copy the Web app URL (ends in /exec) into Vercel as SHEET_WEBHOOK_URL.

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Received (Melbourne)', 'Name', 'Answer', 'Drink', 'Message']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const d = JSON.parse(e.postData.contents || '{}');
  // update the guest's earlier row if they change their answer, otherwise add a new row
  const names = sheet.getRange(1, 2, Math.max(sheet.getLastRow(), 1), 1).getValues().map(r => String(r[0]).trim().toLowerCase());
  const at = names.indexOf(String(d.name || '').trim().toLowerCase());
  const row = [d.when || new Date(), d.name || '', d.answer || '', d.drink || '', d.note || ''];
  if (at > 0) sheet.getRange(at + 1, 1, 1, 5).setValues([row]);
  else sheet.appendRow(row);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
