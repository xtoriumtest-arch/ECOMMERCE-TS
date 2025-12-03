export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  stock: number;
  description?: string;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: 'customer' | 'admin';
  addresses?: Address[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  zipCode: string;
  country?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  shippingMethod?: string;
  status: OrderStatus;
  paymentStatus?: string;
  shippingStatus?: string;
  totals?: OrderTotals;
  createdAt?: Date;
  confirmedAt?: Date;
  processingAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  updatedAt?: Date;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name?: string;
  price: number;
  quantity: number;
  weight?: number;
  discountPercent?: number;
}

export interface OrderTotals {
  subtotal: string;
  tax: string;
  shipping: string;
  total: string;
  rawTotal: number;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartItem {
  productId: string;
  name?: string;
  price: number;
  quantity: number;
  addedAt?: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  slug?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  content?: string;
  helpfulCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  formattedAmount?: string;
  transactionId?: string;
  cardNumber?: string;
  status: PaymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentMethod = 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed';

export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  shippingMethod: string;
  trackingNumber: string;
  status: ShipmentStatus;
  origin: Address;
  destination: Address;
  trackingEvents: TrackingEvent[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type ShipmentStatus = 'created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered';

export interface TrackingEvent {
  status: string;
  description: string;
  location: string;
  timestamp: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    currentPage: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface Database {
  products: Product[];
  users: User[];
  orders: Order[];
  carts: Cart[];
  categories: Category[];
  reviews: Review[];
  payments: Payment[];
  shipments: Shipment[];
}
