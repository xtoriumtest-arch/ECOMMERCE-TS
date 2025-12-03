import { Product, User, Order, Payment, Address, ValidationResult, ValidationError } from '../types';

export function validateProduct(product: Partial<Product>): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!validateRequiredField(product.name)) {
    errors.push(createValidationError('name', 'Product name is required'));
  }
  
  if (!validatePrice(product.price)) {
    errors.push(createValidationError('price', 'Valid price is required'));
  }
  
  if (!validateStock(product.stock)) {
    errors.push(createValidationError('stock', 'Valid stock quantity is required'));
  }
  
  return buildValidationResult(errors);
}

export function validateUser(user: Partial<User & { password?: string }>): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!validateRequiredField(user.email)) {
    errors.push(createValidationError('email', 'Email is required'));
  } else if (!validateEmailFormat(user.email!)) {
    errors.push(createValidationError('email', 'Invalid email format'));
  }
  
  if (!validateRequiredField(user.name)) {
    errors.push(createValidationError('name', 'Name is required'));
  }
  
  if (!validatePassword(user.password)) {
    errors.push(createValidationError('password', 'Password must be at least 8 characters'));
  }
  
  return buildValidationResult(errors);
}

export function validateOrder(order: Partial<Order>): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!validateRequiredField(order.userId)) {
    errors.push(createValidationError('userId', 'User ID is required'));
  }
  
  if (!validateOrderItems(order.items)) {
    errors.push(createValidationError('items', 'Order must have at least one item'));
  }
  
  if (!validateShippingAddress(order.shippingAddress)) {
    errors.push(createValidationError('shippingAddress', 'Valid shipping address is required'));
  }
  
  return buildValidationResult(errors);
}

export function validatePayment(payment: Partial<Payment>): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!validateRequiredField(payment.orderId)) {
    errors.push(createValidationError('orderId', 'Order ID is required'));
  }
  
  if (!validatePaymentMethod(payment.method)) {
    errors.push(createValidationError('method', 'Valid payment method is required'));
  }
  
  if (!validatePaymentAmount(payment.amount)) {
    errors.push(createValidationError('amount', 'Valid payment amount is required'));
  }
  
  return buildValidationResult(errors);
}

export function validateRequiredField(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function validatePrice(price: unknown): boolean {
  const numPrice = parseFloat(String(price));
  return !isNaN(numPrice) && numPrice > 0;
}

function validateStock(stock: unknown): boolean {
  const numStock = parseInt(String(stock));
  return !isNaN(numStock) && numStock >= 0;
}

export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: unknown): boolean {
  return typeof password === 'string' && password.length >= 8;
}

function validateOrderItems(items: unknown): boolean {
  return Array.isArray(items) && items.length > 0;
}

function validateShippingAddress(address: unknown): boolean {
  if (!address) return false;
  const addr = address as Address;
  return validateRequiredField(addr.street) && 
         validateRequiredField(addr.city) && 
         validateRequiredField(addr.zipCode);
}

function validatePaymentMethod(method: unknown): boolean {
  const validMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer'];
  return typeof method === 'string' && validMethods.includes(method);
}

function validatePaymentAmount(amount: unknown): boolean {
  return validatePrice(amount);
}

function createValidationError(field: string, message: string): ValidationError {
  return { field, message };
}

function buildValidationResult(errors: ValidationError[]): ValidationResult {
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}
