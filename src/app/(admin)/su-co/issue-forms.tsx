"use client";

import { useActionState, useState, useTransition } from "react";
import {
  LoaderCircle,
  ChevronDown,
  Check,
  Lock,
} from "lucide-react";
import {
  createIssue,
  deleteIssue,
  updateIssue,
  updateIssueStatus,
  type IssueFormState,
} from "./actions";
import { ALLOWED_NEXT_STATUSES } from "@/lib/issue-constants";
import type { IssueRow } from "@/lib/queries";
import styles from "@/components/business.module.css";

const ISSUE_STATUSES = ["Chờ xử lý", "Đang xử lý", "Đã hoàn thành", "Đã hủy"];
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

  // CHẾ ĐỘ SỬA: Chỉ cho phép cập nhật trạng thái tiến trình (Ràng buộc không được chuyển ngược)
  if (mode === "edit" && issue) {
    const currentStatus = issue.trang_thai ?? "Chờ xử lý";
    const allowedOptions = ALLOWED_NEXT_STATUSES[currentStatus] ?? [currentStatus];
    const isTerminal = currentStatus === "Đã hoàn thành" || currentStatus === "Đã hủy";

    return (
      <form
        action={formAction}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "#eff8fc",
          border: "1px solid #dceff8",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(74, 144, 194, 0.08)",
        }}
      >
        <input type="hidden" name="maSuCo" value={issue.ma_su_co} />

        {/* Khung tóm tắt thông tin sự cố (Read-only) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2ebf2",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
            color: "#425b6b",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              borderBottom: "1px solid #e2ebf2",
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <span style={{ fontWeight: 800, color: "#244e6e", fontSize: 14 }}>
                {issue.ma_su_co}
              </span>
              <span style={{ color: "#627d90", marginLeft: 8 }}>
                Phòng: <strong style={{ color: "#244e6e" }}>{issue.ma_phong}</strong>
              </span>
              <span style={{ color: "#627d90", marginLeft: 10 }}>
                Khách báo: <strong style={{ color: "#244e6e" }}>{issue.ten_khach_bao || "Không xác định"}</strong>
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 11.5,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "#dceff8",
                  color: "#1d5c8a",
                  fontWeight: 700,
                }}
              >
                {issue.danh_muc || "Sự cố"}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background:
                    issue.muc_do_uu_tien === "Khẩn cấp" || issue.muc_do_uu_tien === "Cao"
                      ? "#fde8e8"
                      : "#eff8fc",
                  color:
                    issue.muc_do_uu_tien === "Khẩn cấp" || issue.muc_do_uu_tien === "Cao"
                      ? "#991b1b"
                      : "#627d90",
                  fontWeight: 700,
                }}
              >
                {issue.muc_do_uu_tien || "Bình thường"}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#627d90", fontSize: 12 }}>Mô tả sự cố:</span>
            <div
              style={{
                marginTop: 2,
                fontWeight: 600,
                color: "#244e6e",
                lineHeight: 1.5,
              }}
            >
              {issue.mo_ta || issue.noi_dung || "—"}
            </div>
          </div>

          {issue.hinh_anh && issue.hinh_anh.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e2ebf2" }}>
              <span style={{ color: "#627d90", fontSize: 12, display: "block", marginBottom: 4 }}>
                Ảnh sự cố đính kèm:
              </span>
              <IssueImageGallery images={issue.hinh_anh} />
            </div>
          )}
        </div>

        {/* Khung chuyển đổi trạng thái (Thao tác duy nhất được phép) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #cbdce8",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <label
              htmlFor={`trangThai-${mode}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#244e6e",
                whiteSpace: "nowrap",
              }}
            >
              Cập nhật trạng thái tiến trình *
            </label>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: 999,
                background:
                  currentStatus === "Đã xử lý" || currentStatus === "Đã hoàn thành"
                    ? "#e6f4ea"
                    : currentStatus === "Đang xử lý"
                    ? "#dceff8"
                    : "#f6e6b4",
                color:
                  currentStatus === "Đã xử lý" || currentStatus === "Đã hoàn thành"
                    ? "#166534"
                    : currentStatus === "Đang xử lý"
                    ? "#1d5c8a"
                    : "#854d0e",
              }}
            >
              Hiện tại: {currentStatus}
            </span>
          </div>

          {isTerminal ? (
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#166534",
                background: "#e6f4ea",
                border: "1px solid #b8e2c8",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              ✓ Phiếu sự cố này đã ở trạng thái &quot;{currentStatus}&quot; (kết thúc quy trình). Không thể chuyển đổi trạng thái nữa.
            </div>
          ) : (
            <div>
              <select
                id={`trangThai-${mode}`}
                name="trangThai"
                defaultValue={currentStatus}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 10px",
                  borderRadius: 6,
                  border: "1px solid #76b5d8",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#244e6e",
                  background: "#ffffff",
                  outline: "none",
                }}
              >
                {allowedOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === currentStatus ? `${opt} (Trạng thái hiện tại)` : `➔ Chuyển sang: ${opt}`}
                  </option>
                ))}
              </select>

              <div
                style={{
                  fontSize: 11.5,
                  color: "#627d90",
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                * Ràng buộc quy trình: Chỉ được chuyển tiến (Chờ xử lý ➔ Đang xử lý ➔ Đã hoàn thành), không thể chuyển ngược lại trạng thái trước.
              </div>
            </div>
          )}
        </div>

        {state.error && (
          <p className={`${styles.formMessage} ${styles.formError}`} role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className={`${styles.formMessage} ${styles.formSuccess}`} role="status">
            {state.success}
          </p>
        )}

        {!isTerminal && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={pending}
              style={{ minWidth: 160 }}
            >
              {pending ? (
                <>
                  <LoaderCircle size={15} className={styles.spinner} /> Đang lưu...
                </>
              ) : (
                "Lưu trạng thái mới"
              )}
            </button>
          </div>
        )}
      </form>
    );
  }

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
        <label htmlFor={`hinhAnh1-${mode}`}>Thêm ảnh 1 (URL)</label>
        <input id={`hinhAnh1-${mode}`} name="hinhAnh1" maxLength={500} placeholder="https://..." />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`hinhAnh2-${mode}`}>Thêm ảnh 2 (URL)</label>
        <input id={`hinhAnh2-${mode}`} name="hinhAnh2" maxLength={500} placeholder="https://..." />
      </div>

      {mode === "edit" && issue?.hinh_anh && issue.hinh_anh.length > 0 && (
        <div className={`${styles.formField} ${styles.formFieldWide}`}>
          <label>Hình ảnh hiện có ({issue.hinh_anh.length} ảnh)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {issue.hinh_anh.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Ảnh sự cố ${idx + 1}`}
                style={{
                  width: 54,
                  height: 54,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #cbdce8",
                }}
              />
            ))}
          </div>
          <input
            type="hidden"
            name="existingImages"
            value={JSON.stringify(issue.hinh_anh)}
          />
        </div>
      )}

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor={`noiDung-${mode}`}>Mô tả sự cố *</label>
        <textarea
          id={`noiDung-${mode}`}
          name="noiDung"
          defaultValue={issue?.mo_ta ?? issue?.noi_dung ?? ""}
          placeholder="Mô tả chi tiết sự cố cần sửa chữa..."
          required
          rows={3}
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

const STATUS_WORKFLOW: Record<string, string[]> = ALLOWED_NEXT_STATUSES;

/**
 * Chọn trạng thái trực tiếp trên bảng:
 * - Có dấu mũi tên ngược (ChevronDown ⌄) kế bên chữ trạng thái (ví dụ "Chờ xử lý ⌄")
 * - Bấm vào sẽ mở menu chọn trạng thái tiếp theo hợp lệ
 * - Ràng buộc quy trình: không được chuyển ngược lại trạng thái trước
 */
export function IssueStatusSelect({
  maSuCo,
  currentStatus,
}: {
  maSuCo: string;
  currentStatus: string;
}) {
  const normalizedStatus = (currentStatus || "").trim() || "Chờ xử lý";
  const [status, setStatus] = useState(normalizedStatus);
  const [prevCurrentStatus, setPrevCurrentStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  if (currentStatus !== prevCurrentStatus) {
    setPrevCurrentStatus(currentStatus);
    setStatus(normalizedStatus);
  }

  const isTerminal = status === "Đã hoàn thành" || status === "Đã hủy";
  const nextOptions = STATUS_WORKFLOW[status] ?? [];

  const getColorStyle = (st: string) => {
    if (st === "Đã hoàn thành" || st === "Đã xử lý") {
      return {
        bg: "#e6f4ea",
        color: "#166534",
        border: "#b8e2c8",
      };
    }
    if (st === "Đang xử lý") {
      return {
        bg: "#dceff8",
        color: "#1d5c8a",
        border: "#76b5d8",
      };
    }
    if (st === "Đã hủy") {
      return {
        bg: "#fde8e8",
        color: "#991b1b",
        border: "#f8b4b4",
      };
    }
    // "Chờ xử lý" (mặc định)
    return {
      bg: "#f6e6b4",
      color: "#854d0e",
      border: "#ebd391",
    };
  };

  const colors = getColorStyle(status);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (!newStatus || newStatus === status) return;

    startTransition(async () => {
      const res = await updateIssueStatus(maSuCo, newStatus);
      if (res.error) {
        alert(res.error);
      } else {
        setStatus(newStatus);
      }
    });
  };

  // Trạng thái kết thúc: hiển thị badge tĩnh kèm icon khóa/hoàn tất (không còn mũi tên chuyển tiếp)
  if (isTerminal) {
    return (
      <span
        title="Phiếu sự cố đã hoàn tất, không thể đổi trạng thái."
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 11px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          backgroundColor: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
          whiteSpace: "nowrap",
        }}
      >
        {status}
        {status === "Đã hoàn thành" ? <Check size={12} /> : <Lock size={11} />}
      </span>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <select
        value={status}
        disabled={isPending}
        onChange={handleChange}
        title={`Trạng thái hiện tại: ${status}. Bấm vào mũi tên để chọn trạng thái tiếp theo.`}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 28px 4px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          backgroundColor: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
          cursor: isPending ? "wait" : "pointer",
          outline: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          transition: "all 0.15s ease",
        }}
      >
        <option value={status} disabled>
          {status} (Hiện tại)
        </option>
        {nextOptions.map((opt) => (
          <option
            key={opt}
            value={opt}
            style={{
              backgroundColor: "#ffffff",
              color: "#244e6e",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            ➔ Chuyển sang: {opt}
          </option>
        ))}
      </select>

      <span
        style={{
          position: "absolute",
          right: 9,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.color,
          opacity: 0.9,
        }}
      >
        {isPending ? (
          <LoaderCircle size={13} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <ChevronDown size={14} />
        )}
      </span>
    </div>
  );
}

