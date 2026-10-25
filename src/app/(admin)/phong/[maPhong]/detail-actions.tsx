"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { deleteRoom, type RoomFormState } from "../actions";
import { RoomForm, type RoomFormData } from "../room-forms";
import styles from "./room-detail.module.css";

const initialState: RoomFormState = { error: null, success: null };

/**
 * Nút Sửa mở hộp thoại chỉnh sửa toàn màn hình.
 * Đặt trong hộp thoại (không nhúng vào cột ảnh hẹp) để form 3 cột hiển thị đúng bố cục.
 */
export function EditRoomButton({
  room,
  buildings,
  roomTypes,
  editableBuilding,
}: {
  room: RoomFormData;
  buildings: string[];
  roomTypes: { ma_loai_phong: string; ten_loai_phong: string }[];
  editableBuilding: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Khóa cuộn trang và đóng bằng Escape khi hộp thoại đang mở.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={styles.editButton}
        onClick={() => setOpen(true)}
      >
        <Pencil size={14} /> Sửa thông tin
      </button>

      {open && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.modalBackdrop}
            aria-label="Đóng hộp thoại"
            onClick={() => setOpen(false)}
          />
          <div className={styles.modalPanel}>
            <header className={styles.modalHead}>
              <div>
                <h2 className={styles.modalTitle}>
                  Sửa phòng {room.tenHienThi || room.maPhong}
                </h2>
                <p className={styles.modalSub}>
                  Cập nhật thông tin vật lý, giá thuê, nội thất và ảnh của phòng.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </header>

            <div className={styles.modalBody}>
              <RoomForm
                room={room}
                buildings={buildings}
                roomTypes={roomTypes}
                defaultBuilding={room.toaNha}
                editableBuilding={editableBuilding}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Nút Xóa phòng, quay về danh sách sau khi xóa thành công. */
export function DeleteRoomDetailButton({
  maPhong,
  tenPhong,
}: {
  maPhong: string;
  tenPhong: string;
}) {
  const [state, formAction, pending] = useActionState(deleteRoom, initialState);

  return (
    <span className={styles.deleteWrap}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Xóa phòng ${tenPhong}? Thao tác này không thể hoàn tác.`,
            )
          )
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maPhong" value={maPhong} />
        <button
          type="submit"
          className={styles.deleteButton}
          disabled={pending}
        >
          <Trash2 size={14} /> {pending ? "Đang xóa..." : "Xóa phòng"}
        </button>
      </form>
      {state.error && <span className={styles.deleteError}>{state.error}</span>}
    </span>
  );
}
