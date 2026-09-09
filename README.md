# Elastomer Isolator Calculator

Interactive calculator for vibration isolation, rocking stability, and shock sizing of elastomer mounts.

The current version includes a **Linear row (pitch only)** layout for one-column pad arrangements. The experimental preset uses **2 pads**, **1.3 kg supported mass**, Ø45 × 20 mm pads, 80 mm center-to-center spacing, Z = 215 mm referenced to the pad centerline, and a measured pitch frequency of approximately 6.2 Hz. Roll frequency is intentionally not calculated for this layout because there is no Y-direction support spread.

With I_CG left blank, the current analytical model uses the point-mass approximation I = M·H². For the corrected experimental setup, this predicts about 11.51 Hz, so the 6.2 Hz measurement is retained as an independent validation target rather than being used to tune the material. Matching 6.2 Hz with the same stiffness model requires I_CG ≈ 0.161 kg·m²; this should be checked against CAD mass properties.

Open the calculator with GitHub Pages for this repository.
