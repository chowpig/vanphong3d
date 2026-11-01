# vanphong3d — thay đổi so với My Office gốc

Nguồn: [khanh020905/my-office](https://github.com/khanh020905/my-office) (MIT, giữ nguyên copyright trong `LICENSE`).

## Đã làm
- Gỡ toàn bộ tunnel Cloudflare khỏi `server/index.mjs` (không tải/chạy `cloudflared`, không listener internet). `POST /api/tunnel {on:true}` trả 403.
- Xóa `tests/e2e/fake-cloudflared.sh`, test e2e "away from home" và biến `OFFICE_TUNNEL_CMD`.
- Unit test 98/98 pass, typecheck sạch, lint 0 lỗi (2 warning biến không dùng).

## Chưa làm (nợ kỹ thuật, theo thứ tự ưu tiên)
1. (ĐÃ XONG) Hai đoạn e2e tunnel đã gỡ; mất phần kiểm tra "điện thoại giao việc qua cổng tunnel" — cần viết lại cho LAN. Playwright e2e vẫn CHƯA chạy.
2. (ĐÃ XONG) Tab "Cloudflare" đã gỡ khỏi UI; còn chuỗi i18n tunnel chưa dọn.
3. Token cho `/event` và `/hook/*` trên localhost; mặc định `--no-approve`; bỏ `--lan`; PIN >= 8 số, bỏ "nhớ 365 ngày".
4. Xác minh dữ liệu gửi tới `translate.googleapis.com`.
5. Quét lịch sử git, bật Dependabot (npm audit hiện chỉ báo minimatch moderate, ở devDependency eslint).
