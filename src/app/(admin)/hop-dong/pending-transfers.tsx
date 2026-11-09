"use client";

import Link from "next/link";
import { ArrowRightLeft, FileText } from "lucide-react";
import type { PendingRoomTransferRequest } from "@/lib/queries";
import { RoomTransferDialog, type RoomOptionSimple } from "./room-transfer-dialog";
import styles from "@/components/business.module.css";

function money(num: number | string | null | undefined) {
  if (!num) return "0 đ";
  return `${Number(num).toLocaleString("vi-VN")} đ`;
}

function date(str: string | null | undefined) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("vi-VN");
}

export function PendingTransfersQueue({
  requests,
  emptyRooms,
}: {
  requests: PendingRoomTransferRequest[];
  emptyRooms: RoomOptionSimple[];
}) {
  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: 20,
        background: "var(--bg-surface)",
        borderRadius: 10,
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              background: "var(--primary)",
              color: "var(--bg-surface)",
              width: 28,
              height: 28,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightLeft size={15} />
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
            Yêu cầu đổi phòng
          </h2>
        </div>

        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--primary-subtle)",
            color: "var(--primary)",
            border: "1px solid var(--border-strong)",
          }}
        >
          {requests.length} yêu cầu cần duyệt
        </span>
      </div>

      {/* Bảng danh sách yêu cầu đổi phòng */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Khách thuê</th>
              <th>Lộ trình đổi phòng</th>
              <th>Ngày hẹn dọn</th>
              <th>Tài chính</th>
              <th>Lý do</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.ma_yeu_cau}>
                <td>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>
                      {req.ten_khach || "Cư dân"}
                    </strong>
                    {req.so_dt && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                        {req.so_dt}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Cũ: </span>
                    <strong style={{ color: "var(--text-main)" }}>
                      {req.ten_phong_cu || req.ma_phong_cu}
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {" "}({money(req.gia_phong_cu)}/th)
                    </span>
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <strong style={{ color: "var(--text-main)", marginRight: 4, fontSize: 12 }}>➔ Mới: </strong>
                    <strong style={{ color: "var(--text-main)" }}>
                      {req.ten_phong_moi || req.ma_phong_moi}
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {" "}({money(req.gia_phong_moi)}/th)
                    </span>
                  </div>
                </td>
                <td>
                  <strong style={{ color: "var(--text-main)" }}>
                    {date(req.thoi_gian_hen)}
                  </strong>
                </td>
                <td>
                  <div>
                    Cọc: <strong>{money(req.tien_coc_bao_luu)}</strong>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    Nợ cũ: <strong>{money(req.unpaid_total)}</strong>
                  </div>
                </td>
                <td style={{ maxWidth: 220 }}>
                  {req.ly_do_chuyen || "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                    <Link
                      href={`/hop-dong/${encodeURIComponent(req.ma_hop_dong)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 11px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        color: "var(--text-main)",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <FileText size={13} /> Chi tiết HĐ
                    </Link>

                    <RoomTransferDialog
                      maHopDong={req.ma_hop_dong}
                      maPhongCu={req.ma_phong_cu}
                      tenPhongCu={req.ten_phong_cu ?? undefined}
                      tenKhach={req.ten_khach || "Cư dân"}
                      giaThueCu={req.gia_phong_cu}
                      tienDatCocCu={req.tien_coc_bao_luu}
                      emptyRooms={emptyRooms}
                      maYeuCau={req.ma_yeu_cau}
                      maPhongMoiDuKien={req.ma_phong_moi}
                      ngayHenDuKien={req.thoi_gian_hen}
                      lyDoChuyen={req.ly_do_chuyen}
                      isFromMobileRequest={true}
                      triggerButtonVariant="table"
                      triggerButtonText="Nghiệm thu & Duyệt"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
