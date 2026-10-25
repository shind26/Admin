"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import styles from "./rooms.module.css";

/**
 * Chọn ảnh phòng, tải lên Supabase Storage qua /api/upload/room-photo,
 * rồi ghi URL công khai vào ô input `hinhAnh` của form phòng.
 *
 * Mã phòng được đọc ngay từ ô "Mã phòng" trong form lúc gửi ảnh,
 * nên ảnh nằm đúng thư mục theo mã người dùng vừa gõ, không cần lưu phòng trước.
 */
export function RoomPhotoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Khi người dùng đổi Mã phòng sau khi đã tải ảnh, ảnh cũ nằm sai thư mục.
  // Ta tự động xóa ảnh cũ và yêu cầu tải lại để ảnh thuộc đúng phòng.
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("input#maPhong");
    if (!input) return;

    let lastCode = input.value.trim();

    const check = () => {
      const code = input.value.trim();
      if (code === lastCode) return;
      lastCode = code;

      setUrl((currentUrl) => {
        if (!currentUrl) return currentUrl;

        void fetch("/api/upload/room-photo/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: currentUrl, maPhong: code }),
        }).catch(() => undefined);

        setError(
          code
            ? "Bạn đã đổi Mã phòng nên ảnh cũ đã được gỡ. Vui lòng chọn ảnh lại."
            : null,
        );
        syncHiddenField("");
        return "";
      });
    };

    input.addEventListener("input", check);
    input.addEventListener("change", check);
    return () => {
      input.removeEventListener("input", check);
      input.removeEventListener("change", check);
    };
  }, []);

  /** Ghi URL ảnh vào ô "Ảnh phòng" của form để Server Action lưu khi bấm lưu phòng. */
  function syncHiddenField(value: string) {
    const hidden = document.querySelector<HTMLInputElement>("input#hinhAnh");
    if (hidden) hidden.value = value;
  }

  function currentRoomCode() {
    return (
      document.querySelector<HTMLInputElement>("input#maPhong")?.value ?? ""
    ).trim();
  }

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const maPhong = currentRoomCode();
    if (!maPhong) {
      setError("Vui lòng nhập Mã phòng trước khi tải ảnh.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    setError(null);

    // Ảnh đang hiển thị (nếu có) sẽ bị xóa trên Storage sau khi ảnh mới lên xong.
    const previousUrl = url;

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("maPhong", maPhong);
      if (previousUrl) body.set("previousUrl", previousUrl);

      const res = await fetch("/api/upload/room-photo", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? "Tải ảnh thất bại.");
        return;
      }

      setUrl(data.url);
      syncHiddenField(data.url);
    } catch {
      setError("Không gửi được ảnh lên máy chủ.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /**
   * Bỏ ảnh: xóa trên Storage (nếu là ảnh của hệ thống) và xóa URL khỏi form.
   * Lỗi xóa không chặn thao tác vì form đã không còn giữ ảnh.
   */
  async function clearPhoto() {
    const currentUrl = url;
    setUrl("");
    syncHiddenField("");
    setError(null);

    if (!currentUrl) return;

    try {
      await fetch("/api/upload/room-photo/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, maPhong: currentRoomCode() }),
      });
    } catch {
      setError("Ảnh đã bỏ khỏi phòng nhưng chưa xóa được trên Storage.");
    }
  }

  return (
    <div className={styles.photoBox}>
      <span className={styles.photoLabel}>
        Tải ảnh lên (Supabase Storage) — nhập Mã phòng trước khi chọn ảnh
      </span>

      <div className={styles.photoRow}>
        <button
          type="button"
          className={styles.photoButton}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <>
              <LoaderCircle size={14} className={styles.photoSpinner} /> Đang
              tải...
            </>
          ) : (
            <>
              <ImagePlus size={14} /> Chọn ảnh
            </>
          )}
        </button>

        {url && (
          <button
            type="button"
            className={styles.photoClear}
            onClick={clearPhoto}
          >
            <Trash2 size={14} /> Bỏ ảnh
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleChange}
          hidden
        />
      </div>

      {error && <p className={styles.photoError}>{error}</p>}

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Ảnh phòng vừa tải lên"
          className={styles.photoPreview}
        />
      )}
    </div>
  );
}
