const xlsx = require('xlsx');

const workbook = xlsx.readFile('public/zedy-pedidos-2026-03-10-2026-03-10.1773182814112.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Headers:", data[0]);
console.log("First row data:", data[1]);
