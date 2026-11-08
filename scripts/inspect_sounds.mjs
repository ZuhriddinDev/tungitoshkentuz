import fs from 'node:fs';

const text = fs.readFileSync('scripts/cars_raw.json', 'utf8');
const end = text.indexOf('\n];');
const data = JSON.parse(text.slice(0, end + 2));
console.log(`Found ${data.length} cars:`);
for (const c of data) {
  console.log(`- id: ${c.id.padEnd(16)} | make: ${(c.make + ' ' + c.model).padEnd(24)} | engine: ${(c.engine.layout + ' ' + c.engine.displacement + 'L ' + c.engine.aspiration).padEnd(18)} | sound: ${c.sound.padEnd(24)} | credit: ${c.soundCredit?.name} (${c.soundCredit?.url})`);
}
fs.writeFileSync('scripts/cars_parsed.json', JSON.stringify(data, null, 2));
