# Vanphong3d — Hướng dẫn cài đặt và sử dụng

Vanphong3d là bản phát triển từ [My Office](https://github.com/khanh020905/my-office) (giấy phép MIT). Nó vẽ một **văn phòng 3D** trên máy bạn, ở đó mỗi cuộc trò chuyện với Claude là một nhân vật ngồi ở bàn của dự án mình. Văn phòng tự mở rộng thêm phòng ban và bàn khi có thêm dự án.

Bản này khác bản gốc ở những điểm chính:

- Chỉ vẽ **Chat** (claude.ai trong app Claude) và **Cowork**. Các phiên Claude Code mặc định bị ẩn (bật lại trong Cài đặt).
- Mỗi **dự án** là một **phòng ban** mang tên dự án (ví dụ "Phòng Marketing").
- Cảnh ngoài trời (phố, xe cộ, cửa hàng) đã gỡ: chỉ còn tòa nhà, bãi cỏ và lối đi bao quanh.
- Giao diện và nhóm chat mặc định tiếng Việt. Nhóm chat nói về **công việc thật** (việc đang làm, số file đã sửa, thời gian) thay vì chuyện phiếm.
- Đã bỏ tunnel ra internet. Mặc định chỉ máy bạn mở được văn phòng.

> Đây là dự án cộng đồng, không do Anthropic tạo ra hay bảo trợ.

---

## 1. Văn phòng hoạt động thế nào

```
 Chat (claude.ai trong app Claude) ──► công cụ office_report (MCP, chạy trên máy bạn) ──┐
 Cowork (máy ảo của app Claude)    ──► plugin Cowork ──► cổng riêng trên card ảo ──────┼──► Văn phòng
 Claude Code (terminal, VS Code)   ──► hook (tùy chọn, mặc định ẩn) ───────────────────┘   http://localhost:4310
```

- **Chat chạy trên đám mây** nên không có gì trên máy bạn tự thấy được nó. Chat chỉ hiện khi nó **gọi công cụ `office_report`** (bạn cài công cụ này ở mục 5).
- Văn phòng không đọc tài khoản claude.ai của bạn. Nó chỉ nhận tiêu đề, tên dự án và một ghi chú ngắn mà Chat gửi, không nhận nội dung cuộc trò chuyện.
- Mọi thứ nằm trong thư mục `data/` của dự án (khóa `token`, danh sách dự án, nhóm chat, các cuộc chat đang mở). **Không bao giờ đưa `data/` lên git.**

## 2. Yêu cầu

| | |
|---|---|
| Hệ điều hành | Windows 10/11, macOS hoặc Linux |
| Node.js | 20.9 trở lên ([nodejs.org](https://nodejs.org)) |
| Git | để tải mã nguồn |
| App Claude (desktop) | để dùng Chat và Cowork |
| Trình duyệt | Chrome, Edge, Firefox hoặc Safari mới; cần WebGL |

Máy không có card đồ họa vẫn chạy được nhưng chậm hơn (vẽ bằng phần mềm).

## 3. Cài đặt

Mở terminal (PowerShell trên Windows, Terminal trên macOS/Linux):

```bash
git clone https://github.com/chowpig/vanphong3d.git
cd vanphong3d
npm ci --ignore-scripts
npm run build
node bin/cli.mjs start
```

Rồi mở **http://localhost:4310**. Lần đầu bạn sẽ thấy văn phòng trống (không có cuộc chat nào): đó là bình thường.

Giải thích:

- `npm ci --ignore-scripts` cài đúng các thư viện đã khóa phiên bản và **không chạy script cài đặt** của chúng (an toàn hơn). Văn phòng không cần các script đó.
- `npm run build` dựng giao diện (1–3 phút). Nếu bạn bỏ qua, `start` sẽ tự dựng lần đầu.
- `node bin/cli.mjs start` chạy văn phòng trong cửa sổ terminal này. Đóng cửa sổ là văn phòng tắt.
- Thử trước khi dùng thật: mở **http://localhost:4310/?demo** để xem văn phòng với dữ liệu mẫu.

### Chạy nền, tự bật khi đăng nhập

```bash
node bin/cli.mjs install --service
```

Lệnh này thêm hook cho Claude Code (có sao lưu `settings.json` trước) và đăng ký dịch vụ nền: Windows dùng một script trong thư mục Startup, macOS dùng launchd, Linux dùng systemd. Nếu **chỉ dùng Chat/Cowork** và không muốn đụng đến Claude Code, bạn có thể bỏ qua `install` và chỉ chạy `node bin/cli.mjs start` mỗi khi cần.

Kiểm tra mọi thứ:

```bash
node bin/cli.mjs doctor
```

### Cập nhật

```bash
git pull
npm ci --ignore-scripts
npm run build
```

rồi khởi động lại văn phòng. Gỡ cài đặt: `node bin/cli.mjs uninstall` (gỡ hook và dịch vụ nền, giữ phần còn lại của `settings.json`), rồi xóa thư mục dự án.

## 4. Dự án của tôi (phòng ban)

Vào **Cài đặt (bánh răng) → Văn phòng → Dự án của tôi**, gõ mỗi dòng một tên dự án, ví dụ:

```
Marketing
Kế toán
Bán hàng
Kho
```

rồi bấm **Lưu danh sách**. Từ đó:

- Mỗi dự án có một **phòng ban** riêng, biển cửa ghi "Phòng Marketing"... Văn phòng tự lên dạng có phòng ban ("Tập đoàn") khi có dự án đặt tên.
- Một cuộc chat thuộc dự án nếu **tên dự án xuất hiện nguyên cả từ** trong tiêu đề hoặc nếu Chat khai báo `project` khi gọi công cụ. Không phân biệt dấu hay hoa thường ("ke toan" khớp "Kế toán"). Tên dài hơn thắng, và "informatics" không khớp "INFO".
- Cuộc chat không khớp dự án nào ngồi ở "Phòng Chat" chung.
- Danh sách chỉ lưu trên máy bạn (`data/myprojects.json`).

Cỡ văn phòng (Cài đặt → Văn phòng): **Tự động** (mặc định, mở rộng theo số dự án, lên tới 18 dự án), Ấm cúng, Chuyên nghiệp, Tập đoàn. Chọn "Tự động" nếu bạn muốn phòng ban xuất hiện; chọn "Chuyên nghiệp" hoặc "Ấm cúng" thì sẽ không có phòng ban.

## 5. Kết nối Chat (claude.ai trong app Claude)

Bước này cho Chat một công cụ tên `office_report`. Chạy trong thư mục dự án:

```bash
node bin/cli.mjs chat-setup            # xem sẽ thêm gì, chưa sửa gì
node bin/cli.mjs chat-setup --write    # thêm vào cấu hình app Claude (có sao lưu)
```

Lệnh tự tìm file `claude_desktop_config.json` của app Claude (kể cả bản cài từ Microsoft Store, nơi file nằm ở `%LOCALAPPDATA%\Claude-Data\...`). Nếu bạn muốn sửa tay, thêm đoạn sau vào mục `mcpServers` (thay đường dẫn bằng thư mục bạn đã tải về):

```json
"my-office": { "command": "node", "args": ["C:\\duong\\dan\\vanphong3d\\mcp\\office-mcp.mjs"] }
```

Sau đó **thoát hẳn app Claude (cả biểu tượng ở khay hệ thống) rồi mở lại**.

### Để Chat tự báo mỗi lần

Chat chỉ hiện khi nó gọi công cụ, và nó không tự gọi nếu bạn không dặn. Dán câu dưới đây vào **Cài đặt → Sở thích (profile preferences)** của claude.ai để áp dụng cho mọi chat:

> Trong MỌI cuộc trò chuyện, trước khi trả lời tin nhắn đầu tiên, hãy gọi công cụ office_report với status "working", conversation là vài từ đầu của tin nhắn đầu tiên (dùng đúng chữ đó ở mọi lần gọi sau), title ngắn trung tính, và project nếu cuộc trò chuyện nằm trong một project. Khi trả lời xong mỗi tin nhắn, gọi office_report với status "done". Không đưa nội dung riêng tư vào title hoặc note. Nếu công cụ lỗi hay không có thì cứ tiếp tục, không cần nhắc.

Công cụ cũng gửi kèm lời dặn tương tự, nhưng không phải app nào cũng đưa nó vào mọi chat, nên câu ở Sở thích là cách chắc nhất.

### Kiểm tra

Mở một chat mới và gõ: *"Gọi office_report với conversation 'thử nghiệm', status working"*. Nhân vật "Chat · thử nghiệm" sẽ hiện trong văn phòng. Nhật ký của app (mục 10) ghi lại mỗi lần gọi công cụ.

### Giới hạn cần biết

- Văn phòng chỉ thấy cuộc chat **từ lúc nó gọi công cụ**. Các chat cũ trong danh sách Recents không tự hiện.
- Cuộc chat được nhớ **6 giờ** kể cả khi khởi động lại văn phòng, hoặc đến khi Chat báo `closed`.

## 6. Kết nối Cowork (tùy chọn, chưa kiểm chứng đủ)

Cowork chạy trong một **máy ảo**, không thấy `localhost` của máy chính. Vanphong3d xử lý bằng:

1. Một plugin cho Cowork gửi sự kiện của phiên tới văn phòng.
2. Một **cổng riêng** của văn phòng trên card mạng ảo Hyper-V (`vEthernet`, chỉ Windows). Cổng này chỉ nhận `POST /event` có khóa và `GET /health`, từ địa chỉ cùng mạng con. Không mở ra mạng nhà hay internet. Tắt bằng biến môi trường `OFFICE_VM_BIND=off`.

Cài plugin:

```bash
node bin/cli.mjs cowork-plugin
```

Lệnh tạo file `cowork-plugin.plugin`. Trong app Claude chọn **Customize → Plugins → tải plugin lên**, chọn file này rồi bật. **File này chứa khóa của văn phòng bạn: đừng gửi cho ai và đừng đưa lên git.**

Mở một tác vụ Cowork mới. Đầu phiên có dòng "Nhà Gỗ Office: đã kết nối qua …" hoặc "không tìm thấy văn phòng (đã thử …)". Nếu không kết nối được, xem mục 10.

> Trạng thái: phần máy chủ đã được kiểm tra bằng sự kiện giả lập, nhưng chưa có kiểm tra với một phiên Cowork thật chạy trong máy ảo trên mọi cấu hình. Nếu bạn thử và thấy kết quả, hãy báo lại.

## 7. Dùng văn phòng

- **Chuột**: kéo để xoay, cuộn để phóng to/thu nhỏ từng chút (mỗi nấc khoảng 8%).
- **Bàn phím**: **W A S D** hoặc phím mũi tên di chuyển khung nhìn ngang dọc, giữ **Shift** để đi nhanh. Khi đang gõ trong ô nhập hoặc đang mở một phiên (khung nhìn bám theo nhân vật), các phím này không di chuyển khung nhìn. Ở chế độ **Hoá thân** (góc nhìn thứ nhất) WASD là đi bộ.
- **Nhóm chat "Công ty Nhà Gỗ Office"**: các nhân vật báo việc ở đây. Họ nói về công việc thật: nhận việc gì, xong chưa, sửa bao nhiêu file, mất bao lâu. Lời thoại có nhiều biến thể và không lặp lại câu vừa nói.
- **Cài đặt** có các tab Văn phòng, Nhân vật, Hiển thị, Khác: cỡ văn phòng, giờ ngày/đêm, thời tiết, kiểu nhân vật, ngôn ngữ, chất lượng đồ họa, dự án của tôi, hiện cả phiên Claude Code.

### Hiện cả phiên Claude Code

Mặc định văn phòng **chỉ vẽ Chat và Cowork**. Muốn thấy cả các phiên Claude Code (terminal, VS Code, tab Code), tick **Cài đặt → Văn phòng → Hiện cả phiên Claude Code**. Khi đó nên chạy `node bin/cli.mjs install` để Claude Code gửi sự kiện.

## 8. Xem trên điện thoại (tùy chọn)

Mặc định chỉ máy bạn mở được văn phòng. Muốn xem trên điện thoại cùng wifi: bấm nút điện thoại trong văn phòng và bật "Mở trên điện thoại". Điện thoại cần **mã PIN 8 số** (hiện trong cửa sổ đó). Chỉ bật ở mạng bạn tin cậy, vì trang dùng HTTP thường. Điện thoại chỉ xem; duyệt quyền từ điện thoại là tùy chọn riêng (mặc định tắt).

## 9. Bảo mật

- Văn phòng nghe ở `127.0.0.1`. Mạng nhà chỉ được mở khi **bạn tự bật** công tắc điện thoại, và vẫn cần PIN.
- Không có đường ra internet (tunnel của bản gốc đã bị gỡ).
- Mọi sự kiện gửi vào (`/event`, `/hook/*`) phải có khóa `X-Office-Key` bằng nội dung `data/token`. Thiếu khóa: 403.
- Các route điều khiển tiến trình (`/api/sys/*`, trạng thái điện thoại) chỉ chấp nhận từ chính máy này.
- Nội dung giống mật khẩu, token, khóa API bị che trước khi lưu hoặc hiện.
- Công cụ `office_report` chỉ gửi tiêu đề, tên dự án và ghi chú ngắn; không gửi nội dung chat.
- Dịch tự động sang tiếng Việt bị tắt mặc định (`OFFICE_TRANSLATE=1` mới bật) vì nó gửi mô tả hành động của Claude lên Google.
- Chi tiết và cách báo lỗi bảo mật: xem [SECURITY.md](../SECURITY.md).

## 10. Gỡ lỗi

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| Mở được trang nhưng trống | Bình thường khi chưa có chat nào báo. Thử `/?demo`. Kiểm tra mục 5. |
| Chat không hiện | (1) `chat-setup` chưa chạy hoặc chưa mở lại app Claude. (2) Chat không gọi công cụ: dán câu hướng dẫn vào Sở thích. (3) Xem nhật ký của app: trong thư mục log của app Claude có file `mcp-server-my-office.log` (mỗi lần gọi có dòng `tools/call`). Thư mục log: Windows (bản cài thường) `%APPDATA%\Claude\logs`; Windows (bản Microsoft Store) `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Local\Claude\logs`; macOS `~/Library/Logs/Claude`. |
| Chat hiện nhưng không vào phòng đúng dự án | Thêm tên dự án vào "Dự án của tôi" và đặt tiêu đề chat có tên dự án; hoặc chọn kích cỡ "Tự động"/"Tập đoàn" (các cỡ nhỏ không có phòng ban). Tải lại trang một lần. |
| Mất các nhân vật sau khi tắt máy | Văn phòng nhớ chat 6 giờ; chạy lại `node bin/cli.mjs start` (hoặc cài `install --service` để tự bật). |
| "Gói Claude chưa đọc được" | Cần đăng nhập Claude Code ở terminal: `claude auth login`. Chỉ ảnh hưởng thẻ hạn mức gói, không ảnh hưởng nhân vật. |
| "Không tìm thấy Claude Code trên máy này" | Bản này tìm được `claude.exe` cài bằng npm trên Windows. Nếu vẫn lỗi, đặt `OFFICE_CLAUDE_BIN` là đường dẫn đầy đủ tới `claude`. |
| Cowork: "không tìm thấy văn phòng" | Văn phòng chưa chạy; hoặc Windows Defender Firewall chặn kết nối vào từ máy ảo (cho phép Node.js trên mạng riêng); hoặc máy không phải Windows/Hyper-V. Địa chỉ card ảo đổi sau khi khởi động lại, văn phòng tự theo kịp trong 30 giây. |
| Cổng 4310 đã bị dùng | Đặt `OFFICE_PORT=4320` rồi chạy lại (nhớ đổi cả trong lệnh `install`). |
| Trang chậm, giật | Hạ chất lượng: Cài đặt → Hiển thị. Máy không có GPU vẽ bằng phần mềm nên chậm hơn. |
| Có thư mục lạ `Microsoft/` trong dự án | Do PowerShell tạo khi chạy kiểm thử; xóa được, đã nằm trong `.gitignore`. |

Biến môi trường hay dùng: `OFFICE_PORT` (mặc định 4310), `OFFICE_HOST`, `OFFICE_LANG` (`vi`/`en`), `OFFICE_DATA_DIR`, `OFFICE_USAGE=0`, `OFFICE_CI=0`, `OFFICE_TRANSLATE`, `OFFICE_SHOW_CODE=1` (hiện cả phiên Code mặc định), `OFFICE_VM_BIND=off`.

## 11. Kiểm thử và giới hạn đã biết

```bash
npm test               # kiểm thử đơn vị
npm run typecheck && npm run lint
npm run build && npm run smoke
npm run test:e2e       # đầy đủ, rất lâu trên Windows (khoảng 1,5 giờ)
```

- Trên Windows, trình duyệt kiểm thử vẽ 3D bằng phần mềm nên chậm; vài kiểm thử mô phỏng dài có thể hết thời gian chờ. Các kiểm thử cần giả lập Claude Code bằng script bash (`tests/e2e/fake-claude.sh`) tự bỏ qua trên Windows.
- Mã của các cảnh ngoài trời cũ (phố, cửa hàng) vẫn còn trong dự án nhưng không chạy; có thể dọn sau.
- Cowork trong máy ảo thật chưa được kiểm chứng trên mọi cấu hình.
- Tên sản phẩm trong giao diện là "Nhà Gỗ Office".

## 12. Giấy phép và ghi công

MIT. Bản quyền gốc của khanh020905 và phần sửa đổi của chowpig được giữ trong [LICENSE](../LICENSE). Mã gốc: <https://github.com/khanh020905/my-office>.
