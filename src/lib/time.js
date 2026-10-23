const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function relativeDateKey(now, offset) {
  return dateKey(addDays(startOfDay(now), offset));
}

export function isoForDateTime(key, time) {
  const [year, month, day] = key.split("-").map(Number);
  const [hour, minute = "00"] = time.split(":");
  const date = new Date(year, month - 1, day, Number(hour), Number(minute));
  return date.toISOString();
}

export function slotIdFor(key, time) {
  return `slot_${key.replaceAll("-", "")}_${time.replace(":", "")}`;
}

export function formatDateLabel(key, now = new Date()) {
  const date = dateFromKey(key);
  const today = startOfDay(now);
  const diff = Math.round((startOfDay(date) - today) / 86_400_000);
  const prefix = diff === 0 ? "今天" : diff === 1 ? "明天" : diff === 2 ? "后天" : DAY_NAMES[date.getDay()];
  return `${prefix} · ${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDateShort(key, now = new Date()) {
  const date = dateFromKey(key);
  const today = startOfDay(now);
  const diff = Math.round((startOfDay(date) - today) / 86_400_000);
  const prefix = diff === 0 ? "今天" : diff === 1 ? "明天" : diff === 2 ? "后天" : DAY_NAMES[date.getDay()];
  return `${prefix} ${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatClock(iso) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(new Date(iso));
}

export function formatDateTime(iso, now = new Date()) {
  const date = new Date(iso);
  const key = dateKey(date);
  return `${formatDateLabel(key, now)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function relativeTime(iso, now = new Date()) {
  const diffMinutes = Math.max(0, Math.round((now - new Date(iso)) / 60_000));
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}
