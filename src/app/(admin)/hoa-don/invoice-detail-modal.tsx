"use client";

import { useState, useTransition } from "react";
import { Eye, X, LoaderCircle } from "lucide-react";
import type { InvoiceDetail } from "@/lib/queries";
import { getInvoiceDetailAction } from "./actions";
import { InvoiceDetailView } from "./invoice-detail-view";
import styles from "./invoice-detail.module.css";

export function InvoiceDetailTrigger({
  maHoaDon,
  children,
  asButton = false,
}: {
  maHoaDon: string;
  children?: React.ReactNode;
  asButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setError(null);
    setOpen(true);
    if (!detail) {
      startTransition(async () => {
        const res = await getInvoiceDetailAction(maHoaDon);
        if (res.error) {
          setError(res.error);
        } else {
          setDetail(res.data);
        }
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      {asButton ? (
        <button
          type="button"
          onClick={handleOpen}
          className={styles.btnDetailRow}
          title="Xem chi tiết hóa đơn"
        >
          <Eye size={13} />
          {children || "Chi tiết"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "#1e40af",
            fontWeight: 700,
            textDecoration: "underline",
          }}
          title="Bấm để xem chi tiết hóa đơn"
        >
          {children || maHoaDon}
        </button>
      )}

      {open && (
        <div className={styles.modalBackdrop} onClick={handleClose}>
          <div
            className={styles.modalContainer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <h3 className={styles.modalTitle}>Chi tiết hóa đơn {maHoaDon}</h3>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={handleClose}
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              {isPending && !detail ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "60px 0",
                    color: "#64748b",
                    gap: 12,
                  }}
                >
                  <LoaderCircle size={28} className="animate-spin" />
                  <span>Đang tải thông tin hóa đơn...</span>
                </div>
              ) : error ? (
                <div
                  style={{
                    padding: 24,
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  {error}
                </div>
              ) : detail ? (
                <InvoiceDetailView invoice={detail} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

