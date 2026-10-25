"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import {
  createRoom,
  deleteRoom,
  updateRoom,
  type RoomFormState,
} from "./actions";
import { RoomPhotoUpload } from "./room-photo-upload";
import styles from "@/components/business.module.css";

const ROOM_STATUSES = ["Trống", "Đang thuê", "Đang bảo trì", "Đã đặt cọc"];
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
  /** Mỗi dòng một món nội thất (cột text[] noi_that_san_co). */
  noiThat: string;
  /** Đường dẫn ảnh công khai trên Supabase Storage. */
  hinhAnh: string;
  /** Chỉ số điện ban đầu / hiện tại của phòng (kWh). */
  chiSoDien?: string | number | null;
  /** Chỉ số nước ban đầu / hiện tại của phòng (m³). */
  chiSoNuoc?: string | number | null;
};

/**
 * Form dùng để TẠO MỚI (chỉ dành cho Admin) hoặc SỬA phòng đã tồn tại.
 */
export function RoomForm({
  mode = "edit",
  room,
  buildings,
  roomTypes,
  defaultBuilding,
  editableBuilding,
}: {
  mode?: "create" | "edit";
  room?: Partial<RoomFormData>;
  buildings: string[];
  roomTypes: {
    ma_loai_phong: string;
    ten_loai_phong: string;
    don_gia_co_ban?: string;
    tien_ich?: string[] | null;
  }[];
  defaultBuilding: string;
  /** Admin được chọn tòa; quản lý tòa bị khóa theo tòa được gán. */
  editableBuilding: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = mode === "create" ? createRoom : updateRoom;
  const [state, formAction, pending] = useActionState(action, initialState);

  const defaultRoomType =
    room?.maLoaiPhong ||
    (mode === "create" ? (roomTypes[0]?.ma_loai_phong ?? "") : "");
  const defaultBuildingVal = room?.toaNha || defaultBuilding;

  const [selectedType, setSelectedType] = useState(defaultRoomType);
  const [noiThatVal, setNoiThatVal] = useState(room?.noiThat ?? "");

  const [prevSuccess, setPrevSuccess] = useState(state.success);
  if (state.success && state.success !== prevSuccess) {
    setPrevSuccess(state.success);
    if (mode === "create") {
      formRef.current?.reset();
      setNoiThatVal("");
    }
  }

  const selectedTypeObj = roomTypes.find((t) => t.ma_loai_phong === selectedType);

  return (
    <form ref={formRef} action={formAction} className={styles.formGrid}>
      <div className={styles.formSection}>Thông tin định danh</div>

      <div className={styles.formField}>
        <label htmlFor={`maPhong-${mode}`}>Mã phòng *</label>
        <input
          id="maPhong"
          name="maPhong"
          defaultValue={room?.maPhong ?? ""}
          readOnly={mode === "edit"}
          required
          maxLength={50}
          placeholder={mode === "create" ? "VD: P101, A202" : undefined}
          autoFocus={mode === "create"}
        />
        <span className={styles.fieldHint}>
          {mode === "create"
            ? "Mã định danh duy nhất (viết hoa tự động)"
            : "Không thể đổi mã phòng"}
        </span>
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
        <label htmlFor="toaNha">Cơ sở / Tòa nhà *</label>
        {mode === "edit" ? (
          <>
            <input
              id="toaNha"
              name="toaNha"
              value={defaultBuildingVal}
              readOnly
              style={{ background: "#f8fafc", color: "#64748b" }}
            />
            <span className={styles.fieldHint}>Không thể đổi cơ sở / tòa nhà khi sửa phòng</span>
          </>
        ) : editableBuilding ? (
          <select
            id="toaNha"
            name="toaNha"
            defaultValue={defaultBuildingVal}
            required
          >
            <option value="">-- Chọn tòa nhà --</option>
            {buildings.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="toaNha"
            name="toaNha"
            value={defaultBuildingVal}
            readOnly
          />
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="tang">Tầng *</label>
        <input
          id="tang"
          name="tang"
          type="number"
          min={1}
          defaultValue={room?.tang ?? 1}
          readOnly={mode === "edit"}
          style={mode === "edit" ? { background: "#f8fafc", color: "#64748b" } : undefined}
          required
        />
        {mode === "edit" && (
          <span className={styles.fieldHint}>Không thể đổi tầng khi sửa phòng</span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="maLoaiPhong">Loại phòng *</label>
        {mode === "edit" ? (
          <>
            <input type="hidden" name="maLoaiPhong" value={selectedType} />
            <input
              id="maLoaiPhong"
              value={selectedTypeObj?.ten_loai_phong ?? selectedType}
              readOnly
              style={{ background: "#f8fafc", color: "#64748b" }}
            />
            <span className={styles.fieldHint}>Không thể đổi loại phòng khi sửa phòng</span>
          </>
        ) : (
          <select
            id="maLoaiPhong"
            name="maLoaiPhong"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
            }}
            required
          >
            <option value="">-- Chọn loại phòng --</option>
            {roomTypes.map((type) => (
              <option key={type.ma_loai_phong} value={type.ma_loai_phong}>
                {type.ten_loai_phong}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="trangThai">Trạng thái *</label>
        {mode === "create" ? (
          <>
            <input
              id="trangThai"
              name="trangThai"
              value="Trống"
              readOnly
            />
            <span className={styles.fieldHint}>
              Phòng mới tạo luôn mặc định ở trạng thái Trống
            </span>
          </>
        ) : (
          <>
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
            <span className={styles.fieldHint}>
              Trạng thái thật do hợp đồng quyết định
            </span>
          </>
        )}
      </div>

      <div className={styles.formSection}>Giá &amp; diện tích</div>

      <div className={styles.formField}>
        <label htmlFor="dienTich">Diện tích (m²) *</label>
        <input
          id="dienTich"
          name="dienTich"
          type="number"
          step="0.1"
          min={1}
          placeholder="VD: 25"
          defaultValue={room?.dienTich ?? ""}
          readOnly={mode === "edit"}
          style={mode === "edit" ? { background: "#f8fafc", color: "#64748b" } : undefined}
          required
        />
        {mode === "edit" && (
          <span className={styles.fieldHint}>Không thể đổi diện tích khi sửa phòng</span>
        )}
      </div>

      <div className={styles.formField}>
        <label htmlFor="giaThue">Giá thuê niêm yết (đ) *</label>
        <input
          id="giaThue"
          name="giaThue"
          type="number"
          step="1000"
          min={0}
          placeholder="VD: 3500000"
          defaultValue={room?.giaThue ?? ""}
          required
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

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <label htmlFor="moTaNgan">Mô tả ngắn</label>
        <input
          id="moTaNgan"
          name="moTaNgan"
          defaultValue={room?.moTaNgan ?? ""}
          maxLength={300}
        />
      </div>

      <div className={styles.formSection}>Chỉ số công tơ điện nước ban đầu / hiện tại</div>

      <div className={styles.formField}>
        <label htmlFor="chiSoDien">Chỉ số điện (kWh) *</label>
        <input
          id="chiSoDien"
          name="chiSoDien"
          type="number"
          step="0.01"
          min={0}
          placeholder="0.00"
          defaultValue={room?.chiSoDien ?? 0}
          required
        />
        <span className={styles.fieldHint}>
          {mode === "create"
            ? "Chỉ số công tơ điện ban đầu khi đưa phòng vào hoạt động"
            : "Chỉ số điện hiện tại (tự cập nhật khi BQL duyệt số hoặc thay công tơ)"}
        </span>
      </div>

      <div className={styles.formField}>
        <label htmlFor="chiSoNuoc">Chỉ số nước (m³) *</label>
        <input
          id="chiSoNuoc"
          name="chiSoNuoc"
          type="number"
          step="0.01"
          min={0}
          placeholder="0.00"
          defaultValue={room?.chiSoNuoc ?? 0}
          required
        />
        <span className={styles.fieldHint}>
          {mode === "create"
            ? "Chỉ số đồng hồ nước ban đầu khi đưa phòng vào hoạt động"
            : "Chỉ số nước hiện tại (tự cập nhật khi BQL duyệt số hoặc thay đồng hồ)"}
        </span>
      </div>

      <div className={styles.formSection}>Nội thất &amp; Tiện ích</div>

      <div className={styles.formField}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <label htmlFor="noiThat" style={{ margin: 0 }}>
            Nội thất sẵn có (mỗi dòng một món)
          </label>
        </div>
        <textarea
          id="noiThat"
          name="noiThat"
          rows={4}
          value={noiThatVal}
          onChange={(e) => setNoiThatVal(e.target.value)}
          placeholder={"Giường ngủ\nTủ quần áo\nMáy lạnh\nTủ lạnh"}
          maxLength={2000}
        />
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 4 }}>
            Gợi ý thêm nhanh:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {[
              "Giường",
              "Nệm",
              "Tủ quần áo",
              "Máy lạnh",
              "Tủ lạnh",
              "Bàn làm việc",
              "Ghế",
              "Bếp từ",
              "Máy giặt",
              "Bình nóng lạnh",
              "Rèm cửa",
            ].map((item) => {
              const hasItem = noiThatVal
                .split("\n")
                .map((s) => s.trim().toLowerCase())
                .includes(item.toLowerCase());
              return (
                <button
                  key={item}
                  type="button"
                  disabled={hasItem}
                  onClick={() => {
                    const lines = noiThatVal.split("\n").map((s) => s.trim()).filter(Boolean);
                    if (!lines.map((l) => l.toLowerCase()).includes(item.toLowerCase())) {
                      setNoiThatVal([...lines, item].join("\n"));
                    }
                  }}
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 4,
                    border: "1px solid",
                    borderColor: hasItem ? "#e2e8f0" : "#cbd5e1",
                    background: hasItem ? "#f1f5f9" : "#ffffff",
                    color: hasItem ? "#94a3b8" : "#334155",
                    cursor: hasItem ? "default" : "pointer",
                  }}
                  title={hasItem ? "Đã có trong danh sách" : `Thêm nhanh ${item}`}
                >
                  {hasItem ? `✓ ${item}` : `+ ${item}`}
                </button>
              );
            })}
          </div>
        </div>
        <span className={styles.fieldHint} style={{ marginTop: 6 }}>
          Danh sách này là căn cứ tự động khởi tạo Biên bản bàn giao tài sản khi ký hợp đồng cho phòng.
        </span>
      </div>

      <div className={styles.formField}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <label style={{ margin: 0 }}>
            Tiện ích chung (Kế thừa từ Loại phòng)
          </label>
          <span
            style={{
              fontSize: 10.5,
              background: "#e0e7ff",
              color: "#3730a3",
              padding: "1px 6px",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Đồng bộ từ loại phòng
          </span>
        </div>
        {selectedTypeObj?.tien_ich && selectedTypeObj.tien_ich.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: "8px 10px",
              background: "#f8fafc",
              borderRadius: 6,
              border: "1px dashed #cbd5e1",
              minHeight: 38,
              alignItems: "center",
            }}
          >
            {selectedTypeObj.tien_ich.map((item) => (
              <span
                key={item}
                style={{
                  fontSize: 11.5,
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: "2px 8px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                ✦ {item}
              </span>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              fontStyle: "italic",
              padding: "8px 10px",
              background: "#f8fafc",
              borderRadius: 6,
              border: "1px dashed #e2e8f0",
            }}
          >
            Loại phòng này chưa thiết lập tiện ích chung (Cấu hình tại danh mục Loại phòng).
          </div>
        )}
        <span className={styles.fieldHint}>
          Tiện ích tòa nhà (Wifi, thang máy, bảo vệ, gửi xe...) được quy định chung theo loại phòng để tối ưu dữ liệu, không cần nhập trùng lặp ở từng phòng.
        </span>
      </div>

      <div className={styles.formField}>
        <label htmlFor="hinhAnh">Ảnh phòng</label>
        <input
          id="hinhAnh"
          name="hinhAnh"
          defaultValue={room?.hinhAnh ?? ""}
          placeholder="Dán URL ảnh hoặc tải lên ở khung bên dưới"
          maxLength={500}
        />
      </div>

      <div className={`${styles.formField} ${styles.formFieldWide}`}>
        <RoomPhotoUpload />
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
              <LoaderCircle size={15} className={styles.spinner} />{" "}
              {mode === "create" ? "Đang tạo phòng..." : "Đang lưu..."}
            </>
          ) : mode === "create" ? (
            "Thêm phòng mới"
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
  editableBuilding,
}: {
  room: RoomFormData;
  buildings: string[];
  roomTypes: { ma_loai_phong: string; ten_loai_phong: string }[];
  defaultBuilding: string;
  editableBuilding: boolean;
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
            room={room}
            buildings={buildings}
            roomTypes={roomTypes}
            defaultBuilding={defaultBuilding}
            editableBuilding={editableBuilding}
          />
        </div>
      )}
    </>
  );
}

/**
 * Modal thêm phòng mới (Admin) kèm gán chỉ số điện nước ban đầu.
 */
export function CreateRoomModal({
  buildings,
  roomTypes,
  defaultBuilding,
  editableBuilding,
}: {
  buildings: string[];
  roomTypes: {
    ma_loai_phong: string;
    ten_loai_phong: string;
    don_gia_co_ban?: string;
    tien_ich?: string[] | null;
  }[];
  defaultBuilding: string;
  editableBuilding: boolean;
}) {
  const [open, setOpen] = useState(false);

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
        className={styles.primary}
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
      >
        <Plus size={16} /> Thêm phòng mới
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 820,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid #e2e8f0",
              padding: "24px 28px",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  Thêm Phòng Mới Vào Hệ Thống
                </h2>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "3px 0 0" }}>
                  Định danh phòng, thiết lập giá thuê và gán chỉ số công tơ điện nước ban đầu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  color: "#64748b",
                  borderRadius: 8,
                  padding: 6,
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <RoomForm
              mode="create"
              buildings={buildings}
              roomTypes={roomTypes}
              defaultBuilding={defaultBuilding}
              editableBuilding={editableBuilding}
            />
          </div>
        </div>
      )}
    </>
  );
}
