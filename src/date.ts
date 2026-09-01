const bangkokDateParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
};

export const dateToday = (value = new Date()) => {
  const fields = bangkokDateParts(value);
  return `${fields.year}-${fields.month}-${fields.day}`;
};

export const monthStartToday = (value = new Date()) => `${dateToday(value).slice(0, 7)}-01`;

export const formatThaiDateTime = (value?: string) => {
  if (!value) return "ไม่ระบุวันที่";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  const options = { timeZone: "Asia/Bangkok" } as const;
  const date = parsed.toLocaleDateString("th-TH", { ...options, day: "numeric", month: "short", year: "numeric" });
  if (dateOnly || !/T\d{2}:\d{2}/.test(value)) return date;
  const time = parsed.toLocaleTimeString("th-TH", { ...options, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time} น.`;
};
