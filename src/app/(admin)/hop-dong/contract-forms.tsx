"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createContract,
  deleteContract,
  updateContract,
  type ContractFormState,
} from "./actions";
import type { ContractRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const CONTRACT_STATUSES = ["Đang thuê", "Còn hạn", "Đã cọc", "Đã kết thúc"];
const initialState: ContractFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function ContractForm({
  mode,
  contract,
  rooms,
  tenants,
}: {
  mode: "create" | "edit";
  contract?: ContractRow;
  rooms: { ma_phong: string; ten_hien_thi: string | null }[];
  tenants: { ma_khach: string; ho_ten_khach: string | null }[];
}) {
  const action = mode === "create" ? createContract : updateContract;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input
          type="hidden"
          name="maHopDong"
          value={contract?.ma_hop_dong ?? ""}
        />
      )}

      <div className={styles.formField}>
        <label htmlFor={`maPhong-${mode}`}>Phòng *</label>
        <select
          id={`maPhong-${mode}`}
          name="maPhong"
          defaultValue={contract?.ma_phong ?? ""}
          required
        >
          <option value="">-- Chọn phòng --</option>
          {rooms.map((room) => (
            <option key={room.ma_phong} value={room.ma_phong}>
              {room.ten_hien_thi || room.ma_phong} ({room.ma_phong})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`maKhachDaiDien-${mode}`}>Khách đại diện *</label>
        <select
          id={`maKhachDaiDien-${mode}`}
          name="maKhachDaiDien"
          defaultValue=""
          required
        >
          <option value="">-- Chọn khách thuê --</option>
          {tenants.map((tenant) => (
            <option key={tenant.ma_khach} value={tenant.ma_khach}>
              {tenant.ho_ten_khach} ({tenant.ma_khach})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={contract?.trang_thai ?? "Đang thuê"}
        >
          {CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayBd-${mode}`}>Ngày bắt đầu *</label>
        <input
          id={`ngayBd-${mode}`}
          name="ngayBd"
          type="date"
          defaultValue={contract?.ngay_bd?.slice(0, 10) ?? today()}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayKt-${mode}`}>Ngày kết thúc *</label>
        <input
          id={`ngayKt-${mode}`}
          name="ngayKt"
          type="date"
          defaultValue={contract?.ngay_kt?.slice(0, 10) ?? addMonths(6)}
          required
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayKy-${mode}`}>Ngày ký</label>
        <input
          id={`ngayKy-${mode}`}
          name="ngayKy"
          type="date"
          defaultValue={contract?.ngay_bd?.slice(0, 10) ?? today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`giaThueThoaThuan-${mode}`}>
          Giá thuê thỏa thuận (đ)
        </label>
        <input
          id={`giaThueThoaThuan-${mode}`}
          name="giaThueThoaThuan"
          type="number"
          step="1000"
          defaultValue={contract?.gia_thue_thoa_thuan ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tienDatCoc-${mode}`}>Tiền đặt cọc (đ)</label>
        <input
          id={`tienDatCoc-${mode}`}
          name="tienDatCoc"
          type="number"
          step="1000"
          defaultValue={contract?.tien_dat_coc ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chuKyThuTien-${mode}`}>Chu kỳ thu tiền (tháng)</label>
        <input
          id={`chuKyThuTien-${mode}`}
          name="chuKyThuTien"
          type="number"
          min={1}
          defaultValue={contract?.chu_ky_thu_tien ?? 1}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`chuKyKhachThue-${mode}`}>Chu kỳ khách thuê</label>
        <input
          id={`chuKyKhachThue-${mode}`}
          name="chuKyKhachThue"
          maxLength={100}
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
            "Tạo hợp đồng"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteContractButton({
  maHopDong,
  tenPhong,
}: {
  maHopDong: string;
  tenPhong: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteContract,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Bạn có chắc muốn xóa hợp đồng ${maHopDong} của phòng ${tenPhong}?`,
            )
          )
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maHopDong" value={maHopDong} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function ContractEditorToggle({
  contract,
  rooms,
  tenants,
}: {
  contract: ContractRow;
  rooms: { ma_phong: string; ten_hien_thi: string | null }[];
  tenants: { ma_khach: string; ho_ten_khach: string | null }[];
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
          <ContractForm
            mode="edit"
            contract={contract}
            rooms={rooms}
            tenants={tenants}
          />
        </div>
      )}
    </>
  );
}
