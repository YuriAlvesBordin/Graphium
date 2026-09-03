/**
 * @class StarClusterRoutes
 * @brief Edge routing provider that renders every edge inside a fully connected
 *        cluster of 3+ nodes (a clique) as a two-segment polyline that passes
 *        through the cluster's virtual center: node A -> centroid -> node B.
 *
 * This class implements the duck-typed `routes` protocol consumed by
 * WebGLRenderer2D (`getPointCount(index)` / `getRoute(index)`). When a link is
 * not part of any clique it reports 0 points, so the renderer falls back to
 * drawing the straight source->target segment.
 *
 * Only the geometry is altered - physics and picking are unaffected for the
 * physicist, and clusters are recomputed lazily only when the graph topology
 * changes (model.topologyRevision), while centroids are refreshed once per
 * frame from the live node positions.
 */
export class StarClusterRoutes {
  constructor(model) {
    this.model = model;
    this._topologyRevision = -1;
    this._clusters = [];
    this._clusterOfNode = new Int32Array(0);
    this._clusterOfLink = new Int32Array(0);
    this._frameStamp = 0;
    this._centroidStamp = -1;
    this._centroids = new Float32Array(0);
    this._scratch = new Float32Array(6);
  }

  /** Marks the start of a render frame; invalidates per-frame centroid cache. @return {this} This routes provider. */
  beginFrame() {
    this._frameStamp++;
    return this;
  }

  /**
   * Rebuilds adjacency and clique clusters when the graph topology changes.
   * Clusters are maximal cliques of size >= 3, grown greedily in descending
   * degree order; each node may belong to at most one cluster (node-disjoint),
   * which keeps edge routing unambiguous. @return {void}
   */
  _rebuildIfNeeded() {
    const model = this.model;
    if (model.topologyRevision === this._topologyRevision) {
      return;
    }
    const nodeCount = model.nodeCount;
    const linkCount = model.linkCount;

    const adjacency = [];
    for (let i = 0; i < nodeCount; i++) {
      adjacency.push(new Set());
    }
    for (let link = 0; link < linkCount; link++) {
      const source = model.source[link];
      const target = model.target[link];
      if (source !== target) {
        adjacency[source].add(target);
        adjacency[target].add(source);
      }
    }

    const clusterOfNode = new Int32Array(nodeCount).fill(-1);
    const claimed = new Uint8Array(nodeCount);
    const clusters = [];

    const order = [];
    for (let i = 0; i < nodeCount; i++) {
      order.push(i);
    }
    order.sort((a, b) => adjacency[b].size - adjacency[a].size);

    for (let i = 0; i < order.length; i++) {
      const start = order[i];
      if (claimed[start]) {
        continue;
      }
      const cluster = [start];
      let candidates = new Set();
      for (const neighbor of adjacency[start]) {
        if (!claimed[neighbor]) {
          candidates.add(neighbor);
        }
      }
      while (candidates.size > 0) {
        let bestNode = -1;
        let bestScore = -1;
        for (const candidate of candidates) {
          let score = 0;
          for (const other of candidates) {
            if (adjacency[candidate].has(other)) {
              score++;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestNode = candidate;
          }
        }
        if (bestNode < 0) {
          break;
        }
        cluster.push(bestNode);
        const next = intersectSets(candidates, adjacency[bestNode]);
        candidates = next;
      }

      if (cluster.length >= 3) {
        const clusterId = clusters.length;
        for (let j = 0; j < cluster.length; j++) {
          clusterOfNode[cluster[j]] = clusterId;
          claimed[cluster[j]] = 1;
        }
        clusters.push(cluster);
      } else {
        claimed[start] = 1;
      }
    }

    const clusterOfLink = new Int32Array(linkCount).fill(-1);
    for (let link = 0; link < linkCount; link++) {
      const source = model.source[link];
      const target = model.target[link];
      if (source !== target) {
        const clusterId = clusterOfNode[source];
        if (clusterId >= 0 && clusterId === clusterOfNode[target]) {
          clusterOfLink[link] = clusterId;
        }
      }
    }

    this._topologyRevision = model.topologyRevision;
    this._clusters = clusters;
    this._clusterOfNode = clusterOfNode;
    this._clusterOfLink = clusterOfLink;
    this._centroids = new Float32Array(clusters.length * 2);
    this._centroidStamp = -1;
  }

  /** Computes the centroid of every cluster from the live node positions, once per frame. @return {void} */
  _ensureCentroids() {
    if (this._centroidStamp === this._frameStamp) {
      return;
    }
    const model = this.model;
    const clusters = this._clusters;
    for (let clusterId = 0; clusterId < clusters.length; clusterId++) {
      const members = clusters[clusterId];
      let sumX = 0;
      let sumY = 0;
      const size = members.length;
      for (let j = 0; j < size; j++) {
        const node = members[j];
        sumX += model.x[node];
        sumY += model.y[node];
      }
      this._centroids[clusterId * 2] = sumX / size;
      this._centroids[clusterId * 2 + 1] = sumY / size;
    }
    this._centroidStamp = this._frameStamp;
  }

  /**
   * @brief Number of polyline points for the given link.
   * @param {number} linkIndex Edge index in the model.
   * @return {number} 3 for intra-clique links (node -> center -> node), otherwise 0.
   */
  getPointCount(linkIndex) {
    this._rebuildIfNeeded();
    return this._clusterOfLink[linkIndex] >= 0 ? 3 : 0;
  }

  /**
   * @brief Returns the star polyline for an intra-clique link.
   * @param {number} linkIndex Edge index in the model.
   * @return {Float32Array|null} Flat `[ax, ay, cx, cy, bx, by]` route, or null
   *         when the link is not routed. The array is reused across calls, so
   *         the caller must consume its values in the same frame iteration.
   */
  getRoute(linkIndex) {
    this._rebuildIfNeeded();
    const clusterId = this._clusterOfLink[linkIndex];
    if (clusterId < 0) {
      return null;
    }
    this._ensureCentroids();
    const model = this.model;
    const scratch = this._scratch;
    const source = model.source[linkIndex];
    const target = model.target[linkIndex];
    scratch[0] = model.x[source];
    scratch[1] = model.y[source];
    scratch[2] = this._centroids[clusterId * 2];
    scratch[3] = this._centroids[clusterId * 2 + 1];
    scratch[4] = model.x[target];
    scratch[5] = model.y[target];
    return scratch;
  }
}

/** @brief Returns a new Set with the elements contained in both input sets. @param {Set} a @param {Set} b @return {Set} */
function intersectSets(a, b) {
  const small = a.size <= b.size ? a : b;
  const large = small === a ? b : a;
  const out = new Set();
  for (const value of small) {
    if (large.has(value)) {
      out.add(value);
    }
  }
  return out;
}