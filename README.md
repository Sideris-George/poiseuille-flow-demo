# Poiseuille Lab

**Live demo:** https://Sideris-George.github.io/poiseuille-flow-demo/ (add `?mode=advanced` for the research view)

An interactive exploration of Poiseuille’s law applied to blood flow in microvessels. A 3D vessel with moving red cells, white cells and platelets is synchronised with the equation, a set of live readouts and six charts, so every slider shows its effect in three ways at once.

$$Q = \frac{\pi r^4 \Delta P}{8 \eta L}$$

## Two models

**Simple** (default) is the textbook law. Radius, viscosity, length and pressure drop are set directly, the vessel is uniform, and the point is the fourth-power dependence on radius.

**Advanced** switches the biology on:

- **Viscosity from haematocrit and plasma viscosity** using the Pries–Neuhaus–Gaehtgens (1992) in-vitro fit, which includes the Fåhræus–Lindqvist effect: apparent viscosity falls in vessels below ~300 µm and is lowest near 7 µm. The effect can be toggled off to compare with bulk viscosity.
- **A mural cell that follows vessel diameter.** Capillaries up to 12 µm diameter carry a pericyte; larger vessels carry smooth muscle. The cell’s tone (0.6–1.1 × the surrounding radius) sets the radius beneath it.
- **Local constriction in series with the rest of the vessel.** A pericyte only squeezes the ~20 µm under its soma and processes, so the flow is computed as ΔP ÷ (R_vessel + R_constriction). Smooth muscle covers the vessel continuously and sets the whole length. A readout shows what share of the resistance the constriction accounts for.
- **Pulsatile pressure** with an adjustable heart rate.
- **Extra readouts:** mean and centreline velocity, Reynolds number, wall shear stress, transit time, and a viscosity-vs-diameter chart.

Switching between the modes carries the current numbers across: viscosity becomes the haematocrit that reproduces it, and back again.

## The 3D vessel

- Radii are to scale in micrometres; lengths are compressed to fit on screen.
- Cells obey continuity (faster through a narrowing) and move on a parabolic velocity profile, with arrows showing the profile at the narrowest point.
- Red cells use the Evans–Fung biconcave profile; counts scale with haematocrit and lumen volume.
- The pericyte sits on the waist it creates; smooth muscle appears as circumferential bands.

## Running locally

```bash
npm install
npm start          # http://localhost:3000
npm run deploy     # builds and publishes to GitHub Pages
```

Built with React, react-three-fiber, drei, Recharts and KaTeX. The physics lives in `src/physics.js` with no React dependencies, so it can be tested or reused on its own.

## Versions

- `main` — version 2 (this README).
- Tag `v1` — the original explorer with abstract units and a single adjustable segment: `git checkout v1`.

## Assumptions and limits

Hagen–Poiseuille assumes steady, laminar flow of a Newtonian fluid in a rigid tube; the Reynolds number readout shows when the laminar assumption begins to strain. The viscosity fit comes from glass-tube data and underestimates in-vivo viscosity at small diameters, where the endothelial glycocalyx matters. Pulsatile mode scales the driving pressure only; the wall does not deform.

## Author

George (Yorgos) Sideris-Lampretsas

## Reference

Pries AR, Neuhaus D, Gaehtgens P. Blood viscosity in tube flow: dependence on diameter and hematocrit. *Am J Physiol* 1992;263:H1770–8.
