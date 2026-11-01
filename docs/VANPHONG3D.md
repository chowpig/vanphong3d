# vanphong3d — thay đổi so với My Office gốc

Nguồn: [khanh020905/my-office](https://github.com/khanh020905/my-office) (MIT, giữ nguyên copyright trong `LICENSE`).

## Đã làm
- Gỡ toàn bộ tunnel Cloudflare khỏi `server/index.mjs` (không tải/chạy `cloudflared`, không listener internet). `POST /api/tunnel {on:true}` trả 403.
- Xóa `tests/e2e/fake-cloudflared.sh`, test e2e "away from home" và biến `OFFICE_TUNNEL_CMD`.
- Unit test 98/98 pass, typecheck sạch, lint 0 lỗi (2 warning biến không dùng).

## Chưa làm (nợ kỹ thuật, theo thứ tự ưu tiên)
1. Hai đoạn e2e còn gọi `/api/tunnel` (`tests/e2e/office.spec.ts` ~dòng 397, `tests/e2e/burn.spec.ts` ~dòng 55) sẽ fail — cần sửa; e2e Playwright CHƯA chạy.
2. UI còn công tắc "Cloudflare" (`src/office/ui/topbar.js`, locales) — cần gỡ.
3. Token cho `/event` và `/hook/*` trên localhost; mặc định `--no-approve`; bỏ `--lan`; PIN >= 8 số, bỏ "nhớ 365 ngày".
4. Xác minh dữ liệu gửi tới `translate.googleapis.com`.
5. Quét lịch sử git, bật Dependabot (npm audit hiện chỉ báo minimatch moderate, ở devDependency eslint).
