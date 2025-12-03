import { Router, Request, Response } from 'express';
import { executeQuery, findRecordById, insertRecord, updateRecord } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { validateOrder } from '../utils/validators';
import { generateId, calculateTotal, formatPrice } from '../utils/helpers';
import { Order, OrderItem, OrderStatus } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const orders = getAllOrders();
  const enriched = enrichOrderList(orders);
  const response = formatResponse(enriched, 'Orders retrieved');
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  const enriched = enrichOrderData(order);
  const response = formatResponse(enriched, 'Order retrieved');
  res.json(response);
});

router.get('/:id/tracking', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  const tracking = getOrderTracking(order);
  const response = formatResponse(tracking, 'Tracking info retrieved');
  res.json(response);
});

router.get('/:id/invoice', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  const invoice = generateInvoice(order);
  const response = formatResponse(invoice, 'Invoice generated');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateOrder(req.body);
  if (!validation.isValid) {
    return res.status(400).json(formatErrorResponse({ message: JSON.stringify(validation.errors) }, 400));
  }
  
  const stockCheck = validateStockAvailability(req.body.items);
  if (!stockCheck.available) {
    return res.status(400).json(formatErrorResponse({ message: stockCheck.message }, 400));
  }
  
  const order = createOrder(req.body);
  updateProductStock(order.items);
  
  const response = formatResponse(order, 'Order created successfully');
  res.status(201).json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  
  if (!canModifyOrder(order)) {
    return res.status(400).json(formatErrorResponse({ message: 'Order cannot be modified' }, 400));
  }
  
  const updated = updateOrderData(req.params.id, req.body);
  const response = formatResponse(updated, 'Order updated');
  res.json(response);
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  
  const { status } = req.body;
  if (!isValidStatusTransition(order.status, status)) {
    return res.status(400).json(formatErrorResponse({ message: 'Invalid status transition' }, 400));
  }
  
  const updated = updateOrderStatus(req.params.id, status);
  const response = formatResponse(updated, 'Order status updated');
  res.json(response);
});

router.post('/:id/cancel', (req: Request, res: Response) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  
  if (!canCancelOrder(order)) {
    return res.status(400).json(formatErrorResponse({ message: 'Order cannot be cancelled' }, 400));
  }
  
  const cancelled = cancelOrder(req.params.id);
  restoreProductStock(order.items);
  
  const response = formatResponse(cancelled, 'Order cancelled');
  res.json(response);
});

function getAllOrders(): Order[] {
  const result = executeQuery<Order[]>('orders', 'findAll');
  return result.data || [];
}

function getOrderById(id: string): Order | undefined {
  return findRecordById<Order>('orders', id);
}

function enrichOrderList(orders: Order[]) {
  return orders.map(order => enrichOrderData(order));
}

function enrichOrderData(order: Order) {
  const totals = calculateTotal(order.items || []);
  const statusInfo = getOrderStatusInfo(order.status);
  return { ...order, totals, statusInfo };
}

function getOrderStatusInfo(status: OrderStatus) {
  const statusMap = buildStatusMap();
  return statusMap[status] || { label: 'Unknown', progress: 0 };
}

function buildStatusMap(): Record<OrderStatus, { label: string; progress: number }> {
  return {
    pending: { label: 'Pending', progress: 10 },
    confirmed: { label: 'Confirmed', progress: 25 },
    processing: { label: 'Processing', progress: 50 },
    shipped: { label: 'Shipped', progress: 75 },
    delivered: { label: 'Delivered', progress: 100 },
    cancelled: { label: 'Cancelled', progress: 0 }
  };
}

function getOrderTracking(order: Order) {
  const events = buildTrackingEvents(order);
  const estimatedDelivery = calculateEstimatedDelivery(order);
  return { orderId: order.id, events, estimatedDelivery };
}

function buildTrackingEvents(order: Order) {
  const events: { description: string; timestamp: Date }[] = [];
  events.push(createTrackingEvent('Order placed', order.createdAt));
  if (order.status !== 'pending') {
    events.push(createTrackingEvent('Order confirmed', order.confirmedAt));
  }
  return events;
}

function createTrackingEvent(description: string, timestamp?: Date) {
  return { description, timestamp: timestamp || new Date() };
}

