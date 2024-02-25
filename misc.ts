export const MILLISECOND = 1;
export const SECOND = 1_000 * MILLISECOND;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export function display(timestamps: number[]) {
  return timestamps
    .map((v) => new Date(v))
    .map((v) => {
      const HH = v.getHours().toString().padStart(2, "0");
      const MM = v.getMinutes().toString().padStart(2, "0");
      const SS = v.getSeconds().toString().padStart(2, "0");
      const MS = v.getMilliseconds().toString().padStart(3, "0");
      return `${HH}:${MM}:${SS}.${MS}`;
    })
    .map((v) => `\u2981 ${v}`)
    .join("\n");
}
