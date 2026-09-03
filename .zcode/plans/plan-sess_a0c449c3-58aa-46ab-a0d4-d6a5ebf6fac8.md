## Investigation Plan: Missing Arrow Tips in demo.html

### Goal
Determine why direction‑arrow triangles are not visible when the “Setas” toggle is enabled, despite seeing console logs indicating arrow data is generated and no shader errors.

### Assumptions from User Answers
- Console logs show the toggle is working and arrow draw count is non‑zero.
- No WebGL shader compilation/linking errors are reported.
- The demo is loaded via `file://` (local file), which should not affect WebGL rendering.

### Possible Causes
1. **Arrow geometry not reaching the fragment shader** (incorrect attribute bindings, wrong stride/offset, or missing attribute enabling).
2. **Arrow primitives being culled or clipped** (e.g., vertex positions outside clip space due to incorrect scaling or camera matrix).
3. **Arrow color/alpha zero** (transparent) causing invisibility.
4. **Arrow drawn but obscured by later passes** (nodes drawn on top, or blending issues).
5. **Arrow size too small to be perceptible** (e.g., half‑width or length computed as zero).
6. **State changes between passes** (e.g., enabling/disabling blending, depth test, or changing the wrong program).

### Investigation Steps (to be executed after plan approval)

1. **Verify Arrow Data Generation**
   - In `_fillArrowData`, after filling `this.arrowData`, log a few samples (positions, color, halfWidth) to confirm values are sane and non‑zero.
   - Example: `console.log('arrow sample:', this.arrowData.slice(0,14));`

2. **Check Attribute Setup for Arrow VAO**
   - In `_initGL`, after setting up the arrow VAO, verify that the attribute indices match the shader locations:
     * attribute 0 → `aCorner` (vec2)
     * attribute 1 → `aArrow` (vec4: base+tip)
     * attribute 2 → `aColor` (vec4)
     * attribute 3 → `aStyle` (vec4: halfWidth, unused)
   - Log the enabled attribute divisors and pointers to ensure stride (`14 * 4`) and offsets are correct.

3. **Inspect Arrow Shader Locations (optional)**
   - Temporarily add code after linking the arrow program to query and log the location of each attribute (`gl.getAttribLocation(program, 'aCorner')`, etc.) to confirm they match the indices we bound.

4. **Validate Vertex Positions in Clip Space**
   - In the arrow vertex shader, output the computed `gl_Position` as a varying (or use `gl_Position` to compute a debug color) and read back via `gl.readPixels` or, simpler, modify the fragment shader to output the position as color for a few frames to see if vertices are within [-1,1] range.
   - Since we cannot modify shaders permanently without approval, we plan to add a temporary debug uniform that, when set, passes through the position as color.

5. **Check Arrow Size and Half‑Width**
   - Log the values of `model.linkArrowSize[index]` and `model.linkArrowWidth[index]` used in `_fillArrowData` to ensure they are >0 and not being inadvertently zeroed by zoom division.
   - Verify that `zoom` is not extremely large (should be ~1 initially).

6. **Confirm Arrow Color/Alpha**
   - Log the unpacked color and opacity values used for each arrow instance.
   - Ensure the alpha component is not zero (especially when links are selected/unselected).

7. **Render Order and Blending**
   - Verify that the current render order is: edges → arrows → nodes.
   - Temporarily swap the order (draw arrows after nodes) to see if arrows become visible (indicating they were being overdrawn).
   - Ensure blending state (`gl.BLEND`, `gl.SRC_ALPHA`, `gl.ONE_MINUS_SRC_ALPHA`) is unchanged between passes.

8. **Primitive Type and Vertex Count**
   - Confirm we are drawing a `TRIANGLE_FAN` with 4 vertices (which yields a degenerate quad that collapses to a triangle). If the intention is a proper triangle, we might need 3 vertices and use `TRIANGLES` or adjust the corner positions accordingly.
   - Log the primitive call: `gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.arrowDrawCount);`

9. **Temporary Visual Override**
   - As a quick test, temporarily replace the arrow color with a bright, opaque color (e.g., `vec4(1.0,0.0,0.0,1.0)`) in the fragment shader to see if any shape appears.

10. **Check for Any State Changes Affecting Arrow Pass**
    - Scan the `render` method for any changes to `gl.enable/disable` (e.g., `gl.DEPTH_TEST`, `gl.CULL_FACE`) that might happen between the edge and arrow passes.

### Expected Outcome
After performing the above checks, we should be able to pinpoint whether the issue is:
- No vertex data reaching the shader (attribute setup),
- Vertices outside clip space (transform/scaling),
- Invisible due to zero alpha or color,
- Obscured by later passes,
- Or too small to notice.

Once the root cause is identified, we will implement the appropriate fix (e.g., correct attribute pointers, adjust arrow size/position, change render order, or modify shader) and verify that arrows appear correctly in the demo.

### Post‑Implementation Verification
- Toggle the “Setas” checkbox and confirm arrow tips are visible at link ends.
- Ensure that per‑link overrides (`arrow: false`, custom `arrowSize`/`arrowWidth`) still work.
- Verify that the feature does not break existing edge or node rendering.

### Note
All changes will be made only after receiving approval via this plan. No edits will be performed prior to ExitPlanMode.