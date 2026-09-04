# 🍽️ Restaurant Management System — Backend API

A production-ready REST API with real-time Socket.IO, JWT auth, OTP email verification, Stripe & Razorpay payments, and role-based access control.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd restaurant-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your values in .env
```

### 3. Seed the database
```bash
npm run seed
```

### 4. Start the server
```bash
npm run dev      # Development (nodemon)
npm start        # Production
```

---

## 🔐 Test Credentials (after seeding)

| Role     | Email                        | Password      |
|----------|------------------------------|---------------|
| Admin    | admin@restaurant.com         | Admin@123     |
| Chef     | chef@restaurant.com          | Chef@123      |
| Waiter   | waiter@restaurant.com        | Waiter@123    |
| Customer | customer@restaurant.com      | Customer@123  |

---

## 📁 Folder Structure

```
src/
├── config/          # DB, Email, Cloudinary config
├── controllers/     # Business logic
├── middleware/      # Auth, error handler, rate limiter, validator
├── models/          # Mongoose models
├── routes/          # Express routes
├── socket/          # Socket.IO handler
└── utils/           # Seeder, cron jobs, helpers
```

---

## 🌐 API Reference

**Base URL:** `http://localhost:5000/api`

All protected routes require:
```
Authorization: Bearer <accessToken>
```

---

### 🔐 Auth  `/api/auth`

| Method | Endpoint               | Auth | Description                        |
|--------|------------------------|------|------------------------------------|
| POST   | /register              | ❌   | Register (sends OTP to email)      |
| POST   | /verify-email          | ❌   | Verify email with OTP              |
| POST   | /resend-otp            | ❌   | Resend email verification OTP      |
| POST   | /login                 | ❌   | Login → returns tokens             |
| POST   | /forgot-password       | ❌   | Send password reset OTP            |
| POST   | /verify-reset-otp      | ❌   | Verify reset OTP → resetToken      |
| POST   | /reset-password        | ❌   | Reset password using resetToken    |
| POST   | /refresh-token         | ❌   | Get new access token               |
| POST   | /logout                | ✅   | Logout (clears refresh token)      |
| GET    | /me                    | ✅   | Get current user                   |
| PUT    | /change-password       | ✅   | Change password                    |

---

### 👤 Users  `/api/users`

| Method | Endpoint         | Role        | Description            |
|--------|------------------|-------------|------------------------|
| GET    | /profile         | All         | Get own profile        |
| PUT    | /profile         | All         | Update name/phone      |
| POST   | /avatar          | All         | Upload profile picture |
| GET    | /order-history   | Customer    | Past orders            |
| GET    | /loyalty         | Customer    | Loyalty points & tier  |

---

### 🍽️ Menu  `/api/menu`

| Method | Endpoint              | Role        | Description               |
|--------|-----------------------|-------------|---------------------------|
| GET    | /                     | Public      | List all items (filters)  |
| GET    | /categories           | Public      | All categories + counts   |
| GET    | /:id                  | Public      | Single item details       |
| POST   | /                     | Admin       | Create menu item + image  |
| PUT    | /:id                  | Admin       | Update menu item          |
| DELETE | /:id                  | Admin       | Delete menu item          |
| PATCH  | /:id/availability     | Admin/Waiter| Toggle availability       |
| POST   | /:id/review           | Customer    | Add rating & review       |

**Query params for GET /:** `category`, `isAvailable`, `isVegetarian`, `isVegan`, `isGlutenFree`, `minPrice`, `maxPrice`, `search`, `sortBy`, `order`, `page`, `limit`, `featured`, `popular`

---

### 🪑 Tables  `/api/tables`

| Method | Endpoint          | Role          | Description              |
|--------|-------------------|---------------|--------------------------|
| GET    | /availability     | Public        | Available tables by date |
| GET    | /                 | All           | All tables               |
| GET    | /:id              | All           | Single table             |
| POST   | /                 | Admin         | Create table             |
| PUT    | /:id              | Admin         | Update table             |
| DELETE | /:id              | Admin         | Remove table             |
| PATCH  | /:id/status       | Admin/Waiter  | Update table status      |

**Query params for /availability:** `date` (YYYY-MM-DD), `timeSlot`, `guests`

---

### 📅 Reservations  `/api/reservations`

| Method | Endpoint          | Role          | Description              |
|--------|-------------------|---------------|--------------------------|
| GET    | /slots            | All           | Available time slots     |
| POST   | /                 | Customer      | Create reservation       |
| GET    | /                 | All           | List (own or all)        |
| GET    | /:id              | All           | Single reservation       |
| PATCH  | /:id/cancel       | Customer/Admin| Cancel                   |
| PATCH  | /:id/status       | Admin/Waiter  | Update status            |

---

### 🛒 Orders  `/api/orders`

| Method | Endpoint          | Role               | Description         |
|--------|-------------------|--------------------|---------------------|
| POST   | /                 | Customer           | Place order         |
| GET    | /                 | All                | List orders         |
| GET    | /:id              | All                | Order details       |
| GET    | /:id/invoice      | All                | Invoice/bill        |
| PATCH  | /:id/cancel       | Customer/Admin     | Cancel order        |
| PATCH  | /:id/status       | Admin/Waiter/Chef  | Update status       |

**Order Status Flow:** `placed → confirmed → preparing → ready → served → completed`

---

### 👨‍🍳 Kitchen  `/api/kitchen`

