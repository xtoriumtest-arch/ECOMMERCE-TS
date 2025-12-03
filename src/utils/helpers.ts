import { OrderItem, OrderTotals } from '../types';

export function generateId(): string {
  const timestamp = getTimestamp();
  const random = generateRandomString(8);
  return formatIdString(timestamp, random);
}

function getTimestamp(): string {
  return Date.now().toString(36);
}

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatIdString(timestamp: string, random: string): string {
  return `${timestamp}-${random}`;
}

export function formatPrice(amount: number): string {
  const validated = validateAmount(amount);
  const rounded = roundToDecimals(validated, 2);
  return formatCurrency(rounded);
}

function validateAmount(amount: number): number {
  const parsed = parseFloat(String(amount));
  return isNaN(parsed) ? 0 : parsed;
}

export function roundToDecimals(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function calculateTotal(items: OrderItem[]): OrderTotals {
  const subtotal = calculateSubtotal(items);
  const tax = calculateTax(subtotal);
  const shipping = calculateShippingCost(items);
  return computeFinalTotal(subtotal, tax, shipping);
}

export function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = calculateItemTotal(item);
    return sum + itemTotal;
  }, 0);
}

function calculateItemTotal(item: OrderItem): number {
  const price = item.price || 0;
  const quantity = item.quantity || 1;
  const discount = applyDiscount(price, item.discountPercent);
  return discount * quantity;
}

export function applyDiscount(price: number, discountPercent?: number): number {
  if (!discountPercent) return price;
  const discountAmount = calculateDiscountAmount(price, discountPercent);
  return price - discountAmount;
}

function calculateDiscountAmount(price: number, percent: number): number {
  return (price * percent) / 100;
}

export function calculateTax(subtotal: number): number {
  const taxRate = getTaxRate();
  return roundToDecimals(subtotal * taxRate, 2);
}

function getTaxRate(): number {
  return 0.08;
}

export function calculateShippingCost(items: OrderItem[]): number {
  const totalWeight = calculateTotalWeight(items);
  const baseRate = getBaseShippingRate();
  return calculateWeightBasedShipping(totalWeight, baseRate);
}

function calculateTotalWeight(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + (item.weight || 0.5), 0);
}

function getBaseShippingRate(): number {
  return 5.99;
}

function calculateWeightBasedShipping(weight: number, baseRate: number): number {
  const weightSurcharge = weight * 0.5;
  return roundToDecimals(baseRate + weightSurcharge, 2);
}

function computeFinalTotal(subtotal: number, tax: number, shipping: number): OrderTotals {
  const total = subtotal + tax + shipping;
  return {
    subtotal: formatPrice(subtotal),
    tax: formatPrice(tax),
    shipping: formatPrice(shipping),
    total: formatPrice(total),
    rawTotal: total
  };
}
