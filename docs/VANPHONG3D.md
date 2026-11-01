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

## Văn phòng tự mở rộng (kiểu "Tự động", mặc định)
- Văn phòng chọn cỡ theo số dự án có người: tới 6 dự án là tầng công ty (`pro`); từ 7 là trụ sở (`hq`, 10 chỗ); mỗi 2 dự án nữa thêm một hàng 2 phòng ban ở cánh nhà, tối đa 4 hàng (18 dự án). Quá 18 thì dùng chung bàn như trước.
- Khi số dự án vượt sức chứa, trang tự nạp lại vào bản lớn hơn (hiện thông báo), các phiên quay về ngay từ server. Số dự án cần được nhớ trong `localStorage["office-need"]` (giữ mức lớn nhất; chỉ hạ sau 3 ngày); không bao giờ thu nhỏ khi đang mở.
- Chọn tay vẫn được: Cài đặt → Văn phòng (Ấm cúng / Chuyên nghiệp / Tập đoàn), hoặc `?layout=auto|cozy|pro|hq&rows=0..4` cho một lần xem.
- Mã: `src/office/world/plan.js` (tính toán thuần: danh sách phòng, đồ thị đi bộ, quy tắc chọn cỡ; có test ở `tests/unit/plan.test.mjs`), `wing.js`, `terrace.js`, `lights.js` theo số hàng; `net/live.js` (`checkGrowth`). E2E: `grows with its projects` (13 dự án → `hq+2`, cả 13 người đi tới bàn).
- Giới hạn đã biết: mỗi hàng thêm 2 đèn điểm cho mỗi 2 hàng (tối đa +4 đèn); bóng đổ dùng bản đồ 4096 khi tòa nhà dài; tòa nhà lớn nhất (hq+4) nặng hơn trên máy yếu.

## Ngôn ngữ
- Tiếng Việt là mặc định (`INITIAL_LANG` trong `src/i18n/index.js`); đổi trong Cài đặt hoặc `OFFICE_LANG=en`. Bản dịch vi đủ 2.599/2.599 khóa. Tên sản phẩm "My Office" chưa đổi.

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

## Dự án của tôi và Cowork

- Cài đặt → Văn phòng → "Dự án của tôi": mỗi dòng một tên dự án (ví dụ INFO, HỒNG PHÚC, PHỤ TÙNG SỈ, NHÀ GỖ). Lưu ở `data/myprojects.json` trên máy này; không đọc gì từ tài khoản claude.ai.
- Phiên có tên kho mã, thư mục, tiêu đề hoặc dự án Cowork trùng một tên (không phân biệt dấu, hoa thường, gạch nối) sẽ ngồi ở khu của dự án đó; văn phòng tự mở rộng đủ chỗ cho cả danh sách.
- Cowork: `cowork-plugin/` gửi sự kiện (đánh dấu `X-Office-Source: cowork`) tới văn phòng; nhân vật hiện tên "Cowork · …". **Chưa kiểm chứng:** Cowork chạy trong máy ảo, chưa xác nhận máy ảo gọi được `127.0.0.1:4310`. Bạn tự cài plugin và chép `data/token` (xem `cowork-plugin/README.md`).
- Chưa làm: tự lấy danh sách project/phiên cũ từ tài khoản (cần xuất dữ liệu hoặc API có đăng nhập).

## Chat (claude.ai trong app) vào văn phòng

Chat chạy trên đám mây nên không có hook. `mcp/office-mcp.mjs` là một MCP server chạy trên máy này, cho Chat một công cụ `office_report`; Chat gọi nó thì cuộc trò chuyện hiện thành nhân vật "Chat · tên", ngồi ở khu của dự án nếu `project` khớp "Dự án của tôi". Chỉ gửi tiêu đề, tên dự án và một ghi chú ngắn, không gửi nội dung chat.
- Thêm vào `%APPDATA%\Claude\claude_desktop_config.json` (mục `mcpServers`), rồi thoát hẳn và mở lại app Claude:
  `"my-office": { "command": "node", "args": ["D:\Vanphong3d-test\mcp\office-mcp.mjs"] }`
- Để Chat tự gọi, dán vào Cài đặt → Sở thích (hoặc hướng dẫn của project): "Khi bắt đầu một yêu cầu, gọi office_report với status working; khi trả lời xong gọi với status done. Dùng cùng một conversation (tên cuộc trò chuyện) mỗi lần, project là tên project nếu có. Không đưa nội dung riêng tư vào title hoặc note."
- Giới hạn: phụ thuộc Chat chịu gọi công cụ, và chỉ thấy cuộc trò chuyện từ lúc gọi. Không tự lấy các chat cũ.

## Việc còn lại
1. Test e2e "điện thoại giao việc phải được Mac cho phép" đã viết lại cho LAN (`tests/e2e/office.spec.ts`), chạy trên macOS/Linux; logic cổng đã kiểm tay trên Windows.
2. Đã gỡ hẳn mã tunnel/`viaTunnel` khỏi `server/index.mjs`, `topbar.js`, `demo.js`. `/api/tunnel` không còn (404); trạng thái cửa sổ điện thoại nay ở `GET /api/phone/status` (chỉ loopback). `/api/live` vẫn còn nhưng không còn nơi nào gọi.
3. Lịch sử git của repo gốc (93 commit) đã quét bằng regex các mẫu secret thường gặp: không có kết quả, không có file nhạy cảm. Chưa quét entropy cao.
4. Dependabot: `.github/dependabot.yml` (npm + github-actions, hàng tuần).
5. `npm audit`: 16 cảnh báo moderate, đều ở chuỗi devDependency của eslint (`minimatch`); 0 ở dependency chạy thật (`npm audit --omit=dev`).
