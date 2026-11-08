"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type RoomTableRowProps = {
  maPhong: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function RoomTableRow({
  maPhong,
  children,
  className,
  style,
}: RoomTableRowProps) {
  const router = useRouter();

  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement | null;
    // Bỏ qua nếu bấm vào nút, link, form hoặc các phần tử tương tác khác
    if (target?.closest("a, button, input, select, textarea, form, label")) {
      return;
    }

    const url = `/phong/${encodeURIComponent(maPhong)}`;
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(url, "_blank");
    } else {
      router.push(url);
    }
  };

  return (
    <tr
      onClick={handleRowClick}
      className={className}
      style={{ cursor: "pointer", ...style }}
    >
      {children}
    </tr>
  );
}
