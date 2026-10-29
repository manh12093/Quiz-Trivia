# Chinh Phục Online

Chạy thử trên máy: `node server.js` rồi mở http://localhost:3000 (không cần `npm install`).

## Đưa lên mạng cho mọi người cùng chơi
- **Nhanh nhất (tạm thời):** chạy `node server.js`, rồi `npx cloudflared tunnel --url http://localhost:3000`
  (hoặc `ngrok http 3000`) -> gửi đường link https nhận được cho thí sinh.
- **Cố định:** đưa cả thư mục lên Render / Railway / Fly.io / VPS (Node 18+), lệnh chạy `node server.js`.
  Máy chủ tự đọc biến `PORT`. Nên dùng HTTPS.

## Âm thanh & logo
Bỏ các file này vào thư mục `public/` (đúng tên như trang gốc đang gọi):
`Âm thanh trả lời đúng.ogg`, `Âm thanh trả lời sai.ogg`, `Âm thanh khi bấm chuông.mpeg`, `Ảnh LOGO để ở title.png`.

## Cách chơi
1. MC vào trang chủ -> "Tôi là MC" -> đặt mật khẩu (mã trận tùy chọn) -> vào trang điều khiển như cũ.
2. Bấm nút 🌐 góc phải dưới: xem mã, mật khẩu, sao chép link mời, khóa phòng, đuổi người chơi.
3. Thí sinh vào trang chủ -> nhập mã trận + mật khẩu + tên -> chọn đội của mình.
4. Chuông công bằng: máy chủ nhận cú bấm đến sớm nhất khi chuông đang mở.

Lưu ý: dữ liệu phòng nằm trong bộ nhớ máy chủ (khởi động lại là mất phòng); phòng bỏ trống tự xóa sau vài giờ.
