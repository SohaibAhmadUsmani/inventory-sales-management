# Inventory & Sales Management System

Full-stack web application for managing products, inventory, customers, sales, suppliers, and business reports.

## Tech Stack

- **Backend:** Node.js, Express, MongoDB, Mongoose, JWT
- **Frontend:** React, Vite, React Router, Recharts, Axios

## Project Structure

```
inventory-sales-management/
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── seeder.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)

### Backend Setup
```bash
cd backend
cp .env.example .env   # Edit with your MongoDB URI and JWT secret
npm install
npm run seed            # Seeds admin/staff users and sample categories
npm run dev             # Starts server on port 5000
```

**Default Login Credentials:**
- Admin: `admin@example.com` / `admin123`
- Staff: `staff@example.com` / `staff123`

### Frontend Setup
```bash
cd frontend
cp .env.example .env    # Edit API URL if needed
npm install
npm run dev             # Starts dev server on port 3000
```

## API Routes

| Module       | Routes                              |
|-------------|--------------------------------------|
| Auth         | `/api/auth/*`                        |
| Users        | `/api/users/*` (admin only)          |
| Products     | `/api/products/*`                    |
| Categories   | `/api/categories/*`                  |
| Inventory    | `/api/inventory/*`                   |
| Sales        | `/api/sales/*`                       |
| Customers    | `/api/customers/*`                   |
| Suppliers    | `/api/suppliers/*`                   |
| Purchases    | `/api/purchases/*`                   |
| Dashboard    | `/api/dashboard`                     |
| Reports      | `/api/reports/*` (admin only)        |
| Notifications| `/api/notifications/*`               |
| Activity Log | `/api/activity-log` (admin only)     |

## Roles

- **Admin:** Full access to all features
- **Staff:** Sales, inventory, products, customers access
