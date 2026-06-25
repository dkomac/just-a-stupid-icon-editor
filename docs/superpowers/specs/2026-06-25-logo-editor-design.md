# Logo Editor Design Spec

## Goal

Build a simple and clean logo editor for non-designers that still supports precise controls. The editor must support different shapes, layers, colors, masking, and export to JPG, PDF, WebM, and SVG.

## Product Direction

The app is a product/tool surface, not a landing page. It should open directly into a usable editor. The intended user is not a designer, but they still want exact controls such as X/Y position, size, rotation, opacity, hex colors, layer order, alignment, snapping, export dimensions, and mask settings.

The core promise is: drag things casually when that is fastest, then refine with exact values when needed.

## Recommended Approach

Use a hybrid SVG-first architecture:

- Keep the editable logo document as structured vector state.
- Render the canvas as SVG so shapes, text, layers, colors, and masks stay crisp and inspectable.
- Export SVG directly from the document model.
- Rasterize the SVG through canvas for JPG output.
- Use a PDF generation path that embeds or draws the SVG at the selected export dimensions.
- Generate WebM by rendering SVG/canvas frames over time. If no animation timeline exists, export a short static video of the logo at the selected dimensions.

This approach preserves clean vector editing while still supporting the requested raster, document, and video exports.

## Editor Layout

The first screen is the editor itself:

- Top command bar with document name, undo, redo, zoom, snapping, grid, and export.
- Left toolbar with selection, rectangle, circle/ellipse, polygon, star, line, and text tools.
- Center workspace with a fixed-size artboard, optional grid, zoom, pan, selection outlines, resize handles, rotation handle, and snapping guides.
- Layers panel with ordered layer rows, visibility, lock, duplicate, delete, rename, reorder, and mask indicators.
- Inspector panel with exact controls for selected layers and document export settings.

The UI should stay quiet and work-focused. It should not use a landing-page hero, decorative sections, or large explanatory copy.

## Shape Support

The first implementation should support:

- Rectangle with optional corner radius.
- Ellipse/circle.
- Polygon with configurable sides.
- Star with configurable points.
- Line with stroke width.
- Text with content, font size, font weight, and style controls.

Each shape should have fill, stroke, opacity, transform, and layer metadata where relevant.

## Layer Support

Layers must support:

- Select single layer.
- Show, hide, lock, unlock.
- Rename.
- Duplicate.
- Delete.
- Reorder front/back by drag or commands.
- Display mask relationships.

Layer rows should make the stack order clear and allow users to recover when an object is hidden behind another object.

## Precision Controls

The inspector must expose:

- X and Y position.
- Width and height.
- Rotation in degrees.
- Opacity.
- Fill color with swatch and hex input.
- Stroke color with swatch and hex input.
- Stroke width.
- Shape-specific values such as corner radius, polygon sides, and star points.
- Layer order commands.
- Alignment commands.
- Snapping controls.
- Export width, height, background, and format.

The app should allow direct manipulation first, but the inspector should always be available for exact edits.

## Masking

Masking should be understandable without design jargon:

- A selected layer can be marked as a mask.
- A mask can be applied to another selected layer or group.
- The layer panel should clearly show which layer is the mask and which layer is masked.
- Users can release a mask relationship.

Implementation should map this to SVG clip paths or masks, choosing the simpler path that supports the visible behavior.

## Export

The export panel must support:

- SVG export from the vector document.
- JPG export by rasterizing the SVG to canvas.
- PDF export at selected dimensions.
- WebM export by rendering frames from the canvas.

Export settings should include:

- Width and height.
- Transparent or solid background where the format supports it.
- Background color for JPG/PDF/WebM.
- Scale or quality controls where relevant.

The user should receive a downloaded file without needing a server.

## State Model

Represent the document with:

- Document metadata: name, artboard size, background, grid/snap settings.
- Ordered layers.
- Layer properties: id, name, type, visible, locked, opacity, transform, geometry, fill, stroke, mask relationship.
- Selection state.
- History stack for undo and redo.

Keep export functions separate from editing state so they can be tested independently.

## Error Handling

The app should handle:

- Export failures with a concise message and no state loss.
- Invalid hex colors by rejecting or reverting with visible feedback.
- Locked layers by preventing edits and explaining the locked state.
- Hidden layers by excluding them from visible output.
- Unsupported WebM APIs by disabling WebM export with an explanation.

## Testing

Core behavior should be covered with focused tests:

- Document model creates, updates, reorders, hides, locks, duplicates, and deletes layers.
- Shape serialization produces expected SVG.
- Mask relationships serialize correctly.
- Export helpers expose SVG/JPG/PDF/WebM paths.
- Precision edits update layer state.
- Undo/redo restores document state.

Manual/browser verification should check:

- The editor renders at desktop and mobile/tablet widths without overlapping controls.
- Shapes can be added, selected, moved, resized, recolored, layered, masked, and exported.
- Exported SVG opens as a valid vector file.
- JPG/PDF/WebM export creates downloadable files.

## Scope Notes

The first version should not attempt full Illustrator-level path editing, template marketplaces, collaborative editing, cloud accounts, or AI logo generation. The priority is a reliable local editor with a clean interface and the requested export formats.
