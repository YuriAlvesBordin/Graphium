import { Graphium } from "./src/Graphium.js";

console.log("Testing Graphium arrow logic...");

// Create a Graphium instance without canvas (just for model/testing)
const graph = new Graphium({
  appearance: {
    edgeArrowEnabled: false,
    edgeArrowSize: 10,
    edgeArrowWidth: 6
  }
});

// Add two nodes
graph.addNode("A", { x: 0, y: 0 });
graph.addNode("B", { x: 100, y: 0 });

// Add a link with default (should inherit global -> false, so no arrow)
const link1 = graph.addLink("e1", "A", "B", {});
console.log("Link1 arrow (inherit false):", graph.model.linkArrow[0]); // expect 0 (inherit)
// Global is false, so effective arrow = false

// Enable global arrows
graph.setAppearance({ edgeArrowEnabled: true });
console.log("After setting edgeArrowEnabled true:");
console.log("Link1 arrow (should now be effective true):", graph.model.linkArrow[0]); // still 0 (inherit) but effective true
// We can't get effective from model directly, but we can check that the arrow flag is 0 meaning follow global.

// Add another link with explicit arrow: true
const link2 = graph.addLink("e2", "A", "B", { arrow: true, arrowSize: 20, arrowWidth: 8 });
console.log("Link2 arrow flag:", graph.model.linkArrow[1]); // expect 1
console.log("Link2 arrowSize:", graph.model.linkArrowSize[1]); // expect 20
console.log("Link2 arrowWidth:", graph.model.linkArrowWidth[1]); // expect 8

// Add link with explicit arrow: false
const link3 = graph.addLink("e3", "A", "B", { arrow: false });
console.log("Link3 arrow flag:", graph.model.linkArrow[2]); // expect -1
console.log("Link3 arrowSize (should still be default?):", graph.model.linkArrowSize[2]); // default 6? Actually we set arrowSize on options? we didn't, so should be default from linkDefaults (6)
console.log("Link3 arrowWidth:", graph.model.linkArrowWidth[2]); // default 6

// Change global size, should affect inherit links (link1) but not explicit ones
graph.setAppearance({ edgeArrowSize: 15 });
console.log("After changing global edgeArrowSize to 15:");
console.log("Link1 arrowSize (inherit):", graph.model.linkArrowSize[0]); // should now be 15
console.log("Link2 arrowSize (explicit 20):", graph.model.linkArrowSize[1]); // should stay 20
console.log("Link3 arrowSize (explicit false but size still applicable?):", graph.model.linkArrowSize[2]); // should be 15? Actually arrowSize is still stored; arrow false only disables drawing but size still stored. We set arrowSize? not in options, so it should have been set to global default at creation time (6). After global change, does it update? No, because we didn't call setLinkAppearance. So it stays 6. Let's verify.

// Test removing link and swap
graph.removeLink("e2"); // remove link at index 1
console.log("After removing link2, linkCount:", graph.model.linkCount);
console.log("Remaining link flags:", graph.model.linkArrow); // should have length 2 now? Actually we had 3 links, removed index 1, so indices 0 and 2 remain, but index 2 moves to 1? Let's see.
// We expect link0 (A-B inherit) and link2 (A-B explicit false) now at indices 0 and 1.
// The arrow flag of the moved link should be -1.
// Let's log:
console.log("Link0 flag:", graph.model.linkArrow[0]);
console.log("Link1 flag:", graph.model.linkArrow[1]);

console.log("Logic test completed.");