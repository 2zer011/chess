# ♔ Cờ Vua Vui - Chess Game Online

Game cờ vua đơn giản với chế độ chơi online realtime (PvP), chế độ 2 người chơi cục bộ, và AI.

## 🎮 Tính Năng

✅ **Đấu với Máy (AI)** - 3 độ khó: Dễ, Vừa, Khó  
✅ **2 Người Chơi** - Chơi cùng một thiết bị  
✅ **Chơi Online** - Kết nối realtime với bạn bè qua PeerJS  
✅ **Chat Trực Tiếp** - Trò chuyện với đối thủ trong game  
✅ **10 Chế Độ Giao Diện** - Chủ đề màu sắc đa dạng  
✅ **SVG/Unicode Pieces** - Hai kiểu hiển thị quân cờ  
✅ **Bộ Đếm Thời Gian** - Hỗ trợ nhiều định dạng giờ  
✅ **PWA Offline** - Cài đặt như app trên điện thoại  

## 🚀 Deploy Lên Web

### **Cách 1: GitHub Pages (Miễn phí, dễ nhất)**

1. **Tạo tài khoản GitHub** (nếu chưa có): https://github.com/signup

2. **Tạo repository mới:**
   - Click "New" → Repository name: `chess-vui`
   - Public ✅ → Create

3. **Upload files:**
   - Upload 5 file: `index.html`, `game.js`, `style.css`, `sw.js`, `manifest.json`
   - Commit changes

4. **Kích hoạt GitHub Pages:**
   - Settings → Pages → Source: `main` → Save
   - Chờ 1-2 phút → Link: `https://[username].github.io/chess-vui`

✅ **Done!** Game đã live!

---

### **Cách 2: Vercel (Miễn phí, cực nhanh)**

1. **Đẩy code lên GitHub** (làm theo Cách 1)

2. **Import vào Vercel:**
   - Truy cập: https://vercel.com/new
   - Login GitHub → Import project
   - Select: `chess-vui`
   - Deploy! ✅

✅ **Link:** `https://chess-vui.vercel.app`

---

### **Cách 3: Netlify (Miễn phí, tốt)**

1. **Drag & Drop:**
   - Truy cập: https://app.netlify.com/drop
   - Kéo folder game vào
   - Deploy! ✅

✅ **Link tự động tạo**

---

## 🎮 Cách Chơi Online

### **Người tạo phòng (Host):**
1. Click "Chơi Online" → "Tạo Phòng"
2. Copy ID phòng (click vào ID để sao chép)
3. Gửi ID cho bạn

### **Người vào phòng (Joiner):**
1. Click "Chơi Online" → Nhập ID phòng
2. Click "Vào"
3. Game khởi động tự động!

---

## 📱 Cài Đặt Như App

### **Android (Chrome):**
1. Mở game trên Chrome
2. Menu (3 chấm) → "Add to Home Screen"
3. Game như app bình thường ✅

### **iPhone (Safari):**
1. Mở game trên Safari
2. Share → "Add to Home Screen"
3. Game như app bình thường ✅

---

## 🛠 Cài Đặt Locally

```bash
# Clone repo (nếu trên GitHub)
git clone https://github.com/[username]/chess-vui.git
cd chess-vui

# Hoặc đơn giản mở index.html bằng Live Server
# Hoặc: python -m http.server (Python 3)
```

---

## 🔧 Yêu Cầu

- **Browser:** Chrome, Firefox, Safari, Edge (latest)
- **Internet:** Chỉ cần để kết nối online (PeerJS)
- **Node.js:** Không cần (thuần HTML/CSS/JS)

---

## 📋 Điều Khiển

- **Chọn quân:** Click quân muốn di chuyển
- **Di chuyển:** Click ô đích (hiển thị dấu chấm/vòng)
- **Quay lại:** Click nút ⬅ trên header

---

## 🐛 Troubleshooting

### **Online không kết nối?**
- Kiểm tra internet connection
- PeerJS server có thể lag, chờ vài giây
- Thử lại tạo phòng

### **Chat không gửi?**
- Chỉ có thể chat khi kết nối thành công
- Bấm Enter hoặc nút "Gửi"

### **AI quá mạnh/yếu?**
- Cài Đặt → Độ Khó (Easy/Medium/Hard)

---

## 📄 License

MIT - Tự do sử dụng & sửa đổi

---

## 👨‍💻 Phát Triển

- **Engine:** Minimax with Alpha-Beta Pruning
- **Kết nối:** PeerJS (WebRTC)
- **Themes:** 10 chủ đề CSS
- **PWA:** Service Worker cache

---

**Chúc bạn chơi vui!** 🎉♔