function calculateEstimatedDelivery(order: Order): string {
  const baseDate = new Date(order.createdAt || Date.now());
  const deliveryDays = getDeliveryDays(order.shippingMethod);
  baseDate.setDate(baseDate.getDate() + deliveryDays);
  return baseDate.toISOString();
}

function getDeliveryDays(method?: string): number {
  const deliveryMap: Record<string, number> = { express: 2, standard: 5, economy: 10 };
  return deliveryMap[method || 'standard'] || 5;
}

function generateInvoice(order: Order) {
  const invoiceNumber = generateInvoiceNumber(order);
  const lineItems = generateLineItems(order.items);
  const totals = calculateTotal(order.items || []);
  return { invoiceNumber, orderId: order.id, date: new Date().toISOString(), lineItems, totals };
}

function generateInvoiceNumber(order: Order): string {
  return `INV-${order.id.substring(0, 8).toUpperCase()}`;
}

function generateLineItems(items: OrderItem[]) {
  return (items || []).map((item, index) => ({
    lineNumber: index + 1,
    productId: item.productId,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: formatPrice(item.price),
    total: formatPrice(item.price * item.quantity)
  }));
}

function validateStockAvailability(items: OrderItem[]): { available: boolean; message?: string } {
  for (const item of items || []) {
    const product = findRecordById<any>('products', item.productId);
    if (!product) {
      return { available: false, message: `Product ${item.productId} not found` };
    }
    if (product.stock < item.quantity) {
      return { available: false, message: `Insufficient stock for ${product.name}` };
    }
  }
  return { available: true };
}

function createOrder(orderData: Partial<Order>): Order {
  const newOrder = buildOrderObject(orderData);
  return insertRecord<Order>('orders', newOrder);
}

function buildOrderObject(data: Partial<Order>): Order {
  const orderId = generateId();
  const items = enrichOrderItems(data.items || []);
  const totals = calculateTotal(items);
  return {
    id: orderId,
    userId: data.userId || '',
    items: items,
    shippingAddress: data.shippingAddress || { street: '', city: '', zipCode: '' },
    shippingMethod: data.shippingMethod || 'standard',
    status: 'pending',
    totals: totals,
    createdAt: new Date()
  };
}

function enrichOrderItems(items: OrderItem[]): OrderItem[] {
  return items.map(item => {
    const product = findRecordById<any>('products', item.productId);
    return {
      ...item,
      name: product ? product.name : 'Unknown',
      price: product ? product.price : 0
    };
  });
}

function updateProductStock(items: OrderItem[]): void {
  for (const item of items || []) {
    const product = findRecordById<any>('products', item.productId);
    if (product) {
      updateRecord('products', product.id, { stock: product.stock - item.quantity });
    }
  }
}

function canModifyOrder(order: Order): boolean {
  const modifiableStatuses: OrderStatus[] = ['pending', 'confirmed'];
  return modifiableStatuses.includes(order.status);
}

function updateOrderData(id: string, updates: Partial<Order>): Order | null {
  const safeUpdates = filterOrderUpdates(updates);
  return updateRecord<Order>('orders', id, safeUpdates);
}

function filterOrderUpdates(updates: Partial<Order>): Partial<Order> {
  const { id, createdAt, ...safe } = updates;
  return safe;
}

function isValidStatusTransition(current: OrderStatus, newStatus: OrderStatus): boolean {
  const transitions = getValidTransitions();
  return transitions[current]?.includes(newStatus) || false;
}

function getValidTransitions(): Record<OrderStatus, OrderStatus[]> {
  return {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
  };
}

function updateOrderStatus(id: string, status: OrderStatus): Order | null {
  return updateRecord<Order>('orders', id, { status });
}

function canCancelOrder(order: Order): boolean {
  const cancellableStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing'];
  return cancellableStatuses.includes(order.status);
}

function cancelOrder(id: string): Order | null {
  return updateOrderStatus(id, 'cancelled');
}

function restoreProductStock(items: OrderItem[]): void {
  for (const item of items || []) {
    const product = findRecordById<any>('products', item.productId);
    if (product) {
      updateRecord('products', product.id, { stock: product.stock + item.quantity });
    }
  }
}

export default router;
