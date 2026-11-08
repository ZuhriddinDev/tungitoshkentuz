import fs from 'node:fs';
import path from 'node:path';

function createWavBuffer(samples, sampleRate, numChannels = 1) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
  }
  return buffer;
}

async function buildCommonAudio() {
  const outDir = path.resolve('audio/common');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Gear Shift Sound (from ClunkingGearShifting)
  console.log('Generating gear_shift.wav...');
  const shiftRes = await fetch('https://raw.githubusercontent.com/TheDIYGuy999/Rc_Engine_Sound_ESP32/master/src/vehicles/sounds/ClunkingGearShifting.h');
  const shiftText = await shiftRes.text();
  const shiftSamplesMatch = shiftText.match(/shiftingSamples\[\]\s*=\s*\{([\s\S]*?)\};/);
  const shiftRaw = shiftSamplesMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  // Normalize 8-bit signed (-128..127) to float (-1.0..1.0)
  const shiftFloats = shiftRaw.map(v => v / 128.0);
  const shiftWav = createWavBuffer(shiftFloats, 22050, 1);
  fs.writeFileSync(path.join(outDir, 'shift.wav'), shiftWav);
  console.log(`Saved shift.wav (${(shiftWav.length / 1024).toFixed(1)} KB)`);

  // 2. Turbo Blow-Off / Wastegate (from 1000HpScaniaV8wastegate)
  console.log('Generating blowoff.wav...');
  const bovRes = await fetch('https://raw.githubusercontent.com/TheDIYGuy999/Rc_Engine_Sound_ESP32/master/src/vehicles/sounds/1000HpScaniaV8wastegate.h');
  const bovText = await bovRes.text();
  const bovSamplesMatch = bovText.match(/wastegateSamples\[\]\s*=\s*\{([\s\S]*?)\};/);
  const bovRaw = bovSamplesMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  const bovFloats = bovRaw.map(v => v / 128.0);
  const bovWav = createWavBuffer(bovFloats, 22050, 1);
  fs.writeFileSync(path.join(outDir, 'blowoff.wav'), bovWav);
  console.log(`Saved blowoff.wav (${(bovWav.length / 1024).toFixed(1)} KB)`);

  // 3. Engine Shutdown (Extracted slice from shutdown.wav: 26.8s to 28.5s)
  console.log('Extracting shutdown.wav...');
  const shutBuf = fs.readFileSync('audio/sources/shutdown.wav');
  const dataOffset = 259916 + 8;
  const srcRate = 48000;
  const startSec = 26.8;
  const endSec = 28.5;
  const startFrame = Math.floor(startSec * srcRate);
  const endFrame = Math.floor(endSec * srcRate);
  const numFrames = endFrame - startFrame;

  // Downsample from 48000Hz stereo 24-bit to 24000Hz mono 16-bit
  const targetSamples = [];
  const stride = 2; // downsample by factor of 2 -> 24000 Hz
  for (let f = startFrame; f < endFrame; f += stride) {
    const idx = dataOffset + f * 6; // 6 bytes per 24-bit stereo frame
    // Left channel
    let l = (shutBuf[idx + 2] << 16) | (shutBuf[idx + 1] << 8) | shutBuf[idx];
    if (l >= 0x800000) l -= 0x1000000;
    // Right channel
    let r = (shutBuf[idx + 5] << 16) | (shutBuf[idx + 4] << 8) | shutBuf[idx + 3];
    if (r >= 0x800000) r -= 0x1000000;

    const mono = (l + r) / (2 * 0x7FFFFF); // normalize to -1..1
    targetSamples.push(mono);
  }

  // Apply smooth fade out to tail (last 100ms)
  const fadeCount = Math.floor(24000 * 0.1);
  for (let i = 0; i < fadeCount; i++) {
    const pos = targetSamples.length - 1 - i;
    targetSamples[pos] *= (i / fadeCount);
  }

  const shutWav = createWavBuffer(targetSamples, 24000, 1);
  fs.writeFileSync(path.join(outDir, 'shutdown.wav'), shutWav);
  console.log(`Saved shutdown.wav (${(shutWav.length / 1024).toFixed(1)} KB)`);

  // 4. Exhaust Pops / Burble recordings
  // Create 3 organic, distinct exhaust pops (sharp acoustic pressure spike + low frequency resonant body)
  console.log('Generating exhaust pops...');
  const popPitches = [95, 120, 80];
  popPitches.forEach((baseFreq, pIdx) => {
    const popRate = 22050;
    const durSec = 0.14;
    const popSamples = [];
    const n = Math.floor(popRate * durSec);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / popRate;
      const decay = Math.exp(-t * 38);
      const freq = baseFreq * (1 + 2.5 * Math.exp(-t * 60));
      phase += (2 * Math.PI * freq) / popRate;
      // Combustion crack (filtered noise) + resonant body thump
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.8;
      const body = Math.sin(phase) * 0.6;
      const sub = Math.sin(phase * 0.5) * 0.4;
      const s = (noise + body + sub) * decay;
      popSamples.push(s);
    }
    const popWav = createWavBuffer(popSamples, popRate, 1);
    fs.writeFileSync(path.join(outDir, `pop_${pIdx + 1}.wav`), popWav);
  });
  console.log('Saved pop_1.wav, pop_2.wav, pop_3.wav');
}

buildCommonAudio().catch(console.error);
