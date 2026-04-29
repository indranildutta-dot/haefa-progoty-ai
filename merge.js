const fs = require('fs');
const file1 = 'web/src/data/icd11PrimaryCareSouthAsia.json';
const file2 = 'web/src/data/icd11PrimaryCareSouthAsia_batch2.json';
const data1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
const data2 = JSON.parse(fs.readFileSync(file2, 'utf8'));

// merge and deduplicate
const allData = [...data1, ...data2];
const unique = [];
const seen = new Set();
for (const item of allData) {
  if (!seen.has(item.code)) {
    seen.add(item.code);
    unique.push(item);
  }
}

fs.writeFileSync(file1, JSON.stringify(unique, null, 2));
console.log('Merged! Total unique records: ' + unique.length);
try { fs.unlinkSync(file2); } catch (e) {} // clean up
