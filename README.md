# TypeScript E-Commerce API

A comprehensive e-commerce REST API built with TypeScript and Express for testing Xtorium's dependency map feature.

## Features

- **Products** - CRUD operations, search, filtering, categories
- **Users** - Authentication, profile management
- **Orders** - Order lifecycle, tracking, invoices
- **Cart** - Shopping cart management, checkout
- **Categories** - Hierarchical category management
- **Reviews** - Product reviews and ratings
- **Payments** - Payment processing, refunds
- **Shipping** - Shipping rates, tracking
- **Analytics** - Dashboard, sales, revenue metrics

## Tech Stack

- TypeScript
- Express.js
- Node.js

## Installation

```bash
npm install
```

## Building

```bash
npm run build
```

## Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

## Project Structure

```
src/
├── app.ts              # Application entry point
├── types/              # TypeScript interfaces
├── routes/             # API route handlers
├── utils/              # Utility functions
└── middleware/         # Express middleware
```

## API Endpoints

### Products
- `GET /api/products` - List all products
- `GET /api/products/featured` - Get featured products
- `GET /api/products/search` - Search products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user
- `POST /api/users/login` - User login
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Orders
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order
- `GET /api/orders/:id/tracking` - Get tracking
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update status
- `POST /api/orders/:id/cancel` - Cancel order

### Analytics
- `GET /api/analytics/dashboard` - Dashboard metrics
- `GET /api/analytics/sales` - Sales data
- `GET /api/analytics/products` - Product analytics
- `GET /api/analytics/customers` - Customer analytics
- `GET /api/analytics/revenue` - Revenue analytics

## License

MIT
