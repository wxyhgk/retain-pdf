# Third-party notices

fast-mol's own code is MIT (see `LICENSE`). This file says what it draws on,
so that the boundary is explicit.

## Looks modelled on other programs

Several of the theme names (sob-art, IBOview, HoukMol, HoukMol3d, IQmol,
MolStudio, CYLview, VESTA, the MolViewer presets and the vcube materials)
imitate molecule styles of **GXNU-MolStudio** (GPLv3, which in turn
acknowledges **IboView**, GPLv3, (c) 2015 Gerald Knizia). What this package
takes from them, and what it does not:

- **No program code.** The shading is this package's own: `src/look/studio.ts`
  is written from the standard shading formulas (Lambert, Cook–Torrance with
  GGX / Schlick / Smith, Blinn–Phong), and `rampShader` in `shading.ts` is
  original code. The lighting parameters in `src/look/catalogue/materials.ts` were
  *fitted* by least squares so that the studio model reproduces how each
  reference style looks over a hemisphere of normals; they were not read off
  any shader.
- **Numeric data, taken from their presets:** the element colour tables for
  the styles that have their own tints (`src/look/catalogue/palettes.ts`), the colour-ramp
  stop tables and the proportions in `src/look/catalogue/` (ball size, bond
  width, outline width, the 70 % bond waist, the ESP colour window).
  Colours and parameters are facts about a look rather than code; they are
  listed here because they came from GPLv3 projects. If your use needs a
  stricter position than that, the default theme (`src/look/fastmol.ts`) and the
  shaders in `shading.ts` / `studio.ts` do not depend on any of it — and since
  the ready-made styles are a separate entry (`fast-mol/themes`), a program
  can leave all of it out.
- **Public palettes** that those tables transcribe: GaussView's element
  colours and VESTA's `elements.ini`.

## Code from the author's other projects

- `src/edit/core/geometry/relax.ts` is ported from RetainMol's
  `GeometryRelaxer`, and a few constants in `src/look/fastmol.ts` and the
  framing code (depth-fog offsets, a minimum bounding radius, a dark-neutral
  lift) from RetainMol. RetainMol is the author's own project.

## Reference data

- Covalent radii: Cordero et al., *Dalton Trans.* 2008, 2832.
- Element colours: the Jmol / CPK convention.
- Atomic masses: IUPAC standard atomic weights.
- The cube-file format is Gaussian's; the readers are written from its
  published layout. The Gaussian, ORCA, MOL/SDF readers are written from the
  formats' public layout (see README for what has and has not been checked
  against real files).

## Development tools (not shipped)

TypeScript (Apache-2.0) and esbuild (MIT) are used to build; neither is part
of the published package.
