export class RandomUtil {
  static randomRange(min: number, max: number): number {
    return Math.floor(Math.random() * max) + min;
  }
}