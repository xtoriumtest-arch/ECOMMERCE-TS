import { Router, Request, Response } from 'express';
import { findRecordById, updateRecord, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { validatePayment } from '../utils/validators';
import { generateId, formatPrice } from '../utils/helpers';
import { Payment, Order, PaymentStatus } from '../types';

const router = Router();

router.get('/:id', (req: Request, res: Response) => {
  const payment = getPaymentById(req.params.id);
  if (!payment) {
    return res.status(404).json(formatErrorResponse({ message: 'Payment not found' }, 404));
  }
  const sanitized = sanitizePaymentData(payment);
  const response = formatResponse(sanitized, 'Payment retrieved');
  res.json(response);
});

router.get('/order/:orderId', (req: Request, res: Response) => {
  const order = findRecordById<Order>('orders', req.params.orderId);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  const payments = getOrderPayments(req.params.orderId);
  const response = formatResponse(payments, 'Order payments retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validatePayment(req.body);
  if (!validation.isValid) {
    return res.status(400).json(formatErrorResponse({ message: JSON.stringify(validation.errors) }, 400));
  }
  
  const order = findRecordById<Order>('orders', req.body.orderId);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  
  const paymentResult = processPayment(req.body);
  if (!paymentResult.success) {
    return res.status(400).json(formatErrorResponse({ message: paymentResult.message }, 400));
  }
  
  const payment = createPaymentRecord(req.body, paymentResult);
  updateOrderPaymentStatus(req.body.orderId, 'paid');
  
  const response = formatResponse(payment, 'Payment processed successfully');
  res.status(201).json(response);
});

router.post('/:id/refund', (req: Request, res: Response) => {
  const payment = getPaymentById(req.params.id);
  if (!payment) {
    return res.status(404).json(formatErrorResponse({ message: 'Payment not found' }, 404));
  }
  
  if (!canRefundPayment(payment)) {
    return res.status(400).json(formatErrorResponse({ message: 'Payment cannot be refunded' }, 400));
  }
  
  const refundResult = processRefund(payment, req.body.amount);
  if (!refundResult.success) {
    return res.status(400).json(formatErrorResponse({ message: refundResult.message }, 400));
  }
  
  const refund = createRefundRecord(payment, refundResult);
  updatePaymentStatus(req.params.id, 'refunded');
  
  const response = formatResponse(refund, 'Refund processed successfully');
  res.json(response);
});

router.get('/methods/available', (req: Request, res: Response) => {
  const methods = getAvailablePaymentMethods();
  const response = formatResponse(methods, 'Payment methods retrieved');
  res.json(response);
});

function getPaymentById(id: string): Payment | undefined {
  const payments = database.payments || [];
  return payments.find(p => p.id === id);
}

function getOrderPayments(orderId: string): Payment[] {
  const payments = database.payments || [];
  return payments.filter(p => p.orderId === orderId);
}

function sanitizePaymentData(payment: Payment): Payment {
  const sanitized = { ...payment };
  if (sanitized.cardNumber) {
    sanitized.cardNumber = maskCardNumber(sanitized.cardNumber);
  }
  return sanitized;
}

function maskCardNumber(cardNumber: string): string {
  const last4 = cardNumber.slice(-4);
  return `****-****-****-${last4}`;
}

function processPayment(paymentData: any): { success: boolean; message?: string; transactionId?: string; timestamp?: Date } {
  const validationResult = validatePaymentDetails(paymentData);
  if (!validationResult.valid) {
    return { success: false, message: validationResult.message };
  }
  
  const chargeResult = simulatePaymentCharge(paymentData);
  return chargeResult;
}

function validatePaymentDetails(data: any): { valid: boolean; message?: string } {
  if (data.method === 'credit_card' || data.method === 'debit_card') {
    return validateCardDetails(data);
  }
  return { valid: true };
}

function validateCardDetails(data: any): { valid: boolean; message?: string } {
  if (!data.cardNumber || !isValidCardNumber(data.cardNumber)) {
    return { valid: false, message: 'Invalid card number' };
  }
  if (!data.expiryDate || !isValidExpiryDate(data.expiryDate)) {
    return { valid: false, message: 'Invalid expiry date' };
  }
  if (!data.cvv || !isValidCVV(data.cvv)) {
    return { valid: false, message: 'Invalid CVV' };
  }
  return { valid: true };
}

function isValidCardNumber(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\D/g, '');
  return cleaned.length >= 13 && cleaned.length <= 19;
}

function isValidExpiryDate(expiryDate: string): boolean {
  const [month, year] = expiryDate.split('/');
  const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
  return expiry > new Date();
}

function isValidCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

function simulatePaymentCharge(paymentData: any) {
  const transactionId = generateTransactionId();
  const timestamp = new Date();
  
  return {
    success: true,
    transactionId,
    timestamp,
    amount: paymentData.amount,
    currency: 'USD'
  };
}

function generateTransactionId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function createPaymentRecord(paymentData: any, result: any): Payment {
  const payment = buildPaymentRecord(paymentData, result);
  if (!database.payments) database.payments = [];
  database.payments.push(payment);
  return payment;
}

function buildPaymentRecord(data: any, result: any): Payment {
  return {
    id: generateId(),
    orderId: data.orderId,
    method: data.method,
    amount: data.amount,
    formattedAmount: formatPrice(data.amount),
    transactionId: result.transactionId,
    status: 'completed',
    cardNumber: data.cardNumber ? maskCardNumber(data.cardNumber) : undefined,
    createdAt: new Date()
  };
}

function updateOrderPaymentStatus(orderId: string, status: string): void {
  updateRecord('orders', orderId, { paymentStatus: status });
}

function canRefundPayment(payment: Payment): boolean {
  const refundableStatuses: PaymentStatus[] = ['completed'];
  const daysSincePayment = calculateDaysSince(payment.createdAt!);
  return refundableStatuses.includes(payment.status) && daysSincePayment <= 30;
}

function calculateDaysSince(date: Date): number {
  const diff = new Date().getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function processRefund(payment: Payment, amount?: number): { success: boolean; message?: string; refundId?: string; amount?: number } {
  const refundAmount = amount || payment.amount;
  
  if (refundAmount > payment.amount) {
    return { success: false, message: 'Refund amount exceeds payment amount' };
  }
  
  const refundId = generateRefundId();
  return { success: true, refundId, amount: refundAmount };
}

function generateRefundId(): string {
  return `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function createRefundRecord(payment: Payment, result: any) {
  return {
    id: generateId(),
    paymentId: payment.id,
    orderId: payment.orderId,
    refundId: result.refundId,
    amount: result.amount,
    formattedAmount: formatPrice(result.amount),
    status: 'completed',
    createdAt: new Date()
  };
}

function updatePaymentStatus(id: string, status: PaymentStatus): void {
  const payments = database.payments || [];
  const index = payments.findIndex(p => p.id === id);
  if (index !== -1) {
    database.payments[index].status = status;
    database.payments[index].updatedAt = new Date();
  }
}

function getAvailablePaymentMethods() {
  return [
    { id: 'credit_card', name: 'Credit Card', icon: 'credit-card', enabled: true },
    { id: 'debit_card', name: 'Debit Card', icon: 'credit-card', enabled: true },
    { id: 'paypal', name: 'PayPal', icon: 'paypal', enabled: true },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: 'bank', enabled: true }
  ];
}

export default router;
