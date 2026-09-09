(() => {
  'use strict';
  const baseReadVibInputs = readVibInputs;
  const baseCalcLateralRocking = calcLateralRocking;
  const baseRenderRocking = renderRocking;
  const baseRenderMaterialUI = renderMaterialUI;
  FIELD_KIND.v_linear_spacing = 'length';
  const layoutSeg = document.getElementById('v-layout-seg');
  if (!layoutSeg.querySelector('[data-layout="linear"]')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.layout = 'linear';
    btn.textContent = 'Linear row (pitch only)';
    layoutSeg.appendChild(btn);
  }
  const rectFields = document.getElementById('v-rect-fields');
  const cgInput = document.getElementById('v_cgheight');
  const cgRow = cgInput.closest('.field-row');
  const cgLabel = cgInput.closest('.field').querySelector('label');
  cgLabel.id = 'lbl-cgheight';
  const linearWrap = document.createElement('div');
  linearWrap.id = 'v-linear-fields';
  linearWrap.style.display = 'none';
  linearWrap.innerHTML = `
    <div class="field-row">
      <div class="field">
        <label>Adjacent pad spacing, X <span class="unit" id="u-linear-spacing">mm</span></label>
        <input type="number" id="v_linear_spacing" value="80" step="any" min="0">
      </div>
      <div class="field">
        <label>CG height reference</label>
        <select id="v_cg_reference">
          <option value="bottom">Pad bottom / base</option>
          <option value="center" selected>Pad centerline</option>
          <option value="top">Pad top</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Body inertia about CG, I<sub>CG</sub> <span class="unit">kg·m²</span></label>
        <input type="number" id="v_body_icg" value="" step="any" min="0" placeholder="optional">
      </div>
      <div class="field">
        <label>Measured pitch frequency <span class="unit">Hz</span></label>
        <input type="number" id="v_measured_pitch" value="6.2" step="any" min="0">
      </div>
    </div>
    <button type="button" class="fillbtn" id="apply-linear-experiment" style="margin-top:0;">Apply experimental setup · Ø45×20 · X 80 · Z 215 · 6.2 Hz</button>
    <div class="hint" style="margin-top:9px;">One-dimensional support row: the calculator predicts <strong style="color:var(--text-1);">pitch only</strong>. Roll is intentionally omitted because there is no Y support spread. Pad positions are assumed equally spaced and centered about the COG projection: xᵢ = (i − (n−1)/2)·X.</div>
  `;
  rectFields.parentNode.insertBefore(linearWrap, cgRow);
  function setLinearFieldVisibility() {
    const layout = state.vib.padLayout;
    document.getElementById('v-circular-fields').style.display = layout === 'circular' ? 'flex' : 'none';
    document.getElementById('v-rect-fields').style.display = layout === 'rect' ? 'flex' : 'none';
    document.getElementById('v-linear-fields').style.display = layout === 'linear' ? 'block' : 'none';
    document.getElementById('lbl-cgheight').innerHTML = layout === 'linear'
      ? `COG height, Z <span class="unit" id="u-cgheight">${UNIT_LABEL[UNIT].length}</span>`
      : `CG height above <em>base</em> (pad bottom), H <span class="unit" id="u-cgheight">${UNIT_LABEL[UNIT].length}</span>`;
    document.getElementById('u-linear-spacing').textContent = UNIT_LABEL[UNIT].length;
  }
  readVibInputs = function patchedReadVibInputs() {
    const inp = baseReadVibInputs();
    const spacingDisplay = parseFloat(document.getElementById('v_linear_spacing').value);
    inp.linearSpacing = toCanonical('length', spacingDisplay);
    inp.cgReference = document.getElementById('v_cg_reference').value;
    inp.bodyIcg_kgm2 = parseFloat(document.getElementById('v_body_icg').value);
    inp.measuredPitch_Hz = parseFloat(document.getElementById('v_measured_pitch').value);
    return inp;
  };
  calcLateralRocking = function patchedCalcLateralRocking(inp, out) {
    if (inp.padLayout !== 'linear') return baseCalcLateralRocking(inp, out);
    const n = Math.max(1, Math.round(inp.numIso || 1));
    const klat = out.Kdyn / (3 * (1 + 2*out.SF*out.SF));
    const lenConv = UNIT === 'imperial' ? 1 : 25.4;
    const spacing = Math.max(0, inp.linearSpacing * lenConv);
    const t = out.thickness;
    const Z = Math.max(0, inp.cgHeight * lenConv);
    const H = inp.cgReference === 'top' ? Z + t
      : inp.cgReference === 'center' ? Z + t/2
      : Z;
    const positions = Array.from({length:n}, (_,i) => (i - (n-1)/2) * spacing);
    const sumX2 = positions.reduce((s,x) => s + x*x, 0);
    const g = UNIT === 'imperial' ? 386.1 : 9.80665;
    const totalWeight = UNIT === 'imperial'
      ? inp.totalLoad
      : (inp.totalLoad * 0.453592) * g;
    const massKg = inp.totalLoad * 0.453592;
    const Klat_system = n * klat;
    const f_lat = UNIT === 'imperial'
      ? (1/(2*Math.PI)) * Math.sqrt((Klat_system*g)/Math.max(totalWeight,1e-12))
      : (1/(2*Math.PI)) * Math.sqrt((Klat_system*1000)/Math.max(massKg,1e-12));
    const K_theta = out.Kdyn * sumX2 + n * klat * t*t - totalWeight * H;
    let f_pitch = null;
    let I_point_kgm2 = null;
    let I_total_kgm2 = null;
    const bodyIcg = Number.isFinite(inp.bodyIcg_kgm2) && inp.bodyIcg_kgm2 > 0 ? inp.bodyIcg_kgm2 : 0;
    if (massKg > 0 && H > 0) {
      const H_m = UNIT === 'imperial' ? H * 0.0254 : H / 1000;
      I_point_kgm2 = massKg * H_m * H_m;
      I_total_kgm2 = I_point_kgm2 + bodyIcg;
      if (K_theta > 0 && I_total_kgm2 > 0) {
        const K_Nm = UNIT === 'imperial' ? K_theta * 0.1129848290276167 : K_theta / 1000;
        f_pitch = (1/(2*Math.PI)) * Math.sqrt(K_Nm / I_total_kgm2);
      }
    }
    const measured = Number.isFinite(inp.measuredPitch_Hz) && inp.measuredPitch_Hz > 0 ? inp.measuredPitch_Hz : null;
    const errorPct = measured && f_pitch !== null ? 100 * (f_pitch - measured) / measured : null;
    let inferredIcg_kgm2 = null;
    if (measured && K_theta > 0 && I_point_kgm2 !== null) {
      const K_Nm = UNIT === 'imperial' ? K_theta * 0.1129848290276167 : K_theta / 1000;
      const requiredTotalI = K_Nm / Math.pow(2*Math.PI*measured, 2);
      inferredIcg_kgm2 = requiredTotalI - I_point_kgm2;
    }
    return {
      layout:'linear', n, klat, f_lat, spacing, positions, sumX2,
      Z, H, cgReference:inp.cgReference, K_theta, f_pitch,
      I_point_kgm2, I_total_kgm2, bodyIcg_kgm2:bodyIcg, inferredIcg_kgm2,
      measuredPitch_Hz:measured, errorPct
    };
  };
  function svgRockingDiagramLinear(rock, lenUnit, unstable) {
    const cx = 200, padY = 190, groundY = 207;
    const n = rock.n;
    const spacingDisp = rock.spacing;
    const totalSpan = Math.max((n-1) * Math.max(spacingDisp,1), 1);
    const scale = Math.min(250/totalSpan, 3.0);
    const positionsPx = rock.positions.map(x => cx + x*scale);
    const heightDisp = Math.max(rock.H, 1);
    const hScale = Math.min(120/heightDisp, 2.0);
    const cgY = padY - Math.max(Math.min(heightDisp*hScale,145),38);
    let s = '';
    s += `<line x1="25" y1="${groundY}" x2="375" y2="${groundY}" stroke="#7e94a8" stroke-width="1.2"/>`;
    for (let i=0;i<15;i++){ const hx=25+i*24; s += `<line x1="${hx}" y1="${groundY}" x2="${hx-7}" y2="${groundY+8}" stroke="#7e94a8" stroke-width="1"/>`; }
    s += `<line x1="${cx}" y1="18" x2="${cx}" y2="${groundY}" stroke="#5fd0d6" stroke-width="1" stroke-dasharray="3,3" opacity="0.45"/>`;
    positionsPx.forEach((px,i) => {
      s += `<rect x="${px-13}" y="${padY-7}" width="26" height="14" rx="1" fill="rgba(242,163,65,0.15)" stroke="#f2a341" stroke-width="1.3"/>`;
      s += `<text x="${px}" y="${padY+23}" text-anchor="middle" font-family="IBM Plex Mono" font-size="7" fill="#7e94a8">${i+1}</text>`;
    });
    if (n >= 2) {
      const a = positionsPx[Math.floor((n-1)/2)];
      const b = positionsPx[Math.floor((n-1)/2)+1];
      if (b !== undefined) s += dimLineH(a, padY+34, b, padY+34, `X = ${fmt(spacingDisp,1)} ${lenUnit}`);
    }
    const bodyW = 70, bodyTop = Math.max(25,cgY-55);
    s += `<rect x="${cx-bodyW/2}" y="${bodyTop}" width="${bodyW}" height="${padY-15-bodyTop}" rx="4" fill="rgba(95,208,214,0.10)" stroke="#5fd0d6" stroke-width="1.4"/>`;
    s += `<circle cx="${cx}" cy="${cgY}" r="6" fill="none" stroke="#f2a341" stroke-width="1.6"/>`;
    s += `<line x1="${cx-9}" y1="${cgY}" x2="${cx+9}" y2="${cgY}" stroke="#f2a341" stroke-width="1.2"/>`;
    s += `<line x1="${cx}" y1="${cgY-9}" x2="${cx}" y2="${cgY+9}" stroke="#f2a341" stroke-width="1.2"/>`;
    s += `<text x="${cx+12}" y="${cgY-9}" font-family="IBM Plex Mono" font-size="8" fill="#f2a341">COG</text>`;
    s += dimLineV(cx+58, padY, cx+58, cgY, `H = ${fmt(heightDisp,1)} ${lenUnit}`, true);
    if (unstable) {
      s += `<text x="${cx}" y="42" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" font-weight="600" fill="#ff6b5e">UNSTABLE PITCH</text>`;
    } else {
      s += `<path d="M ${cx-30} ${bodyTop+10} A 30 14 0 0 1 ${cx+30} ${bodyTop+10}" stroke="#ff6b5e" stroke-width="1.5" fill="none" marker-end="url(#arrowPitch)"/>`;
      s += `<text x="${cx}" y="${bodyTop-5}" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#ff6b5e">pitch</text>`;
    }
    s += `<defs><marker id="arrowPitch" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#ff6b5e"/></marker></defs>`;
    s += `<text x="200" y="225" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#4f6274">${n} PADS · 1-D LINEAR ROW · ROLL NOT MODELED</text>`;
    return s;
  }
  renderRocking = function patchedRenderRocking() {
    if (state.vib.padLayout !== 'linear') {
      setLinearFieldVisibility();
      return baseRenderRocking();
    }
    setLinearFieldVisibility();
    const lenUnit = UNIT_LABEL[UNIT].length;
    document.getElementById('u-cgheight').textContent = lenUnit;
    document.getElementById('u-linear-spacing').textContent = lenUnit;
    const inp = readVibInputs();
    let out, rock;
    try { out = calcVibration(inp); rock = calcLateralRocking(inp, out); } catch(e) { return; }
    const kUnit = UNIT==='imperial' ? 'lb/in' : 'N/mm';
    const torqueUnit = UNIT==='imperial' ? 'lb·in/rad' : 'N·mm/rad';
    const cell = (label, value, sub) => `<div class="result-cell"><div class="rlabel">${label}</div><div class="rvalue">${value}</div>${sub?`<div class="rsub">${sub}</div>`:''}</div>`;
    const divider = (t) => `<div class="section-divider">${t}</div>`;
    const warns = [];
    if (rock.n < 2) {
      warns.push({level:'bad', text:'Linear-row pitch requires at least two pads. Increase Number of isolators to 2 or more.'});
    }
    warns.push({level:'ok', text:'Roll frequency is intentionally not calculated for this layout: all supports lie on one X row, so there is no Y support spread to define a roll restoring lever arm.'});
    if (rock.K_theta <= 0) {
      warns.push({level:'bad', text:'Pitch stiffness is negative after the gravity P-delta term. This setup is statically unstable in pitch. Increase X spacing/stiffness, add support spread, or lower the COG.'});
    } else if (rock.f_pitch !== null) {
      warns.push({level:rock.f_pitch < out.fn ? 'caution' : 'ok', text:`Predicted pitch is ${fmt(rock.f_pitch,2)} Hz versus vertical ${fmt(out.fn,2)} Hz.`});
    }
    if (rock.measuredPitch_Hz && rock.f_pitch !== null) {
      const ae = Math.abs(rock.errorPct);
      const level = ae <= 10 ? 'ok' : ae <= 25 ? 'caution' : 'bad';
      warns.push({level, text:`Experimental pitch = ${fmt(rock.measuredPitch_Hz,2)} Hz. Model error is ${rock.errorPct>=0?'+':''}${fmt(rock.errorPct,1)}% (predicted ${fmt(rock.f_pitch,2)} Hz).`});
    }
    if (!(rock.bodyIcg_kgm2 > 0)) {
      warns.push({level:'caution', text:'I_CG is blank, so rotational inertia uses the point-mass approximation I = M·H². A tall/wide real assembly usually has additional I_CG, which lowers the predicted pitch frequency. Enter measured/CAD I_CG for a stronger comparison to the 6.2 Hz test.'});
      if (rock.inferredIcg_kgm2 !== null && rock.inferredIcg_kgm2 > 0) {
        warns.push({level:'ok', text:`With the current mass/geometry/stiffness, matching ${fmt(rock.measuredPitch_Hz,2)} Hz would require I_CG ≈ ${fmt(rock.inferredIcg_kgm2,4)} kg·m². Compare this with CAD mass properties; do not treat it as a material constant.`});
      }
    }
    const refText = rock.cgReference === 'center' ? 'Z referenced to pad centerline'
      : rock.cgReference === 'top' ? 'Z referenced to pad top'
      : 'Z referenced to pad bottom/base';
    document.getElementById('rock-results').innerHTML = `
      ${cell('Lateral (shear) stiffness/pad', fmt(rock.klat) + ` ${kUnit}`)}
      ${cell('Lateral translation f', fmt(rock.f_lat,2) + ' Hz')}
      ${divider('Pitch — 1-D row')}
      <div class="result-cell hero"><div class="rlabel">Predicted pitch f</div><div class="rvalue">${rock.f_pitch===null?'UNSTABLE':fmt(rock.f_pitch,2)}<small>${rock.f_pitch===null?'':'Hz'}</small></div></div>
      <div class="result-cell hero"><div class="rlabel">Measured pitch f</div><div class="rvalue">${rock.measuredPitch_Hz?fmt(rock.measuredPitch_Hz,2):'—'}<small>${rock.measuredPitch_Hz?'Hz':''}</small></div></div>
      ${cell('Model error', rock.errorPct===null?'—':`${rock.errorPct>=0?'+':''}${fmt(rock.errorPct,1)} %`, 'predicted − measured')}
      ${cell('Pitch stiffness, K_θ', fmt(rock.K_theta,0) + ` ${torqueUnit}`)}
      ${divider('Geometry / inertia')}
      ${cell('Pad row', `${rock.n} pads × ${fmt(rock.spacing,1)} ${lenUnit} spacing`)}
      ${cell('Σ xᵢ²', fmt(rock.sumX2,1) + ` ${lenUnit}²`, 'about row center / COG projection')}
      ${cell('Effective H from base', fmt(rock.H,1) + ` ${lenUnit}`, refText)}
      ${cell('Point-mass inertia, M·H²', rock.I_point_kgm2===null?'—':fmt(rock.I_point_kgm2,4) + ' kg·m²')}
      ${cell('Total pitch inertia', rock.I_total_kgm2===null?'—':fmt(rock.I_total_kgm2,4) + ' kg·m²', rock.bodyIcg_kgm2>0?'includes I_CG':'point-mass only')}
      ${cell('I_CG implied by measured f', rock.inferredIcg_kgm2===null?'—':(rock.inferredIcg_kgm2>=0?fmt(rock.inferredIcg_kgm2,4) + ' kg·m²':'< 0 (check inputs)'), 'diagnostic value that would make the model equal measured pitch')}
      ${divider('Roll')}
      <div class="result-cell wide"><div class="rlabel">Roll frequency</div><div class="rvalue">NOT VALID</div><div class="rsub">No Y support spread in a single pad row.</div></div>
    `;
    document.getElementById('rock-diagram').innerHTML = svgRockingDiagramLinear(rock, lenUnit, rock.K_theta<=0);
    document.getElementById('rock-warnings').innerHTML = warns.map(w => `
      <div class="warn ${w.level}"><span class="mark">${w.level==='ok'?'OK':w.level==='caution'?'!':'✕'}</span><span>${w.text}</span></div>
    `).join('');
    const formulas = document.getElementById('vib-formulas');
    formulas.innerHTML += `
      <p>Linear pad row — pitch only; n equally spaced pads, spacing X</p><code>xᵢ = (i − (n−1)/2)·X
K_θ = k_v·Σxᵢ² + n·k_lat·t² − W·H
I_pitch = I_CG + M·H²
f_pitch = (1/2π)·√(K_θ / I_pitch)</code>
      <p style="color:var(--text-2);">Roll is deliberately omitted because a one-row support layout has no Y lever-arm distribution. Z can be referenced to the pad bottom, centerline, or top; the calculator converts it internally to H measured from the base.</p>`;
  };
  renderMaterialUI = function patchedRenderMaterialUI() {
    baseRenderMaterialUI();
    const material = activeMaterial();
    if (material.id !== 'experimental_silopren_2640') return;
    const details = document.getElementById('material-test-details');
    if (details && !details.querySelector('#linear-validation-record')) {
      const box = document.createElement('div');
      box.id = 'linear-validation-record';
      box.style.marginTop = '14px';
      box.style.paddingTop = '12px';
      box.style.borderTop = '1px solid var(--line)';
      box.innerHTML = `
        <p class="material-copy" style="margin-bottom:8px;"><strong style="color:var(--text-0);">Rocking validation test</strong></p>
        <table class="matref-table">
          <tr><td>Support layout</td><td>1-D pad row · pitch only</td></tr>
          <tr><td>Pad geometry</td><td>Ø45 × 20 mm solid circular</td></tr>
          <tr><td>Adjacent spacing X</td><td>80 mm</td></tr>
          <tr><td>COG height Z</td><td>215 mm (drawing reference: pad centerline)</td></tr>
          <tr><td>Measured pitch frequency</td><td>≈ 6.2 Hz</td></tr>
          <tr><td>Roll result</td><td>Not valid / not used</td></tr>
        </table>
        <p class="hint" style="margin-top:10px;">This assembly-level frequency is a validation point, not a direct material property. Matching it also depends on total mass, pad count, pad positions, and the assembly pitch inertia I_CG.</p>`;
      details.appendChild(box);
    }
  };
  function applyExperimentalPreset() {
    state.vib.padLayout = 'linear';
    state.vib.shape = 'disc';
    state.vib.dims.disc.D = 45/25.4;
    state.vib.dims.disc.t = 20/25.4;
    selectedMaterialId = 'experimental_silopren_2640';
    document.getElementById('v_numiso').value = 3;
    document.getElementById('v_linear_spacing').value = UNIT === 'metric' ? 80 : round(80/25.4,3);
    document.getElementById('v_cgheight').value = UNIT === 'metric' ? 215 : round(215/25.4,3);
    document.getElementById('v_cg_reference').value = 'center';
    document.getElementById('v_measured_pitch').value = 6.2;
    document.getElementById('v_body_icg').value = '';
    renderShapeSelector('vib');
    renderDimFields('vib');
    layoutSeg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.layout === 'linear'));
    setLinearFieldVisibility();
    recalc();
  }
  document.addEventListener('DOMContentLoaded', () => {
    setLinearFieldVisibility();
    layoutSeg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setLinearFieldVisibility();
        recalc();
      });
    });
    ['v_linear_spacing','v_body_icg','v_measured_pitch'].forEach(id =>
      document.getElementById(id).addEventListener('input', recalc));
    document.getElementById('v_cg_reference').addEventListener('change', recalc);
    document.getElementById('apply-linear-experiment').addEventListener('click', applyExperimentalPreset);
    applyExperimentalPreset();
  });
})();
