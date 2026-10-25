const defaultDigits = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

function readThreeDigits(threeDigits: number, isFull = false): string {
  let result = "";
  const hundreds = Math.floor(threeDigits / 100);
  const remainder = threeDigits % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  if (isFull || hundreds > 0) {
    result += ` ${defaultDigits[hundreds]} trăm`;
    if (tens === 0 && units > 0) result += " lẻ";
  }

  if (tens === 1) {
    result += " mười";
  } else if (tens > 1) {
    result += ` ${defaultDigits[tens]} mươi`;
  }

  if (tens > 0 && units === 1 && tens > 1) {
    result += " mốt";
  } else if (units === 5 && (tens > 0 || (isFull && hundreds > 0))) {
    result += " lăm";
  } else if (units > 0) {
    result += ` ${defaultDigits[units]}`;
  }

  return result.trim();
}

/** Đọc số tiền nguyên dương thành chữ tiếng Việt chuẩn kế toán. */
export function readVietnameseCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "Không đồng";
  const numVal = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(numVal) || numVal <= 0) return "Không đồng";

  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  let num = Math.floor(Math.abs(numVal));
  const groups: number[] = [];

  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  let text = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const isFull = i < groups.length - 1;
      const groupText = readThreeDigits(g, isFull);
      text += ` ${groupText} ${units[i]}`.trimEnd() + " ";
    }
  }

  text = text.trim();
  if (!text) return "Không đồng";

  const formatted = text.charAt(0).toUpperCase() + text.slice(1);
  return `${formatted} đồng chẵn.`;
}

