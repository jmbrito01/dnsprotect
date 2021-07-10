
export class DateUtil {
  static epochSecondsToDate(seconds: number): Date {
    const d = new Date(0);
    d.setUTCSeconds(seconds);

    return d;
  }
}