# vanphong3d — thay đổi so với My Office gốc

Nguồn: [khanh020905/my-office](https://github.com/khanh020905/my-office) (MIT, giữ nguyên copyright trong `LICENSE`).

## Đã làm
- Gỡ toàn bộ tunnel Cloudflare khỏi `server/index.mjs` (không tải/chạy `cloudflared`, không listener internet). `POST /api/tunnel {on:true}` trả 403.
- Xóa `tests/e2e/fake-cloudflared.sh`, test e2e "away from home" và biến `OFFICE_TUNNEL_CMD`.
- Unit test 98/98 pass, typecheck sạch, lint 0 lỗi (2 warning biến không dùng).

## Đã làm thêm (bảo mật)
- Mọi `POST /event` và `/hook/*` phải có header `X-Office-Key` = nội dung `data/token`. Thiếu khóa: 403. `hooks/send.mjs` và `hooks/status-line.mjs` tự thêm khóa.
- Hook chạy bằng Node trên mọi nền tảng (bỏ `curl`), kể cả `hooks/hooks.json` của plugin và phiên nền.
- Hook duyệt quyền/trả lời câu hỏi từ xa chuyển thành opt-in: `my-office install --approve` (trước là `--no-approve` để tắt).
- Google Translate mặc định tắt (`OFFICE_TRANSLATE=1` mới bật) vì nó gửi mô tả hành động của Claude (tên file, lệnh) lên Google khi giao diện là tiếng Việt.
- PIN tối thiểu 8 số (mặc định sinh 8 số); cookie "nhớ thiết bị" 30 ngày thay vì 365.
- LAN vẫn tắt mặc định, chỉ bật khi bạn tự gạt công tắc; không có đường ra internet.

## Kiểm tra bảo mật (hộp đen, từ địa chỉ LAN)
- Chưa đăng nhập: mọi route 401/403, `/` chuyển sang `/pin`. Hook/`/event`/`/v1/*` từ LAN: 403 dù có khóa. Host lạ: 421. Đổi PIN từ điện thoại cần PIN hiện tại và có khóa thử sai.
- Đã sửa: `/api/sys/action` và `/api/sys/auto` (dừng/đóng tiến trình, hẹn giờ đóng phiên) trước đây điện thoại có PIN gọi được; nay chỉ loopback.
- Thêm header `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`.
- Còn lại, có chủ ý: link `?k=<token>` bỏ qua PIN trên LAN (token 72 bit; ai thấy QR/URL là vào được); trang chạy HTTP; không có CSP đầy đủ.

## Windows
- Hook, status line và phiên nền đều gọi `node hooks/send.mjs`; cần Node >= 20.9 trong PATH.
- `data/token` và `data/pin` nằm trong thư mục dự án: trên Windows quyền file `0o600` không có tác dụng, nên đừng đặt dự án ở thư mục dùng chung nhiều người.
- Tính năng giữ máy thức (`caffeinate`) chỉ có trên macOS và đã không còn dùng.
- Đã chạy trên Windows 10 (Node 24, PowerShell 5.1): test (95 pass, 3 skip theo thiết kế trên win32), typecheck, lint, build, smoke và `test:e2e:smoke` (5/5) đều pass. Đã sửa `npm start` và `my-office start` (trước đó hỏng trên Windows).
- E2E Playwright đầy đủ dùng `fake-claude.sh` (sh/curl/od/pkill): server không spawn được file `.sh` trực tiếp trên Windows, nên các test giao việc/phiên nền chỉ chạy được trên macOS/Linux. Bộ `@smoke` thì chạy được.

## Việc còn lại
1. Test e2e "điện thoại giao việc phải được Mac cho phép" đã viết lại cho LAN (`tests/e2e/office.spec.ts`), chạy trên macOS/Linux; logic cổng đã kiểm tay trên Windows.
2. Đã gỡ hẳn mã tunnel/`viaTunnel` khỏi `server/index.mjs`, `topbar.js`, `demo.js`. `/api/tunnel` không còn (404); trạng thái cửa sổ điện thoại nay ở `GET /api/phone/status` (chỉ loopback). `/api/live` vẫn còn nhưng không còn nơi nào gọi.
3. Lịch sử git của repo gốc (93 commit) đã quét bằng regex các mẫu secret thường gặp: không có kết quả, không có file nhạy cảm. Chưa quét entropy cao.
4. Dependabot: `.github/dependabot.yml` (npm + github-actions, hàng tuần).
5. `npm audit`: 16 cảnh báo moderate, đều ở chuỗi devDependency của eslint (`minimatch`); 0 ở dependency chạy thật (`npm audit --omit=dev`).
