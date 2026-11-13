// ============================================================================
// TUNGI TOSHKENT — AUTOMATIC ENGINE AUDIO DIAGNOSTIC & ADMIN OVERRIDE TOOL
// ============================================================================
// Press F8 in-game (or call window.__openAudioDiag()) to inspect every
// vehicle's GLB model, engine classification, sound profile, asset status,
// and override its engine type or audio profile persistently.

import { CARS } from './config.js';
import { GLB_SPECS } from './carModel.js';
import {
  ENGINE_CATEGORIES,
  getEngineSpec,
  setEngineOverride,
  clearEngineOverride,
} from './engineDb.js';
import { SOUND_PROFILES, getAudioStatus } from './audio.js';

let panel = null;

async function checkAssetExists(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function renderAudioDiagnostic() {
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'audioDiagModal';
    panel.style.cssText = [
      'position:fixed', 'inset:16px', 'z-index:10200', 'display:flex',
      'flex-direction:column', 'border-radius:16px',
      'background:rgba(7,11,26,0.96)', 'border:1px solid rgba(0,229,255,0.35)',
      'color:#e2e8f0', 'font-family:system-ui,Segoe UI,sans-serif',
      'box-shadow:0 24px 60px rgba(0,0,0,0.8)', 'overflow:hidden',
    ].join(';');
    document.body.appendChild(panel);
  }

  panel.style.display = 'flex';
  const st = getAudioStatus();
  const profileKeys = Object.keys(SOUND_PROFILES).filter(
    (k) => !['i4', 'turbo4', 'bmwi6', 'bmwv8', 'amgv8', 'v12'].includes(k)
  );
  const engineKeys = Object.keys(ENGINE_CATEGORIES);

  // Check unique audio assets availability
  const assetUrls = new Set();
  for (const c of CARS) {
    const spec = getEngineSpec(c.id);
    (spec.soundAssetPaths || []).forEach((u) => assetUrls.add(u));
  }
  const assetStatus = {};
  await Promise.all(
    [...assetUrls].map(async (u) => {
      assetStatus[u] = await checkAssetExists(u);
    })
  );

  const rowsHtml = CARS.map((c) => {
    const glb = GLB_SPECS[c.id];
    const spec = getEngineSpec(c.id);
    const prof = SOUND_PROFILES[spec.audioProfile];
    const missing = (spec.soundAssetPaths || []).filter((u) => !assetStatus[u]);
    const isUnknown = spec.engineType === 'UNKNOWN';
    const badgeColor = isUnknown
      ? '#f87171'
      : spec.verificationStatus === 'override'
      ? '#facc15'
      : '#4ade80';

    return `
      <tr data-vid="${c.id}" style="border-bottom:1px solid rgba(148,163,184,0.12);">
        <td style="padding:7px 8px;"><b>${c.id}</b><br><small style="color:#94a3b8;">${glb ? glb.file : 'MISSING GLB'}</small></td>
        <td style="padding:7px 8px;">${spec.manufacturer}<br><small style="color:#94a3b8;">${spec.model} (${spec.modelYear || '—'})</small></td>
        <td style="padding:7px 8px;">
          <select class="diag-eng" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-size:12px;">
            ${engineKeys.map((k) => `<option value="${k}" ${spec.engineType === k ? 'selected' : ''}>${k}</option>`).join('')}
          </select>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${spec.idleRPM}–${spec.redlineRPM} RPM · ${spec.powertrain.toUpperCase()}</div>
        </td>
        <td style="padding:7px 8px;">
          <select class="diag-prof" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-size:12px;">
            ${profileKeys.map((k) => `<option value="${k}" ${spec.audioProfile === k ? 'selected' : ''}>${k}</option>`).join('')}
          </select>
        </td>
        <td style="padding:7px 8px;font-size:11px;">
          ${prof ? (missing.length ? `<span style="color:#f87171;">Missing: ${missing.join(', ')}</span>` : `<span style="color:#4ade80;">OK (${spec.soundAssetPaths.length} assets)</span>`) : '<span style="color:#f87171;">No Profile</span>'}
        </td>
        <td style="padding:7px 8px;">
          <span style="color:${badgeColor};font-weight:700;font-size:11px;">${spec.verificationStatus.toUpperCase()}</span>
        </td>
        <td style="padding:7px 8px;">
          <button class="diag-reset" style="background:#1e293b;color:#cbd5e1;border:1px solid #475569;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">Reset</button>
        </td>
      </tr>
    `;
  }).join('');

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,0.2);">
      <div>
        <b style="font-size:15px;color:#00e5ff;">🔊 ENGINE AUDIO DIAGNOSTIC & ADMIN OVERRIDE (F8)</b>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
          WebAudio: <b>${st.ctxState}</b> · Active Car: <b>${st.currentCarId || '—'}</b> (${st.currentCarSound || '—'}) · Cached Buffers: <b>${st.cachedBuffers.length}</b> · Remote Voices: <b>${st.activeRemoteVoices}</b>
          ${st.failedUrls.length ? ` · <span style="color:#f87171;">Failed: ${st.failedUrls.join(', ')}</span>` : ''}
        </div>
      </div>
      <button id="diagCloseBtn" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;">✕ Yopish</button>
    </div>
    <div style="overflow:auto;flex:1;padding:8px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="text-align:left;color:#67e8f9;border-bottom:1px solid rgba(0,229,255,0.25);">
            <th style="padding:6px 8px;">Vehicle / GLB</th>
            <th style="padding:6px 8px;">Manufacturer & Model</th>
            <th style="padding:6px 8px;">Engine Classification</th>
            <th style="padding:6px 8px;">Sound Profile</th>
            <th style="padding:6px 8px;">Asset Check</th>
            <th style="padding:6px 8px;">Status</th>
            <th style="padding:6px 8px;">Action</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  panel.querySelector('#diagCloseBtn').onclick = () => {
    panel.style.display = 'none';
  };

  panel.querySelectorAll('tr[data-vid]').forEach((tr) => {
    const vid = tr.dataset.vid;
    const engSel = tr.querySelector('.diag-eng');
    const profSel = tr.querySelector('.diag-prof');
    const resetBtn = tr.querySelector('.diag-reset');

    const savePatch = () => {
      setEngineOverride(vid, { engineType: engSel.value, audioProfile: profSel.value });
      renderAudioDiagnostic();
    };
    engSel.onchange = savePatch;
    profSel.onchange = savePatch;
    resetBtn.onclick = () => {
      clearEngineOverride(vid);
      renderAudioDiagnostic();
    };
  });
}

export function toggleAudioDiagnostic() {
  if (panel && panel.style.display !== 'none') {
    panel.style.display = 'none';
    return;
  }
  renderAudioDiagnostic();
}

window.__openAudioDiag = toggleAudioDiagnostic;
