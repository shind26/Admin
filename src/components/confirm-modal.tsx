"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import { Modal } from "./modal";
import styles from "./confirm-modal.module.css";

export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmApi = (options: ConfirmOptions) => Promise<boolean>;

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<ConfirmApi | null>(null);

/**
 * Thay thế window.confirm() bằng hộp thoại trong ứng dụng: hiển thị rõ thao tác
 * nguy hiểm và trả về Promise<boolean> để dùng ngay trong xử lý sự kiện.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmApi>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const danger = pending?.danger ?? false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        title={pending?.title ?? ""}
        onClose={() => settle(false)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => settle(false)}
            >
              {pending?.cancelLabel ?? "Hủy bỏ"}
            </button>
            <button
              type="button"
              className={danger ? styles.dangerButton : styles.confirmButton}
              onClick={() => settle(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? "Xác nhận"}
            </button>
          </>
        }
      >
        <div className={styles.content}>
          <span className={danger ? styles.dangerIcon : styles.warnIcon}>
            {danger ? <TriangleAlert size={22} /> : <ShieldAlert size={22} />}
          </span>
          <div className={styles.message}>{pending?.message}</div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmApi {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm phải dùng bên trong ConfirmProvider.");
  }
  return context;
}
