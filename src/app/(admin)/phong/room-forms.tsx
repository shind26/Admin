"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createRoom,
  deleteRoom,
  updateRoom,
  type RoomFormState,
} from "./actions";
import styles from "@/components/business.module.css";

const ROOM_STATUSES = ["Trống", "Đang thuê", "Sửa chữa"];
const initialState: RoomFormState = { error: null, success: null };

export type RoomFormData = {
  maPhong: string;
  tenHienThi: string;
  tang: number | null;
  dienTich: number | null;
  giaThue: string | null;
  trangThai: string;
  toaNha: string;
  maLoaiPhong: string;
  moTaNgan: string;
  tienDatCoc: string | null;
};

export function RoomForm({
  mode,
  room,
  buildings,
  roomTypes,
  defaultBuilding,
}: {
  mode: "create" | "edit";
  room?: RoomFormData;
  buildings: string[];
  roomTypes: { ma_loai_phong: string; ten_loai_phong: string }[];
  defaultBuilding: string;
}) {
  const action = mode === "create" ? createRoom : updateRoom;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      <div className={styles.formField}>
        <label htmlFor="maPhong">Mã phòng *</label>
        <input
          id="maPhong"
          name="maPhong"
          defaultValue={room?.maPhong ?? ""}
          readOnly={mode === "edit"}
          required
          maxLength={50}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="tenHienThi">Tên hiển thị</label>
        <input
          id="tenHienThi"
          name="tenHienThi"
          defaultValue={room?.tenHienThi ?? ""}
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="tang">Tầng</label>
        <input
          id="tang"
          name="tang"
          type="number"
          defaultValue={room?.tang ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="dienTich">Diện tích (m²)</label>
        <input
          id="dienTich"
          name="dienTich"
          type="number"
          step="0.1"
          defaultValue={room?.dienTich ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="giaThue">Giá thuê (đ)</label>
        <input
          id="giaThue"
          name="giaThue"
          type="number"
          step="1000"
          defaultValue={room?.giaThue ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="tienDatCoc">Tiền đặt cọc (đ)</label>
        <input
          id="tienDatCoc"
          name="tienDatCoc"
          type="number"
          step="1000"
          defaultValue={room?.tienDatCoc ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor="trangThai">Trạng thái *</label>
        <select
          id="trangThai"
          name="trangThai"
          defaultValue={room?.trangThai ?? "Trống"}
        >
          {ROOM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor="toaNha">Cơ sở</label>
        <input
          id="toaNha"
          name="toaNha"
          list="toaNhaOptions"
          defaultValue={room?.toaNha ?? defaultBuilding}
          maxLength={100}
        />
        <datalist id="toaNhaOptions">
          {buildings.map((building) => (
            <option key={building} value={building} />
          ))}
        </datalist>
      </div>

      <div className={styles.formField}>
        <label htmlFor="maLoaiPhong">Loại phòng</label>
        <select
          id="maLoaiPhong"
          name="maLoaiPhong"
          defaultValue={room?.maLoaiPhong ?? ""}
        >
          <option value="">-- Chưa phân loại --</option>
          {roomTypes.map((type) => (
            <option key={type.ma_loai_phong} value={type.ma_loai_phong}>
              {type.ten_loai_phong}
            </option>
          ))}
        </select>
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor="moTaNgan">Mô tả ngắn</label>
        <input
          id="moTaNgan"
          name="moTaNgan"
          defaultValue={room?.moTaNgan ?? ""}
          maxLength={300}
        />
      </div>

      {state.error && (
        <p className={`${styles.formMessage} ${styles.formError}`} role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          className={`${styles.formMessage} ${styles.formSuccess}`}
          role="status"
        >
          {state.success}
        </p>
      )}

      <div className={styles.formActions}>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle size={15} className={styles.spinner} /> Đang lưu...
            </>
          ) : mode === "create" ? (
            "Thêm phòng"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteRoomButton({
  maPhong,
  tenPhong,
}: {
  maPhong: string;
  tenPhong: string;
}) {
  const [state, formAction, pending] = useActionState(deleteRoom, initialState);

  return (
    <form
      action={formAction}
      className={styles.rowAction}
      onSubmit={(event) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phòng ${tenPhong}?`))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="maPhong" value={maPhong} />
      <button className={styles.dangerSmall} type="submit" disabled={pending}>
        Xóa
      </button>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </form>
  );
}

export function RoomEditorToggle({
  room,
  buildings,
  roomTypes,
  defaultBuilding,
}: {
  room: RoomFormData;
  buildings: string[];
  roomTypes: { ma_loai_phong: string; ten_loai_phong: string }[];
  defaultBuilding: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={styles.linkButton}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Đóng" : "Sửa"}
      </button>
      {open && (
        <div className={styles.inlineEditor}>
          <RoomForm
            mode="edit"
            room={room}
            buildings={buildings}
            roomTypes={roomTypes}
            defaultBuilding={defaultBuilding}
          />
        </div>
      )}
    </>
  );
}
