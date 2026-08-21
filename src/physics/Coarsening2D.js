/**
 * @class Coarsening2D
 * @brief Heavy-Edge Matching (HEM) algorithm for graph reduction.
 *
 * Operates exclusively on TypedArrays without instantiating new JavaScript objects.
 * Useful for multi-level layout and physics initialization.
 */
export class Coarsening2D {
  /**
   * @brief Constructs the coarsening builder.
   * @param model The GraphModel instance.
   * @param options Coarsening configuration options.
   */
  constructor(model, options = {}) {
    this.model = model;
    this.options = { enabled: false, maxLevels: 3, minNodes: 32, ...options };
    this.levels = [];
  }
  setOptions(options = {}) {
    Object.assign(this.options, options);
    return this;
  }
  clear() {
    this.levels.length = 0;
  }

  build() {
    this.clear();
    if (!this.options.enabled || this.model.nodeCount < this.options.minNodes) {
      return this.levels;
    }
    let count = this.model.nodeCount;
    let mapping = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      mapping[i] = i;
    }
    for (let level = 0; level < this.options.maxLevels && count > this.options.minNodes; level++) {
      const matched = new Uint8Array(count);
      const nextMapping = new Int32Array(count);
      let coarseCount = 0;
      for (let e = 0; e < this.model.linkCount; e++) {
        const a = this.model.source[e];
        const b = this.model.target[e];
        if (a >= count || b >= count || matched[a] || matched[b]) {
          continue;
        }
        matched[a] = 1;
        matched[b] = 1;
        const coarse = coarseCount++;
        nextMapping[a] = coarse;
        nextMapping[b] = coarse;
      }
      for (let i = 0; i < count; i++) {
        if (!matched[i]) {
          nextMapping[i] = coarseCount++;
        }
      }
      const levelMap = new Int32Array(count);
      for (let i = 0; i < count; i++) {
        levelMap[i] = nextMapping[mapping[i]];
      }
      this.levels.push({ nodeCount: coarseCount, fineToCoarse: levelMap });
      mapping = levelMap;
      count = coarseCount;
    }
    return this.levels;
  }

  getLevel(index = 0) {
    return this.levels[index] || null;
  }
  getNodeGroup(level, nodeIndex) {
    const current = this.levels[level];
    return current ? current.fineToCoarse[nodeIndex] : nodeIndex;
  }
}
