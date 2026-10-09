"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  createIssue,
  deleteIssue,
  updateIssue,
  type IssueFormState,
} from "./actions";
import type { IssueRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const ISSUE_STATUSES = ["Chờ xử lý", "Đang xử lý", "Đã xử lý", "Đã hoàn thành"];
const PRIORITIES = ["Thấp", "Trung bình", "Cao", "Khẩn cấp"];
const initialState: IssueFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function IssueForm({
  mode,
  issue,
  rooms,
  tenants,
}: {
  mode: "create" | "edit";
  issue?: IssueRow;
  rooms: { ma_phong: string; ten_hien_thi: string | null }[];
  tenants: { ma_khach: string; ho_ten_khach: string | null }[];
}) {
  const action = mode === "create" ? createIssue : updateIssue;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.formGrid}>
      {mode === "edit" && (
        <input type="hidden" name="maSuCo" value={issue?.ma_su_co ?? ""} />
      )}

      <div className={styles.formField}>
        <label htmlFor={`maPhong-${mode}`}>Phòng *</label>
        <select
          id={`maPhong-${mode}`}
          name="maPhong"
          defaultValue={issue?.ma_phong ?? ""}
          required
        >
          <option value="">-- Chọn phòng --</option>
          {rooms.map((room) => (
            <option key={room.ma_phong} value={room.ma_phong}>
              {room.ma_phong} - {room.ten_hien_thi}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`maKhachBao-${mode}`}>Khách báo</label>
        <select id={`maKhachBao-${mode}`} name="maKhachBao" defaultValue="">
          <option value="">-- Không xác định --</option>
          {tenants.map((tenant) => (
            <option key={tenant.ma_khach} value={tenant.ma_khach}>
              {tenant.ho_ten_khach}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`danhMuc-${mode}`}>Danh mục *</label>
        <input
          id={`danhMuc-${mode}`}
          name="danhMuc"
          defaultValue={issue?.danh_muc ?? ""}
          placeholder="Điện, nước, điều hòa..."
          required
          maxLength={150}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`mucDoUuTien-${mode}`}>Mức độ ưu tiên</label>
        <select
          id={`mucDoUuTien-${mode}`}
          name="mucDoUuTien"
          defaultValue={issue?.muc_do_uu_tien ?? "Trung bình"}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái</label>
        <select
          id={`trangThai-${mode}`}
          name="trangThai"
          defaultValue={issue?.trang_thai ?? "Chờ xử lý"}
        >
          {ISSUE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`chiPhiSuaChua-${mode}`}>Chi phí sửa chữa (đ)</label>
        <input
          id={`chiPhiSuaChua-${mode}`}
          name="chiPhiSuaChua"
          type="number"
          step="1000"
          defaultValue={issue?.chi_phi_sua_chua ?? ""}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayBaoCao-${mode}`}>Ngày báo cáo</label>
        <input
          id={`ngayBaoCao-${mode}`}
          name="ngayBaoCao"
          type="date"
          defaultValue={issue?.ngay_bao_cao?.slice(0, 10) ?? today()}
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhAnh1-${mode}`}>Ảnh 1 (đường dẫn)</label>
        <input id={`hinhAnh1-${mode}`} name="hinhAnh1" maxLength={300} />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhAnh2-${mode}`}>Ảnh 2 (đường dẫn)</label>
        <input id={`hinhAnh2-${mode}`} name="hinhAnh2" maxLength={300} />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`noiDung-${mode}`}>Nội dung sự cố *</label>
        <textarea
          id={`noiDung-${mode}`}
          name="noiDung"
          defaultValue={issue?.noi_dung ?? ""}
          required
          maxLength={1000}
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
            "Tạo phiếu sự cố"
          ) : (
            "Lưu thay đổi"
          )}
        </button>
      </div>
    </form>
  );
}

export function DeleteIssueButton({ maSuCo }: { maSuCo: string }) {
  const [state, formAction, pending] = useActionState(
    deleteIssue,
    initialState,
  );

  return (
    <span className={styles.rowAction}>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`Bạn có chắc muốn xóa phiếu sự cố ${maSuCo}?`))
            event.preventDefault();
        }}
      >
        <input type="hidden" name="maSuCo" value={maSuCo} />
        <button className={styles.dangerSmall} type="submit" disabled={pending}>
          Xóa
        </button>
      </form>
      {state.error && <span className={styles.rowError}>{state.error}</span>}
    </span>
  );
}

export function IssueEditorToggle({
  issue,
  rooms,
  tenants,
}: {
  issue: IssueRow;
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
          <IssueForm
            mode="edit"
            issue={issue}
            rooms={rooms}
            tenants={tenants}
          />
        </div>
      )}
    </>
  );
}