| Method | Endpoint                   | Role              | Description           |
|--------|----------------------------|-------------------|-----------------------|
| GET    | /orders                    | Admin/Chef/Waiter | Active kitchen orders |
| GET    | /stats                     | Admin/Chef/Waiter | Kitchen statistics    |
| PATCH  | /orders/:id/item-status    | Admin/Chef        | Update item status    |
| PATCH  | /orders/:id/ready          | Admin/Chef        | Mark order as ready   |

---

### 💳 Payments  `/api/payments`

| Method | Endpoint                    | Role          | Description               |
|--------|-----------------------------|---------------|---------------------------|
| POST   | /stripe/create-intent       | Customer      | Create Stripe intent      |
| POST   | /stripe/confirm             | Customer      | Confirm Stripe payment    |
| POST   | /razorpay/create-order      | Customer      | Create Razorpay order     |
| POST   | /razorpay/verify            | Customer      | Verify Razorpay payment   |
| POST   | /cash                       | Admin/Waiter  | Record cash payment       |
| GET    | /                           | All           | List payments             |
| POST   | /:id/refund                 | Admin         | Initiate refund           |

---

### 📦 Inventory  `/api/inventory`

| Method | Endpoint              | Role        | Description          |
|--------|-----------------------|-------------|----------------------|
| GET    | /                     | Admin/Chef  | List inventory       |
| GET    | /alerts/low-stock     | Admin/Chef  | Low stock items      |
| GET    | /:id                  | Admin/Chef  | Single item          |
| POST   | /                     | Admin       | Create item          |
| PUT    | /:id                  | Admin       | Update item          |
| DELETE | /:id                  | Admin       | Delete item          |
| POST   | /:id/restock          | Admin/Chef  | Add stock (purchase) |

---

### 📊 Admin  `/api/admin`

| Method | Endpoint              | Role  | Description             |
|--------|-----------------------|-------|-------------------------|
| GET    | /dashboard            | Admin | Overview stats          |
| GET    | /sales-report         | Admin | Sales data by period    |
| GET    | /popular-dishes       | Admin | Top ordered items       |
| GET    | /revenue-breakdown    | Admin | Revenue by method/cat   |
| GET    | /users                | Admin | All users               |
| POST   | /users/staff          | Admin | Create staff account    |
| PUT    | /users/:id            | Admin | Edit user               |
| DELETE | /users/:id            | Admin | Deactivate user         |

---

### 🔔 Notifications  `/api/notifications`

| Method | Endpoint        | Role | Description           |
|--------|-----------------|------|-----------------------|
| GET    | /               | All  | Get notifications     |
| PATCH  | /read-all       | All  | Mark all as read      |
| PATCH  | /:id/read       | All  | Mark one as read      |
| DELETE | /:id            | All  | Delete notification   |

---

### 📤 Upload  `/api/upload`

| Method | Endpoint   | Role  | Description            |
|--------|------------|-------|------------------------|
| POST   | /image     | Admin | Upload single image    |
| POST   | /images    | Admin | Upload up to 5 images  |

---

## 🔌 Socket.IO Events

**Client → Server:**
| Event              | Payload          | Description              |
|--------------------|------------------|--------------------------|
| `order:track`      | orderId          | Subscribe to order live  |
| `order:untrack`    | orderId          | Unsubscribe             |
| `ping`             | —                | Heartbeat               |

**Server → Client:**
| Event                  | Description                          |
|------------------------|--------------------------------------|
| `connected`            | Welcome on connect                   |
| `order:new`            | New order (kitchen/admin room)       |
| `order:statusUpdate`   | Order status changed                 |
| `order:cancelled`      | Order cancelled                      |
| `order:ready`          | Order ready (waiter room)            |
| `kitchen:itemUpdate`   | Individual item status change        |
| `table:statusUpdate`   | Table status changed                 |
| `reservation:new`      | New reservation (admin room)         |
| `reservation:cancelled`| Reservation cancelled                |
| `payment:success`      | Payment confirmed                    |
| `notification:new`     | New notification for user            |
| `inventory:lowStock`   | Low stock alert (admin room)         |
| `inventory:restocked`  | Item restocked (admin room)          |

**Socket rooms:**
- `{userId}` — personal room per user
- `admin` — all admins
- `chef` — all chefs
- `waiter` — all waiters
- `customer` — all customers
- `order:{orderId}` — order tracking room

---

## 🔧 Environment Variables

See `.env.example` for the full list. Key ones:

```env
MONGODB_URI=mongodb://localhost:27017/restaurant_db
JWT_SECRET=your_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
STRIPE_SECRET_KEY=sk_test_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
CLOUDINARY_CLOUD_NAME=...
```

---

## 🏗️ Tech Stack

- **Runtime:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (access + refresh tokens) + bcryptjs
- **Email/OTP:** Nodemailer (Gmail SMTP)
- **Payments:** Stripe + Razorpay
- **Real-time:** Socket.IO
- **Images:** Cloudinary + Multer
- **Validation:** express-validator
- **Security:** Helmet, CORS, Rate limiting
- **Scheduling:** node-cron

---

## 📌 Notes for Frontend Integration

1. Store `accessToken` in memory, `refreshToken` in httpOnly cookie or localStorage
2. On 401, call `/api/auth/refresh-token` then retry original request
3. Connect Socket.IO with `auth: { token: accessToken }`
4. For Razorpay: load Razorpay SDK in browser, use `rzpOrderId` from API
5. For Stripe: use `@stripe/stripe-js` with `clientSecret` from API
