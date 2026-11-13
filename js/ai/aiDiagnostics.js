// Developer-Only AI Diagnostics & Optional 3D Debug Visualization
// Hidden from ordinary players; toggle via ?aidebug=1 or Ctrl+Shift+D.
import * as THREE from 'three';

export class AIDiagnostics {
  constructor(scene) {
    this.scene = scene;
    this.enabled = typeof window !== 'undefined' && window.location?.search?.includes('aidebug=1');
    this.panel = null;
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false;
    scene.add(this.debugGroup);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 });
    this._lineGeo = new THREE.BufferGeometry();
    this._positions = new Float32Array(120 * 6);
    this._lineGeo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    this._lines = new THREE.LineSegments(this._lineGeo, lineMat);
    this.debugGroup.add(this._lines);

    if (typeof window !== 'undefined') {
      window.__AI_DEBUG__ = this;
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
          e.preventDefault();
          this.setEnabled(!this.enabled);
        }
      });
      if (this.enabled) this._ensurePanel();
    }
  }

  setEnabled(v) {
    this.enabled = !!v;
    this.debugGroup.visible = this.enabled;
    if (this.enabled) this._ensurePanel();
    else if (this.panel) this.panel.style.display = 'none';
  }

  _ensurePanel() {
    if (typeof document === 'undefined') return;
    if (!this.panel) {
      const el = document.createElement('div');
      el.id = 'ai-diagnostics-panel';
      el.style.cssText =
        'position:fixed;top:12px;left:12px;z-index:9999;background:rgba(8,10,18,0.88);' +
        'border:1px solid rgba(0,229,255,0.45);border-radius:8px;padding:10px 12px;' +
        'color:#e2e8f0;font:11px/1.45 Consolas,monospace;pointer-events:none;min-width:270px;';
      document.body.appendChild(el);
      this.panel = el;
    }
    this.panel.style.display = 'block';
  }

  update(pedManager, vehManager) {
    if (!this.enabled) return;
    this._ensurePanel();
    const ps = pedManager?.stats || {};
    const vs = vehManager?.stats || {};
    const ca = pedManager?.charAssets?.diagnostics || {};

    this.panel.innerHTML =
      `<div style="color:#00e5ff;font-weight:bold;margin-bottom:4px">AI ECOSYSTEM DIAGNOSTICS (Ctrl+Shift+D)</div>` +
      `<div><b>Pedestrians:</b> ${ps.activeCount ?? 0} (N:${ps.nearCount ?? 0} M:${ps.medCount ?? 0} F:${ps.farCount ?? 0}) | GLB:${ps.glbActive ?? 0}</div>` +
      `<div><b>Ped States:</b> Cross:${ps.crossing ?? 0} Wait:${ps.waitingCross ?? 0} Avoid:${ps.avoiding ?? 0}</div>` +
      `<div><b>Vehicles:</b> ${vs.activeCount ?? 0} (N:${vs.nearCount ?? 0} M:${vs.medCount ?? 0} F:${vs.farCount ?? 0})</div>` +
      `<div><b>Traffic AI:</b> Red:${vs.stoppedAtRed ?? 0} YieldPed:${vs.yieldingPed ?? 0} Avoid:${vs.avoidingCar ?? 0} StuckRec:${vs.stuckRecoveries ?? 0}</div>` +
      `<div><b>GLB Chars:</b> ${(ca.loadedModels || []).length} loaded | ${(ca.missingModels || []).length} missing | Clips: ${(ca.synthesizedClips || []).join(',')}</div>` +
      `<div><b>AI Frame:</b> Ped ${(ps.lastUpdateMs ?? 0).toFixed(2)}ms | Veh ${(vs.lastUpdateMs ?? 0).toFixed(2)}ms</div>`;

    // Update 3D debug target lines for up to 60 nearby pedestrians + 60 nearby vehicles
    let seg = 0;
    const pos = this._positions;
    if (pedManager?.list) {
      for (let i = 0; i < pedManager.list.length && seg < 60; i++) {
        const p = pedManager.list[i];
        if (!p.active || p.culled) continue;
        const off = seg * 6;
        pos[off] = p.x;
        pos[off + 1] = 1.0;
        pos[off + 2] = p.z;
        pos[off + 3] = p.targetX;
        pos[off + 4] = 1.0;
        pos[off + 5] = p.targetZ;
        seg++;
      }
    }
    if (vehManager?.cars) {
      for (let i = 0; i < vehManager.cars.length && seg < 120; i++) {
        const c = vehManager.cars[i];
        if (!c.model?.group?.visible) continue;
        const off = seg * 6;
        pos[off] = c.x;
        pos[off + 1] = 1.2;
        pos[off + 2] = c.z;
        pos[off + 3] = c.x + Math.sin(c.heading) * 12;
        pos[off + 4] = 1.2;
        pos[off + 5] = c.z + Math.cos(c.heading) * 12;
        seg++;
      }
    }
    this._lineGeo.setDrawRange(0, seg * 2);
    this._lineGeo.attributes.position.needsUpdate = true;
  }
}
