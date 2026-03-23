export interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  stock: number;
  cat: string;
  sub: string;
  img?: string;
  images?: string[];
  description?: string;
  unit?: string;
  status?: 'active' | 'inactive';
  rating?: number;
  reviewCount?: number;
  soldCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  imageUrl?: string;
  productImage?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'returned'
  | 'refunded';
export type PaymentMethod = 'cod' | 'vnpay' | 'momo';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface Order {
  id: string;
  orderId?: string;
  dbId?: string;
  userId?: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  totalAmount: number;
  voucherCode?: string;
  deliverySlot?: string;
  note?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  vnpayTxnRef?: string;
}

export interface DeliverySlot {
  id: string;
  date: string;
  window: string;
  capacity: number;
  used: number;
}

export interface VoucherResult {
  ok: boolean;
  type?: 'ship' | 'percent' | 'fixed';
  value?: number;
  cap?: number;
  message: string;
  warning?: string;
  expiresAt?: string | null;
  daysLeft?: number | null;
}

export interface Recommendation {
  product_id: string | number;
  score: number;
  name: string;
  price: number;
  image: string;
  category: string;
  reason: string;
}
