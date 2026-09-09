(() => {
  'use strict';

  // Correction to the rocking validation setup:
  // 2 pads, 1.3 kg supported mass, Ø45 x 20 mm pads,
  // 80 mm center-to-center spacing, Z = 215 mm from pad centerline,
  // measured pitch frequency ≈ 6.2 Hz. Roll remains invalid for a 1-D pad row.

  function patchValidationRecord() {
    const box = document.getElementById('linear-validation-record');
    if (!box) return;
    const table = box.querySelector('table');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr'));
    const hasPadCount = rows.some(r => r.textContent.includes('Pad count'));
    const hasMass = rows.some(r => r.textContent.includes('Supported mass'));

    if (!hasPadCount) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>Pad count</td><td>2</td>';
      table.insertBefore(tr, table.firstChild.nextSibling);
    }
    if (!hasMass) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>Supported mass</td><td>1.3 kg</td>';
      table.insertBefore(tr, table.firstChild.nextSibling);
    }
  }

  function applyCorrectedExperimentalPreset() {
    state.vib.padLayout = 'linear';
    state.vib.shape = 'disc';
    state.vib.dims.disc.D = 45 / 25.4;
    state.vib.dims.disc.t = 20 / 25.4;
    selectedMaterialId = 'experimental_silopren_2640';

    document.getElementById('v_numiso').value = 2;
    document.getElementById('v_totalload').value = UNIT === 'metric'
      ? 1.3
      : Math.round((1.3 / 0.453592) * 1000) / 1000;
    document.getElementById('v_linear_spacing').value = UNIT === 'metric'
      ? 80
      : Math.round((80 / 25.4) * 1000) / 1000;
    document.getElementById('v_cgheight').value = UNIT === 'metric'
      ? 215
      : Math.round((215 / 25.4) * 1000) / 1000;
    document.getElementById('v_cg_reference').value = 'center';
    document.getElementById('v_measured_pitch').value = 6.2;
    document.getElementById('v_body_icg').value = '';

    renderShapeSelector('vib');
    renderDimFields('vib');
    document.querySelectorAll('#v-layout-seg button').forEach(b =>
      b.classList.toggle('active', b.dataset.layout === 'linear'));

    const circ = document.getElementById('v-circular-fields');
    const rect = document.getElementById('v-rect-fields');
    const linear = document.getElementById('v-linear-fields');
    if (circ) circ.style.display = 'none';
    if (rect) rect.style.display = 'none';
    if (linear) linear.style.display = 'block';

    const btn = document.getElementById('apply-linear-experiment');
    if (btn) btn.textContent = 'Apply experimental setup · 2 pads · 1.3 kg · Ø45×20 · X 80 · Z 215 · 6.2 Hz';

    recalc();
    patchValidationRecord();
  }

  const priorRenderMaterialUI = renderMaterialUI;
  renderMaterialUI = function correctedRenderMaterialUI() {
    priorRenderMaterialUI();
    patchValidationRecord();
  };

  document.addEventListener('DOMContentLoaded', () => {
    // linear-patch.js applies its original preset first; this correction runs after it.
    applyCorrectedExperimentalPreset();

    const btn = document.getElementById('apply-linear-experiment');
    if (btn) {
      // Existing handler runs first; this handler immediately corrects pad count and mass.
      btn.addEventListener('click', applyCorrectedExperimentalPreset);
    }
  });
})();