/**
 * Hiển thị cột hình ảnh đính kèm của sự cố:
 * - Ảnh thumbnail vuông gọn gàng
 * - Bấm vào mở Lightbox phóng to ảnh chất lượng cao
 */
export function IssueImageGallery({ images }: { images?: string[] | null }) {
  const [selectedImg, setSelectedImg] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return <span style={{ color: "#9cb0c0", fontSize: 13 }}>—</span>;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {images.map((img, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedImg(img)}
            title="Bấm để xem ảnh phóng to"
            style={{
              padding: 0,
              border: "1px solid #cbdce8",
              borderRadius: 6,
              overflow: "hidden",
              cursor: "pointer",
              background: "#eff8fc",
              display: "inline-block",
              lineHeight: 0,
              transition: "transform 0.15s, border-color 0.15s",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={`Ảnh ${idx + 1}`}
              style={{
                width: 42,
                height: 42,
                objectFit: "cover",
                display: "block",
              }}
            />
          </button>
        ))}
        {images.length > 1 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#4a90c2",
              background: "#dceff8",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {images.length} ảnh
          </span>
        )}
      </div>

      {selectedImg && (
        <div
          onClick={() => setSelectedImg(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(36, 78, 110, 0.85)",
            backdropFilter: "blur(3px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "default",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImg}
              alt="Hình ảnh sự cố phóng to"
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
                backgroundColor: "#000",
              }}
            />
            <button
              type="button"
              onClick={() => setSelectedImg(null)}
              style={{
                marginTop: 12,
                padding: "8px 20px",
                backgroundColor: "#ffffff",
                color: "#244e6e",
                border: "1px solid #cbdce8",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              ✕ Đóng xem ảnh
            </button>
          </div>
        </div>
      )}
    </>
  );
}
