/**
 * Длительность для людей: «9 ч 30 мин». Округляется до минуты один раз — итог, а не
 * слагаемые: сумма округлённых записей разошлась бы с итогом.
 */
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export function formatDuration(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new RangeError(`formatDuration: ожидаются целые неотрицательные секунды, получено ${seconds}`);
  }
  const totalMinutes = Math.round(seconds / SECONDS_PER_MINUTE);
  if (totalMinutes === 0) {
    return seconds === 0 ? '0 мин' : 'меньше минуты';
  }
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes} мин`;
  return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
}
