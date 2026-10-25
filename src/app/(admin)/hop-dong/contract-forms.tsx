"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  LoaderCircle,
  Copy,
  Check,
  ShieldCheck,
  UserPlus,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  createContract,
  deleteContract,
  updateContract,
  addContractOccupant,
  removeContractOccupant,
  provisionOccupantAccount,
  type ContractFormState,
  type ProvisionAccountState,
} from "./actions";
import type { ContractRow, RoomOption, TenantOption } from "@/lib/queries";
import { HandoverItemsEditor } from "@/components/handover-items-editor";
import styles from "@/components/business.module.css";

const CONTRACT_STATUSES = ["Còn hạn", "Đã đặt cọc", "Đã kết thúc"];
const initialState: ContractFormState = { error: null, success: null };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function dayAfter(dateStr?: string | null) {
  if (!dateStr) return undefined;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function ContractForm({
  mode,
  contract,
  rooms,
  tenants,
}: {
  mode: "create" | "edit";
  contract?: ContractRow;
  rooms: RoomOption[];
  tenants: TenantOption[] | { ma_khach: string; ho_ten_khach: string | null; so_dt?: string | null; cccd?: string | null }[];
}) {
  const action = mode === "create" ? createContract : updateContract;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [selectedRoom, setSelectedRoom] = useState<string>(contract?.ma_phong ?? "");
  const [giaThue, setGiaThue] = useState<string>(contract?.gia_thue_thoa_thuan ?? "");
  const [tienCoc, setTienCoc] = useState<string>(contract?.tien_dat_coc ?? "");
  const [copied, setCopied] = useState(false);
  const [tenantMode, setTenantMode] = useState<"new" | "existing">("new");

  // Ràng buộc liên kết giữa các trường ngày tháng
  const [ngayKyVal, setNgayKyVal] = useState<string>(
    contract?.ngay_ky?.slice(0, 10) ?? today(),
  );
  const [ngayBdVal, setNgayBdVal] = useState<string>(
    contract?.ngay_bd?.slice(0, 10) ?? today(),
  );
  const [ngayKtVal, setNgayKtVal] = useState<string>(
    contract?.ngay_kt?.slice(0, 10) ?? addMonths(6),
  );

  const handleNgayBdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextBd = e.target.value;
    setNgayBdVal(nextBd);
    // Nếu ngày kết thúc nhỏ hơn hoặc bằng ngày bắt đầu, tự động cộng thêm 6 tháng
    if (!ngayKtVal || ngayKtVal <= nextBd) {
      const d = new Date(nextBd);
      d.setMonth(d.getMonth() + 6);
      setNgayKtVal(d.toISOString().slice(0, 10));
    }
    // Ngày ký không thể sau ngày bắt đầu vào ở
    if (ngayKyVal && ngayKyVal > nextBd) {
      setNgayKyVal(nextBd);
    }
  };

  const handleRoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roomId = e.target.value;
    setSelectedRoom(roomId);
    const room = rooms.find((r) => r.ma_phong === roomId);
    if (room) {
      if (room.gia_thue) setGiaThue(room.gia_thue);
      if (room.tien_dat_coc) setTienCoc(room.tien_dat_coc);
    }
  };

  const handleCopy = () => {
    if (!state.tempPassword || !state.username) return;
    const nameStr = state.tenantName ? ` ${state.tenantName}` : "";
    const msg = `[Nhà trọ Kiều Giang] Xin chào${nameStr}, hợp đồng thuê phòng của bạn đã được kích hoạt. Tài khoản ứng dụng cư dân: SĐT: ${state.username} | Mật khẩu mặc định: ${state.tempPassword}. Vui lòng đăng nhập và xác nhận nội thất nhận phòng.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Lọc phòng: Không được chọn phòng có trạng thái 'Đã đặt cọc' hoặc 'Đang thuê'
  const availableRooms = rooms.filter((room) => {
    if (mode === "edit") {
      return (
        room.ma_phong === contract?.ma_phong ||
        (room.trang_thai !== "Đang thuê" &&
          room.trang_thai !== "Đã đặt cọc" &&
          room.trang_thai !== "Đã cọc")
      );
    }
    return (
      room.trang_thai !== "Đang thuê" &&
      room.trang_thai !== "Đã đặt cọc" &&
      room.trang_thai !== "Đã cọc"
    );
  });

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
          value={selectedRoom}
          onChange={handleRoomChange}
          required
        >
          <option value="">
            {availableRooms.length === 0
              ? "-- Không còn phòng trống (tất cả đã cọc / đang thuê) --"
              : `-- Chọn phòng sẵn sàng (${availableRooms.length} phòng) --`}
          </option>
          {availableRooms.map((room) => (
            <option key={room.ma_phong} value={room.ma_phong}>
              {room.ten_hien_thi || room.ma_phong} ({room.ma_phong})
              {room.trang_thai && room.trang_thai !== "Trống" ? ` - [${room.trang_thai}]` : ""}
            </option>
          ))}
        </select>
        {mode === "create" && availableRooms.length === 0 && (
          <span className={styles.fieldHint} style={{ color: "#dc2626" }}>
            Tất cả các phòng thuộc cơ sở bạn quản lý hiện đều đang có khách thuê hoặc đang giữ chỗ.
          </span>
        )}
      </div>

      {mode === "create" ? (
        <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <label style={{ fontWeight: 600, margin: 0 }}>Khách đại diện (Bên B) *</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setTenantMode("new")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: tenantMode === "new" ? "2px solid #059669" : "1px solid #cbd5e1",
                  background: tenantMode === "new" ? "#ecfdf5" : "#fff",
                  color: tenantMode === "new" ? "#065f46" : "#475569",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ✨ Nhập khách mới
              </button>
              <button
                type="button"
                onClick={() => setTenantMode("existing")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: tenantMode === "existing" ? "2px solid #059669" : "1px solid #cbd5e1",
                  background: tenantMode === "existing" ? "#ecfdf5" : "#fff",
                  color: tenantMode === "existing" ? "#065f46" : "#475569",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                👥 Chọn khách cũ ({tenants.length})
              </button>
            </div>
          </div>
          <input type="hidden" name="tenantMode" value={tenantMode} />

          {tenantMode === "new" ? (
            <div
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Họ và tên khách *
                </label>
                <input
                  type="text"
                  name="newHoTen"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required={tenantMode === "new"}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Số điện thoại (Tên đăng nhập App) *
                </label>
                <input
                  type="tel"
                  name="newSoDt"
                  placeholder="0912345678"
                  required={tenantMode === "new"}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Số CCCD / CMND *
                </label>
                <input
                  type="text"
                  name="newCccd"
                  placeholder="079201012345"
                  required={tenantMode === "new"}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  name="newDiaChi"
                  placeholder="Quận/Huyện, Tỉnh/TP"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#059669", display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={14} /> Hệ thống sẽ tự động tạo hồ sơ khách thuê và cấp tài khoản Mobile App với mật khẩu ngẫu nhiên 6 số.
              </div>
            </div>
          ) : (
            <select
              id={`maKhachDaiDien-${mode}`}
              name="maKhachDaiDien"
              defaultValue=""
              required={tenantMode === "existing"}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              <option value="">-- Chọn khách thuê đại diện --</option>
              {tenants.map((tenant) => (
                <option key={tenant.ma_khach} value={tenant.ma_khach}>
                  {tenant.ho_ten_khach} {tenant.so_dt ? `(${tenant.so_dt})` : ""} - {tenant.ma_khach}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className={styles.formField}>
          <label htmlFor={`maKhachDaiDien-${mode}`}>Khách đại diện (Bên B) *</label>
          <select
            id={`maKhachDaiDien-${mode}`}
            name="maKhachDaiDien"
            defaultValue={contract?.ma_khach_dai_dien ?? ""}
            required
          >
            <option value="">-- Chọn khách thuê đại diện --</option>
            {tenants.map((tenant) => (
              <option key={tenant.ma_khach} value={tenant.ma_khach}>
                {tenant.ho_ten_khach} {tenant.so_dt ? `(${tenant.so_dt})` : ""} - {tenant.ma_khach}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.formField}>
        <label htmlFor={`trangThai-${mode}`}>Trạng thái hợp đồng</label>
        {mode === "create" ? (
          <>
            <input type="hidden" name="trangThai" value="Còn hạn" />
            <input
              id={`trangThai-${mode}`}
              value="Còn hạn"
              readOnly
              style={{ background: "#f8fafc", color: "#059669", fontWeight: 700 }}
            />
            <span className={styles.fieldHint}>
              Hợp đồng mới tạo luôn ở trạng thái Còn hạn (mặc định)
            </span>
          </>
        ) : (
          <select
            id={`trangThai-${mode}`}
            name="trangThai"
            defaultValue={contract?.trang_thai ?? "Còn hạn"}
          >
            {CONTRACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayKy-${mode}`}>Ngày ký hợp đồng</label>
        <input
          id={`ngayKy-${mode}`}
          name="ngayKy"
          type="date"
          value={ngayKyVal}
          max={ngayBdVal || undefined}
          onChange={(e) => setNgayKyVal(e.target.value)}
        />
        <span className={styles.fieldHint}>
          Ký trước hoặc vào ngày bắt đầu vào ở ({ngayBdVal || "—"})
        </span>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayBd-${mode}`}>Ngày bắt đầu vào ở *</label>
        <input
          id={`ngayBd-${mode}`}
          name="ngayBd"
          type="date"
          value={ngayBdVal}
          min={ngayKyVal || undefined}
          onChange={handleNgayBdChange}
          required
        />
        <span className={styles.fieldHint}>
          Thời điểm bắt đầu tính tiền thuê và bàn giao phòng
        </span>
      </div>

      <div className={styles.formField}>
        <label htmlFor={`ngayKt-${mode}`}>Ngày kết thúc hợp đồng *</label>
        <input
          id={`ngayKt-${mode}`}
          name="ngayKt"
          type="date"
          value={ngayKtVal}
          min={dayAfter(ngayBdVal)}
          onChange={(e) => setNgayKtVal(e.target.value)}
          required
        />
        <span className={styles.fieldHint}>
          Phải sau ngày bắt đầu vào ở (thời hạn hợp đồng thuê)
        </span>
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
          value={giaThue}
          onChange={(e) => setGiaThue(e.target.value)}
          placeholder="3.500.000"
        />
      </div>

      <div className={styles.formField}>
        <label htmlFor={`tienDatCoc-${mode}`}>Tiền đặt cọc (đ)</label>
        <input
          id={`tienDatCoc-${mode}`}
          name="tienDatCoc"
          type="number"
          step="1000"
          value={tienCoc}
          onChange={(e) => setTienCoc(e.target.value)}
          placeholder="3.500.000"
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

      {mode === "create" && (
        <div style={{ gridColumn: "1 / -1" }}>
          <HandoverItemsEditor
            furnitureList={rooms.find((r) => r.ma_phong === selectedRoom)?.noi_that_san_co}
            title={selectedRoom ? `Biên bản bàn giao tài sản phòng ${selectedRoom}` : "Biên bản bàn giao tài sản lúc nhận phòng"}
            hint={selectedRoom ? "Hệ thống tự động tải nội thất sẵn có của phòng này. Quản lý có thể kiểm tra thực tế, chỉnh sửa số lượng, tình trạng, hoặc bấm '+ Thêm món' để ghi nhận đồ khách thuê thêm trước khi tạo hợp đồng." : "Chọn phòng ở trên để hệ thống nạp danh sách nội thất bàn giao tương ứng."}
          />
        </div>
      )}

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

      {/* Hiển thị tài khoản Mobile App cấp tự động khi tạo hợp đồng mới */}
      {state.tempPassword && state.username && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "linear-gradient(135deg, #eff6ff, #e0e7ff)",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: 16,
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              color: "#1e40af",
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            <ShieldCheck size={18} /> Đã kích hoạt tài khoản Mobile App cho khách đại diện:
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>
              Tên đăng nhập (SĐT):{" "}
              <strong style={{ fontFamily: "monospace", fontSize: 14 }}>
                {state.username}
              </strong>
            </span>
            <span>
              Mật khẩu mặc định:{" "}
              <strong
                style={{
                  fontFamily: "monospace",
                  color: "#dc2626",
                  fontSize: 15,
                  letterSpacing: 2,
                }}
              >
                {state.tempPassword}
              </strong>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Đã sao chép!" : "Sao chép SMS/Zalo gửi khách"}
            </button>
            {state.maHopDong && (
              <Link
                href={`/hop-dong/${state.maHopDong}`}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4338ca",
                  textDecoration: "underline",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Xem chi tiết hợp đồng <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
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
            "Lưu & Kích hoạt hợp đồng"
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
  rooms: RoomOption[] | { ma_phong: string; ten_hien_thi: string | null }[];
  tenants: TenantOption[] | { ma_khach: string; ho_ten_khach: string | null }[];
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
            rooms={rooms as RoomOption[]}
            tenants={tenants as TenantOption[]}
          />
        </div>
      )}
    </>
  );
}

/** Form thêm người ở cùng phòng trong trang chi tiết hợp đồng */
export function AddOccupantForm({
  maHopDong,
  tenants,
}: {
  maHopDong: string;
  tenants: TenantOption[] | { ma_khach: string; ho_ten_khach: string | null; so_dt?: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("new");
  const [maKhach, setMaKhach] = useState("");
  const [newHoTen, setNewHoTen] = useState("");
  const [newSoDt, setNewSoDt] = useState("");
  const [ngayVaoO, setNgayVaoO] = useState(today());
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === "existing" && !maKhach) return;
    if (addMode === "new" && (!newHoTen || !newSoDt)) return;

    setIsPending(true);
    setMessage(null);
    const payload =
      addMode === "new"
        ? { newHoTen, newSoDt, ngayVaoO }
        : { maKhach, ngayVaoO };

    const res = await addContractOccupant(maHopDong, payload);
    setIsPending(false);

    if (res.error) {
      setMessage(res.error);
    } else {
      setMessage("Đã thêm người ở cùng thành công.");
      setOpen(false);
      setMaKhach("");
      setNewHoTen("");
      setNewSoDt("");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "#4f46e5",
          color: "#ffffff",
          border: "none",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <UserPlus size={14} /> Thêm người ở cùng
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: 14,
            marginTop: 10,
            maxWidth: 520,
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setAddMode("new")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: addMode === "new" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                background: addMode === "new" ? "#eef2ff" : "#fff",
                color: addMode === "new" ? "#4338ca" : "#475569",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✨ Nhập bạn mới (Họ tên + SĐT)
            </button>
            <button
              type="button"
              onClick={() => setAddMode("existing")}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: addMode === "existing" ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                background: addMode === "existing" ? "#eef2ff" : "#fff",
                color: addMode === "existing" ? "#4338ca" : "#475569",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              👥 Chọn từ danh sách khách ({tenants.length})
            </button>
          </div>

          {addMode === "new" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Họ và tên bạn ở cùng *
                </label>
                <input
                  type="text"
                  value={newHoTen}
                  onChange={(e) => setNewHoTen(e.target.value)}
                  placeholder="Ví dụ: Lê Thị Mai"
                  required
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    padding: "0 8px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Số điện thoại *
                </label>
                <input
                  type="tel"
                  value={newSoDt}
                  onChange={(e) => setNewSoDt(e.target.value)}
                  placeholder="0987654321"
                  required
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    padding: "0 8px",
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                Chọn khách ở cùng *
              </label>
              <select
                value={maKhach}
                onChange={(e) => setMaKhach(e.target.value)}
                required
                style={{
                  width: "100%",
                  height: 36,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  padding: "0 8px",
                }}
              >
                <option value="">-- Chọn khách thuê --</option>
                {tenants.map((t) => (
                  <option key={t.ma_khach} value={t.ma_khach}>
                    {t.ho_ten_khach} {t.so_dt ? `(${t.so_dt})` : ""} - {t.ma_khach}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
              Ngày vào ở
            </label>
            <input
              type="date"
              value={ngayVaoO}
              onChange={(e) => setNgayVaoO(e.target.value)}
              required
              style={{
                width: "100%",
                height: 36,
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                padding: "0 8px",
              }}
            />
          </div>

          {message && (
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#dc2626" }}>
              {message}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isPending ? "Đang lưu..." : "Xác nhận thêm"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Nút cấp tài khoản App Cư Dân cho người ở cùng và tự động gửi thông báo cho chủ phòng */
export function ProvisionOccupantButton({
  maHopDong,
  maKhach,
  hoTen,
  soDt,
}: {
  maHopDong: string;
  maKhach: string;
  hoTen: string;
  soDt: string | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<ProvisionAccountState | null>(null);
  const [copied, setCopied] = useState(false);

  const handleProvision = async () => {
    if (
      !window.confirm(
        `Xác nhận cấp tài khoản cho người ở cùng ${hoTen} (${soDt || "Chưa có SĐT"})?`,
      )
    ) {
      return;
    }
    setIsPending(true);
    setResult(null);
    const res = await provisionOccupantAccount(maHopDong, maKhach);
    setIsPending(false);
    setResult(res);
  };

  const handleCopy = () => {
    if (!result?.username || !result?.tempPassword) return;
    const msg = `[Nhà trọ Kiều Giang] Xin chào ${hoTen}, tài khoản của bạn đã được kích hoạt. Tên đăng nhập (SĐT): ${result.username} | Mật khẩu mặc định: ${result.tempPassword}.`;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleProvision}
        disabled={isPending}
        style={{
          background: "#ecfdf5",
          color: "#065f46",
          border: "1px solid #a7f3d0",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
        title="Cấp tài khoản cho khách"
      >
        {isPending ? (
          <LoaderCircle size={13} className={styles.spinner} />
        ) : (
          <Sparkles size={13} />
        )}
        {isPending ? "Đang cấp..." : "Cấp tài khoản"}
      </button>

      {result && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setResult(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 14,
              maxWidth: 480,
              width: "100%",
              padding: 20,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
              border: "1px solid #cbd5e1",
            }}
          >
            {result.error ? (
              <div>
                <h3 style={{ color: "#dc2626", margin: "0 0 10px", fontSize: 16 }}>
                  Không thể cấp tài khoản
                </h3>
                <p style={{ fontSize: 13, color: "#475569" }}>{result.error}</p>
                <div style={{ textAlign: "right", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                    color: "#065f46",
                  }}
                >
                  <div style={{ background: "#d1fae5", padding: 8, borderRadius: 10 }}>
                    <Check size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    Cấp tài khoản thành công!
                  </h3>
                </div>

                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                  Đã tạo tài khoản cho <strong>{hoTen}</strong> và lưu thông báo đến chủ phòng (để ứng dụng cư dân hiển thị). Quản lý cũng có thể sao chép thông tin đăng nhập bên dưới để gửi trực tiếp cho khách thuê.
                </p>

                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    margin: "12px 0",
                    fontSize: 13,
                  }}
                >
                  <div>
                    Tên đăng nhập (SĐT): <strong>{result.username}</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Mật khẩu mặc định:{" "}
                    <strong style={{ color: "#059669" }}>{result.tempPassword}</strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: "#4f46e5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "7px 12px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Đã sao chép!" : "Sao chép gửi khách"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Nút xóa người ở cùng */
export function RemoveOccupantButton({
  maHopDong,
  maKhach,
  hoTen,
}: {
  maHopDong: string;
  maKhach: string;
  hoTen: string;
}) {
  const [isPending, setIsPending] = useState(false);

  const handleRemove = async () => {
    if (!window.confirm(`Bạn có chắc muốn đánh dấu ${hoTen} đã rời khỏi phòng này?`)) {
      return;
    }
    setIsPending(true);
    await removeContractOccupant(maHopDong, maKhach);
    setIsPending(false);
  };

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      style={{
        background: "none",
        border: "none",
        color: "#ef4444",
        cursor: "pointer",
        padding: 4,
      }}
      title="Đánh dấu đã rời đi"
    >
      <Trash2 size={14} />
    </button>
  );
}
