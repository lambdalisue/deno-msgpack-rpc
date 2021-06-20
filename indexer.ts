/**
 * Indexer returns sequential index
 */
export class Indexer {
  #max: number;
  #val: number;

  constructor(max?: number) {
    if (max != null && max < 2) {
      throw new Error(
        `The attribute 'max' must be greater than 1 but ${max} has specified`,
      );
    }
    this.#max = max ?? Number.MAX_SAFE_INTEGER;
    this.#val = -1;
  }

  /**
   * Increment the internal index and return it
   *
   * It resets the internal index if it beyonds the max.
   */
  next(): number {
    if (this.#val >= this.#max) {
      this.#val = -1;
    }
    this.#val += 1;
    return this.#val;
  }
}
