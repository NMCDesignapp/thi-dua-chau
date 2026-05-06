# 🏆 Tính Thưởng Thi Đua - Insurance Bonus Calculator

Hệ thống quản lý & tính thưởng thi đua IP cho đại lý bảo hiểm.

## 📋 Yêu cầu

- **Node.js** >= 18
- **npm** hoặc **bun**

## 🚀 Cài đặt & Chạy

### 1. Clone dự án

```bash
git clone https://github.com/<tài-khoản>/<tên-repo>.git
cd <tên-repo>
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Tạo file môi trường

```bash
cp .env.example .env
```

### 4. Khởi tạo database

```bash
npx prisma generate
npx prisma db push
```

### 5. Chạy server phát triển

```bash
npm run dev
```

Truy cập: **http://localhost:3000**

### 6. Build & chạy production

```bash
npm run build
npm run start
```

## 📊 Tính năng

- ✅ Nhập dữ liệu hợp đồng từ Google Sheets (CSV)
- ✅ Thiết lập chương trình thi đua: ngày hiệu lực, ngày phát hành
- ✅ Chọn đối tượng: **TVV** (cá nhân) hoặc **Nhóm** (gộp theo MC NHÓM)
- ✅ Điều kiện: Theo hợp đồng hoặc Tổng IP
- ✅ Mức thưởng: Tiền hoặc Quà tặng
- ✅ Tự động tính thưởng & hiển thị thiếu hụt
- ✅ Lưu / tải chương trình thi đua
- ✅ Xuất CSV, In, Sao chép chia sẻ

## 📁 Cấu trúc

```
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/
│   │   ├── page.tsx        # Trang chính
│   │   ├── layout.tsx      # Layout
│   │   └── api/
│   │       ├── contracts/   # API hợp đồng
│   │       ├── contests/    # API chương trình thi đua
│   │       ├── import-csv/  # API nhập CSV
│   │       └── seed/        # API seed data
│   ├── components/ui/      # UI components (shadcn)
│   └── lib/
│       ├── db.ts           # Prisma client
│       └── utils.ts        # Tiện ích
├── db/
│   └── custom.db           # SQLite database
├── .env.example            # Mẫu biến môi trường
└── package.json
```

## 🔗 Nguồn dữ liệu

Nhập từ Google Sheets qua liên kết CSV, các cột được ánh xạ:

| Cột CSV | Trường | Mô tả |
|---------|--------|-------|
| Cột 5 | maNhom | MC NHÓM |
| Cột 7 | agentCode | Mã đại lý |
| Cột 8 | agentName | Họ tên TVV |
| Cột 9 | position | Chức vụ |
| Cột 12 | effectiveDate | Ngày hiệu lực |
| Cột 13 | issueDate | Ngày phát hành |
| Cột 14 | fyp | IP |
| Cột 21 | afyp | AFYP |
