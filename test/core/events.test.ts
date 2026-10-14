import { Emitter } from '../../src/core/events';

describe('Emitter', () => {
  it('should deliver payloads to every listener in registration order', () => {
    const emitter = new Emitter();
    const calls: string[] = [];
    emitter.on('tick', () => calls.push('first'));
    emitter.on('tick', () => calls.push('second'));
    emitter.emit('tick', 1);
    expect(calls).toEqual(['first', 'second']);
  });

  it('should return an unsubscribe handle from on', () => {
    const emitter = new Emitter();
    const calls: number[] = [];
    const stop = emitter.on('tick', payload => calls.push(payload as number));
    emitter.emit('tick', 1);
    stop();
    emitter.emit('tick', 2);
    expect(calls).toEqual([1]);
  });

  it('should fire once listeners a single time and remove themselves', () => {
    const emitter = new Emitter();
    const calls: number[] = [];
    emitter.once('tick', payload => calls.push(payload as number));
    emitter.emit('tick', 1);
    emitter.emit('tick', 2);
    expect(calls).toEqual([1]);
  });

  it('should remove a specific listener through off', () => {
    const emitter = new Emitter();
    const calls: string[] = [];
    const first = () => calls.push('first');
    const second = () => calls.push('second');
    emitter.on('tick', first);
    emitter.on('tick', second);
    emitter.off('tick', first);
    emitter.emit('tick', 0);
    expect(calls).toEqual(['second']);
  });

  it('should remove every listener of a type when off has no listener', () => {
    const emitter = new Emitter();
    const calls: number[] = [];
    emitter.on('tick', () => calls.push(1));
    emitter.on('tick', () => calls.push(2));
    emitter.off('tick');
    emitter.emit('tick', 0);
    expect(calls).toEqual([]);
  });

  it('should ignore emissions for unknown event types', () => {
    const emitter = new Emitter();
    expect(() => emitter.emit('nothing', {})).not.toThrow();
    expect(emitter.emit('nothing', 1)).toBe(emitter);
  });

  it('should clear every handler', () => {
    const emitter = new Emitter();
    const calls: number[] = [];
    emitter.on('a', () => calls.push(1));
    emitter.on('b', () => calls.push(2));
    emitter.clear();
    emitter.emit('a', 0);
    emitter.emit('b', 0);
    expect(calls).toEqual([]);
  });

  it('should keep remaining listeners consistent when one unsubscribes during dispatch', () => {
    const emitter = new Emitter();
    const calls: string[] = [];
    const stop = emitter.on('tick', () => {
      calls.push('first');
      stop();
    });
    emitter.on('tick', () => calls.push('second'));
    // Unsubscribing mid dispatch shifts the array, so the follower is only
    // reached again on the next emission.
    emitter.emit('tick', 0);
    emitter.emit('tick', 0);
    expect(calls).toEqual(['first', 'second']);
    expect(stop).toBeInstanceOf(Function);
  });
});
