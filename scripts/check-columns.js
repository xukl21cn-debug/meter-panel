const Papa = require('papaparse');
const fs = require('fs');

function check(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  const res = Papa.parse(buf.toString('utf8').trim(), { header: true, skipEmptyLines: true });
  const header = res.meta.fields || [];
  const rows = res.data;
  console.log('\n====', file.split(/[\\/]/).pop(), '====');
  console.log('表头列数:', header.length, '->', JSON.stringify(header));
  const bad = [];
  for (const r of rows) {
    const k = Object.keys(r).filter((x) => x !== '_idx');
    const extra = k.filter((x) => !header.includes(x));
    const missing = header.filter((x) => !(x in r));
    if (extra.length || missing.length) bad.push({ extra, missing, sample: JSON.stringify(r).slice(0, 120) });
  }
  console.log('行数:', rows.length, '| 列不匹配的行数:', bad.length);
  if (bad.length) bad.slice(0, 5).forEach((b) => console.log('  不匹配:', JSON.stringify(b)));
  // 检查是否有行带 __parsed_extra(多余的逗号字段)
  const extraIdx = rows.filter((r) => Array.isArray(r.__parsed_extra));
  console.log('存在多余逗号字段(__parsed_extra)的行数:', extraIdx.length);
}

check('C:/Users/59916/Desktop/meter-panel/resources/meter-data/power_meter.csv');
check('C:/Users/59916/Desktop/meter-panel/resources/meter-data/water_meter.csv');