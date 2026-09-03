export class SegmentGrid {
  constructor(cellSize = 180, capacity = 256) {
    this.cellSize = Math.max(1, cellSize);
    this.inv = 1 / this.cellSize;
    this.capacity = Math.max(8, capacity);
    this.next = new Int32Array(this.capacity);
    this.entryEdge = new Int32Array(this.capacity);
    this.entrySegment = new Int32Array(this.capacity);
    this.cellKeys = new Int32Array(this.capacity);
    this.segmentCount = 0;
    this.buckets = new Map();
    this.queryBuffer = new Int32Array(256);
  }
  ensure(capacity) {
    if (capacity <= this.capacity) {
      return;
    }
    let nextCapacity = this.capacity;
    while (nextCapacity < capacity) {
      nextCapacity <<= 1;
    }
    const next = new Int32Array(nextCapacity);
    next.set(this.next);
    const edge = new Int32Array(nextCapacity);
    edge.set(this.entryEdge);
    const segment = new Int32Array(nextCapacity);
    segment.set(this.entrySegment);
    this.next = next;
    this.entryEdge = edge;
    this.entrySegment = segment;
    this.capacity = nextCapacity;
  }
  clear() {
    this.buckets.clear();
    this.segmentCount = 0;
  }
  _key(x, y) {
    return (Math.floor(x * this.inv) * 73856093) ^ (Math.floor(y * this.inv) * 19349663);
  }
  insert(edgeIndex, x, y, segmentIndex = 0) {
    this.insertSegment(edgeIndex, segmentIndex, x, y);
  }
  _insertEntry(edgeIndex, segmentIndex, key) {
    const entry = this.segmentCount++;
    if (entry >= this.capacity) {
      this.ensure(entry + 1);
    }
    const head = this.buckets.get(key);
    this.next[entry] = head === undefined ? -1 : head;
    this.entryEdge[entry] = edgeIndex;
    this.entrySegment[entry] = segmentIndex;
    this.buckets.set(key, entry);
  }
  insertSegment(edgeIndex, segmentIndex, x, y) {
    this._insertEntry(edgeIndex, segmentIndex, this._key(x, y));
  }
  insertSegmentBounds(edgeIndex, segmentIndex, ax, ay, bx, by) {
    const minX = Math.floor(Math.min(ax, bx) * this.inv);
    const maxX = Math.floor(Math.max(ax, bx) * this.inv);
    const minY = Math.floor(Math.min(ay, by) * this.inv);
    const maxY = Math.floor(Math.max(ay, by) * this.inv);
    for (let cy = minY; cy <= maxY && this.segmentCount < this.capacity; cy++) {
      for (let cx = minX; cx <= maxX && this.segmentCount < this.capacity; cx++) {
        this._insertEntry(edgeIndex, segmentIndex, (cx * 73856093) ^ (cy * 19349663));
      }
    }
  }
  queryBounds(minWorldX, maxWorldX, minWorldY, maxWorldY, output) {
    const minX = Math.floor(minWorldX * this.inv);
    const maxX = Math.floor(maxWorldX * this.inv);
    const minY = Math.floor(minWorldY * this.inv);
    const maxY = Math.floor(maxWorldY * this.inv);
    let count = 0;
    for (let cy = minY; cy <= maxY && count < output.length; cy++) {
      for (let cx = minX; cx <= maxX && count < output.length; cx++) {
        const key = (cx * 73856093) ^ (cy * 19349663);
        let index = this.buckets.get(key);
        while (index !== undefined && index >= 0 && count < output.length) {
          output[count++] = index;
          index = this.next[index];
        }
      }
    }
    return count;
  }
  queryEntries(x, y, radius, output) {
    return this.queryBounds(x - radius, x + radius, y - radius, y + radius, output);
  }
  query(x, y, radius, output) {
    const count = this.queryEntries(x, y, radius, output);
    for (let i = 0; i < count; i++) {
      output[i] = this.entryEdge[output[i]];
    }
    return count;
  }
  getEdgeIndex(entry) {
    return this.entryEdge[entry];
  }
  getSegmentIndex(entry) {
    return this.entrySegment[entry];
  }
}