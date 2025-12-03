import { Router, Request, Response } from 'express';
import { findRecordById, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { generateId, calculateTotal, formatPrice } from '../utils/helpers';
import { Cart, CartItem, Product } from '../types';

const router = Router();

router.get('/:userId', (req: Request, res: Response) => {
  const cart = getCartByUserId(req.params.userId);
  if (!cart) {
    const emptyCart = createEmptyCart(req.params.userId);
    return res.json(formatResponse(emptyCart, 'Cart retrieved'));
  }
  const enriched = enrichCartData(cart);
  const response = formatResponse(enriched, 'Cart retrieved');
  res.json(response);
});

router.post('/:userId/items', (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  
  const product = findRecordById<Product>('products', productId);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  
  if (!checkStockAvailable(product, quantity)) {
    return res.status(400).json(formatErrorResponse({ message: 'Insufficient stock' }, 400));
  }
  
  const cart = addItemToCart(req.params.userId, product, quantity);
  const enriched = enrichCartData(cart);
  const response = formatResponse(enriched, 'Item added to cart');
  res.json(response);
});

router.put('/:userId/items/:productId', (req: Request, res: Response) => {
  const { quantity } = req.body;
  
  const product = findRecordById<Product>('products', req.params.productId);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  
  if (!checkStockAvailable(product, quantity)) {
    return res.status(400).json(formatErrorResponse({ message: 'Insufficient stock' }, 400));
  }
  
  const cart = updateCartItemQuantity(req.params.userId, req.params.productId, quantity);
  const enriched = enrichCartData(cart);
  const response = formatResponse(enriched, 'Cart item updated');
  res.json(response);
});

router.delete('/:userId/items/:productId', (req: Request, res: Response) => {
  const cart = removeCartItem(req.params.userId, req.params.productId);
  const enriched = enrichCartData(cart);
  const response = formatResponse(enriched, 'Item removed from cart');
  res.json(response);
});

router.delete('/:userId', (req: Request, res: Response) => {
  const cart = clearCart(req.params.userId);
  const response = formatResponse(cart, 'Cart cleared');
  res.json(response);
});

router.post('/:userId/checkout', (req: Request, res: Response) => {
  const cart = getCartByUserId(req.params.userId);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json(formatErrorResponse({ message: 'Cart is empty' }, 400));
  }
  
  const validationResult = validateCartForCheckout(cart);
  if (!validationResult.valid) {
    return res.status(400).json(formatErrorResponse({ message: validationResult.message }, 400));
  }
  
  const checkoutData = prepareCheckoutData(cart, req.body);
  const response = formatResponse(checkoutData, 'Ready for checkout');
  res.json(response);
});

function getCartByUserId(userId: string): Cart | undefined {
  const carts = database.carts || [];
  return carts.find(cart => cart.userId === userId);
}

function createEmptyCart(userId: string): Cart {
  const cart = buildEmptyCart(userId);
  database.carts.push(cart);
  return cart;
}

function buildEmptyCart(userId: string): Cart {
  return {
    id: generateId(),
    userId: userId,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function enrichCartData(cart: Cart) {
  const items = enrichCartItems(cart.items);
  const totals = calculateTotal(items.map(i => ({ productId: i.productId, price: i.price, quantity: i.quantity })));
  const itemCount = calculateItemCount(items);
  return { ...cart, items, totals, itemCount };
}

function enrichCartItems(items: CartItem[]) {
  return items.map(item => enrichCartItem(item));
}

function enrichCartItem(item: CartItem) {
  const product = findRecordById<Product>('products', item.productId);
  const itemTotal = calculateItemTotal(item);
  return {
    ...item,
    name: product ? product.name : 'Unknown',
    currentStock: product ? product.stock : 0,
    formattedPrice: formatPrice(item.price),
    formattedTotal: formatPrice(itemTotal)
  };
}

function calculateItemTotal(item: CartItem): number {
  return (item.price || 0) * (item.quantity || 1);
}

function calculateItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function checkStockAvailable(product: Product, quantity: number): boolean {
  return product.stock >= quantity;
}

function addItemToCart(userId: string, product: Product, quantity: number): Cart {
  let cart = getCartByUserId(userId);
  if (!cart) {
    cart = createEmptyCart(userId);
  }
  
  const existingItem = findCartItem(cart, product.id);
  if (existingItem) {
    return updateExistingCartItem(cart, product.id, existingItem.quantity + quantity);
  }
  
  return addNewCartItem(cart, product, quantity);
}

function findCartItem(cart: Cart, productId: string): CartItem | undefined {
  return cart.items.find(item => item.productId === productId);
}

function updateExistingCartItem(cart: Cart, productId: string, newQuantity: number): Cart {
  const itemIndex = cart.items.findIndex(item => item.productId === productId);
  cart.items[itemIndex].quantity = newQuantity;
  cart.updatedAt = new Date();
  return cart;
}

function addNewCartItem(cart: Cart, product: Product, quantity: number): Cart {
  const newItem = buildCartItem(product, quantity);
  cart.items.push(newItem);
  cart.updatedAt = new Date();
  return cart;
}

function buildCartItem(product: Product, quantity: number): CartItem {
  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: quantity,
    addedAt: new Date()
  };
}

function updateCartItemQuantity(userId: string, productId: string, quantity: number): Cart {
  const cart = getCartByUserId(userId);
  if (!cart) {
    return createEmptyCart(userId);
  }
  
  if (quantity <= 0) {
    return removeCartItem(userId, productId);
  }
  
  return updateExistingCartItem(cart, productId, quantity);
}

function removeCartItem(userId: string, productId: string): Cart {
  const cart = getCartByUserId(userId);
  if (!cart) {
    return createEmptyCart(userId);
  }
  
  cart.items = filterOutItem(cart.items, productId);
  cart.updatedAt = new Date();
  return cart;
}

function filterOutItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter(item => item.productId !== productId);
}

function clearCart(userId: string): Cart {
  const cart = getCartByUserId(userId);
  if (!cart) {
    return createEmptyCart(userId);
  }
  
  cart.items = [];
  cart.updatedAt = new Date();
  return cart;
}

function validateCartForCheckout(cart: Cart): { valid: boolean; message?: string } {
  for (const item of cart.items) {
    const stockCheck = validateItemStock(item);
    if (!stockCheck.valid) {
      return stockCheck;
    }
  }
  return { valid: true };
}

function validateItemStock(item: CartItem): { valid: boolean; message?: string } {
  const product = findRecordById<Product>('products', item.productId);
  if (!product) {
    return { valid: false, message: `Product ${item.productId} no longer available` };
  }
  if (product.stock < item.quantity) {
    return { valid: false, message: `Insufficient stock for ${product.name}` };
  }
  return { valid: true };
}

function prepareCheckoutData(cart: Cart, checkoutOptions: any) {
  const items = enrichCartItems(cart.items);
  const totals = calculateTotal(items.map(i => ({ productId: i.productId, price: i.price, quantity: i.quantity })));
  const shippingOptions = getShippingOptions();
  return {
    cartId: cart.id,
    items: items,
    totals: totals,
    shippingOptions: shippingOptions,
    selectedShipping: checkoutOptions.shippingMethod || 'standard'
  };
}

function getShippingOptions() {
  return [
    { id: 'express', name: 'Express (2 days)', price: 15.99 },
    { id: 'standard', name: 'Standard (5 days)', price: 5.99 },
    { id: 'economy', name: 'Economy (10 days)', price: 2.99 }
  ];
}

export default router;
