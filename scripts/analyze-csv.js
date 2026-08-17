const Papa = require('papaparse');
const fs = require('fs');

function analyze(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  const text = buf.toString('utf8');
  const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  const rows = res.data;
  const first = rows[0] || {};
  const keys = Object.keys(first);
  console.log(file.split(/[\\/]/).pop(), '=> rows:', rows.length, '| columns:', keys.join(' | '));
  console.log('  示例行:', JSON.stringify(first));
  for (const k of keys) {
    let num = 0, seen = 0;
    for (const r of rows) {
      const v = r[k];
      if (v === undefined || v === null || v === '') continue;
      seen++;
      if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim())) num++;
      if (seen >= 80) break;
    }
    console.log('  ', k, '->', seen >= 3 && num >= Math.max(3, Math.ceil(seen * 0.6)) ? 'numeric' : 'text', '(sampled ' + seen + ')');
  }
  const valueCol = keys[keys.length - 1];
  const emptyCount = rows.filter((r) => !r[valueCol] || r[valueCol] === '').length;
  if (/water/.test(file)) console.log('  最后一个值列(累计流量)为空的行数:', emptyCount, '/', rows.length);
}

analyze('C:/Users/59916/Desktop/power_meter.csv');
analyze('C:/Users/59916/Desktop/water_meter.csv');