import fs from 'node:fs';
import path from 'node:path';

const WIKI_FILES = [
  { name: 'startup.ogg', title: 'File:Open Corsa E model 2014 engine startup sound.ogg' },
  { name: 'ferrari_599_hgte.ogg', title: 'File:Ferrari 599 HGTE.ogg' },
  { name: 'lambo_aventador.ogg', title: 'File:Lamborghini Aventador LP700-4 (2011).ogg' },
  { name: 'tesla_roadster.ogg', title: 'File:Tesla Roadster.ogg' },
  { name: 'mercedes_sls_amg.ogg', title: 'File:Mercedes-Benz SLS AMG.ogg' },
  { name: 'corvette_zr1.ogg', title: 'File:Chevrolet Corvette C6 ZR1 recorded2010.ogg' },
  { name: 'aston_v12.ogg', title: 'File:Aston-Martin-V12-Vantage.ogg' },
  { name: 'accord_startup.ogg', title: 'File:1997AccordSE enginestart.ogg' },
];

async function downloadWiki() {
  const outDir = path.resolve('audio/sources');
  fs.mkdirSync(outDir, { recursive: true });

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  for (const item of WIKI_FILES) {
    const dest = path.join(outDir, item.name);
    // remove corrupted files
    if (fs.existsSync(dest) && fs.statSync(dest).size < 10000) {
      fs.unlinkSync(dest);
    }
    if (fs.existsSync(dest) && fs.statSync(dest).size >= 10000) {
      console.log(`Already exists: ${item.name} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
      continue;
    }

    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
    console.log(`Querying ${item.title}...`);
    try {
      const apiRes = await fetch(apiUrl, { headers });
      const apiData = await apiRes.json();
      const page = Object.values(apiData.query.pages)[0];
      let fileUrl = page.imageinfo[0].url;
      // Strip query parameters
      fileUrl = fileUrl.split('?')[0];

      console.log(`Downloading ${fileUrl}...`);
      const fileRes = await fetch(fileUrl, { headers });
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
      const buf = Buffer.from(await fileRes.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`Saved ${item.name} (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`Failed ${item.name}:`, err.message);
    }
  }
}

downloadWiki().catch(console.error);
