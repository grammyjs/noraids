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
