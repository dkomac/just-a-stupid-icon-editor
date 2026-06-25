# Design

## Design System Overview

Logo Creator uses a restrained product UI: a quiet app shell around a high-contrast editing canvas. The interface should stay functional and precise, with minimal decoration and no marketing-style hero treatment.

## Color Palette

- Background: neutral off-white or very light gray with no warm cream cast.
- Workspace: slightly deeper neutral to separate panels from the canvas.
- Canvas: white by default, with optional transparent/checkerboard preview.
- Ink: near-black for primary labels and controls.
- Muted text: dark enough to remain readable on neutral surfaces.
- Accent: a single saturated product accent used for selection, focus, active tools, and export affordances.
- Object colors: user-selected fills and strokes should be shown with swatches and hex inputs.

## Typography

Use one clear sans-serif family. Labels and controls should be compact and readable. Canvas-adjacent UI should avoid oversized headings; this is a tool surface, not a page selling the tool.

## Layout

The first screen is the editor:

- Top command bar: document name, undo/redo, zoom, snap toggle, export.
- Left toolbar: shape and text creation tools.
- Center workspace: canvas with pan, zoom, selection handles, grid, and snapping guides.
- Right inspector: precise values for the selected layer or document.
- Left or right layer panel: reorderable layers with visibility, lock, duplicate, delete, rename, and mask indicators.

Panels should be dense enough for repeated use, but not visually heavy. Cards are only appropriate for repeated layer rows, modal export options, and grouped inspector sections.

## Components

- Icon buttons with tooltips for editing commands.
- Segmented controls for mode choices such as select/draw/mask.
- Color swatches paired with hex input.
- Number inputs for X, Y, width, height, rotation, opacity, stroke width, corner radius, and export dimensions.
- Menus for export format and background options.
- Toggles for snapping, grid, layer visibility, lock state, and transparent background.
- Dialogs for export configuration and destructive confirmations.

## Interaction

Users can drag, resize, rotate, align, and layer objects directly on the canvas. Every direct manipulation should update the inspector values. Every inspector edit should update the canvas immediately.

Snapping should support grid, canvas center, object edges, and object centers. Alignment commands should support left, center, right, top, middle, bottom, distribute horizontal, and distribute vertical where multiple layers are selected.

Masking should use simple commands: use selected layer as a mask, apply a mask to selected layer, release mask, and show mask status in the layer panel.

## Motion

Motion should be restrained and functional: small state transitions for panel changes, selection changes, and export feedback. Direct manipulation should feel immediate. Reduced motion should disable nonessential transitions.
