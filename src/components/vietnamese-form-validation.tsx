"use client";

import { useEffect } from "react";

/**
 * Tự động chuyển đổi toàn bộ thông báo xác thực mặc định của trình duyệt (HTML5 Constraint Validation)
 * sang Tiếng Việt cho toàn bộ form và input trong hệ thống.
 */
export function VietnameseFormValidation() {
  useEffect(() => {
    function handleInvalid(e: Event) {
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!el || !("validity" in el)) return;

      const validity = el.validity;
      if (validity.valueMissing) {
        el.setCustomValidity("Vui lòng điền thông tin này.");
      } else if (validity.typeMismatch) {
        if (el.type === "email") {
          el.setCustomValidity("Vui lòng nhập địa chỉ email hợp lệ (ví dụ: name@example.com).");
        } else if (el.type === "url") {
          el.setCustomValidity("Vui lòng nhập đường dẫn URL hợp lệ.");
        } else {
          el.setCustomValidity("Định dạng dữ liệu không hợp lệ.");
        }
      } else if (validity.stepMismatch) {
        el.setCustomValidity("Vui lòng nhập số tiền hoặc giá trị hợp lệ.");
      } else if (validity.rangeUnderflow) {
        el.setCustomValidity(`Giá trị phải từ ${(el as HTMLInputElement).min || "0"} trở lên.`);
      } else if (validity.rangeOverflow) {
        el.setCustomValidity(`Giá trị tối đa là ${(el as HTMLInputElement).max}.`);
      } else if (validity.tooShort) {
        el.setCustomValidity(`Vui lòng nhập ít nhất ${(el as HTMLInputElement).minLength} ký tự.`);
      } else if (validity.tooLong) {
        el.setCustomValidity(`Tối đa ${(el as HTMLInputElement).maxLength} ký tự.`);
      } else if (validity.patternMismatch) {
        el.setCustomValidity("Vui lòng nhập đúng định dạng yêu cầu.");
      } else if (validity.badInput) {
        el.setCustomValidity("Vui lòng nhập số hợp lệ.");
      } else {
        el.setCustomValidity("Thông tin không hợp lệ.");
      }
    }

    function handleInput(e: Event) {
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (el && typeof el.setCustomValidity === "function") {
        el.setCustomValidity("");
      }
    }

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, []);

  return null;
}

