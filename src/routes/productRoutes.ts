import { Router, Request, Response } from 'express';
import { executeQuery, findRecordById, insertRecord, updateRecord, deleteRecord } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { validateProduct, validateRequiredField } from '../utils/validators';
import { generateId, formatPrice, calculateSubtotal } from '../utils/helpers';
import { Product } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const products = getAllProducts();
  const formattedProducts = formatProductList(products);
  const response = formatResponse(formattedProducts, 'Products retrieved successfully');
  res.json(response);
});

router.get('/featured', (req: Request, res: Response) => {
  const products = getAllProducts();
  const featured = filterFeaturedProducts(products);
  const response = formatResponse(featured, 'Featured products retrieved');
  res.json(response);
});

router.get('/search', (req: Request, res: Response) => {
  const { query, category, minPrice, maxPrice } = req.query;
  const products = getAllProducts();
  const filtered = searchProducts(products, query as string, category as string, minPrice as string, maxPrice as string);
  const sorted = sortProductsByRelevance(filtered, query as string);
  const response = formatResponse(sorted, 'Search results');
  res.json(response);
});

router.get('/category/:categoryId', (req: Request, res: Response) => {
  const products = getAllProducts();
  const filtered = filterByCategory(products, req.params.categoryId);
  const response = formatResponse(filtered, 'Products by category');
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const product = getProductById(req.params.id);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  const enriched = enrichProductData(product);
  const response = formatResponse(enriched, 'Product retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateProduct(req.body);
  if (!validation.isValid) {
    return res.status(400).json(formatErrorResponse({ message: JSON.stringify(validation.errors) }, 400));
  }
  const product = createProduct(req.body);
  const response = formatResponse(product, 'Product created successfully');
  res.status(201).json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const existingProduct = getProductById(req.params.id);
  if (!existingProduct) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  const updated = updateProductData(req.params.id, req.body);
  const response = formatResponse(updated, 'Product updated successfully');
  res.json(response);
});

router.patch('/:id/stock', (req: Request, res: Response) => {
  const product = getProductById(req.params.id);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  const updated = updateProductStock(req.params.id, req.body.quantity);
  const response = formatResponse(updated, 'Stock updated');
  res.json(response);
});

router.delete('/:id', (req: Request, res: Response) => {
  const product = getProductById(req.params.id);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  const deleted = removeProduct(req.params.id);
  const response = formatResponse(deleted, 'Product deleted');
  res.json(response);
});

function getAllProducts(): Product[] {
  const result = executeQuery<Product[]>('products', 'findAll');
  return result.data || [];
}

function getProductById(id: string): Product | undefined {
  return findRecordById<Product>('products', id);
}

function formatProductList(products: Product[]): Product[] {
  return products.map(product => formatProductItem(product));
}

function formatProductItem(product: Product): Product & { formattedPrice: string } {
  return {
    ...product,
    formattedPrice: formatPrice(product.price)
  };
}

function filterFeaturedProducts(products: Product[]): Product[] {
  const featured = products.filter(p => isFeaturedProduct(p));
  return formatProductList(featured);
}

function isFeaturedProduct(product: Product): boolean {
  return product.price > 500 || product.stock < 20;
}

function searchProducts(products: Product[], query?: string, category?: string, minPrice?: string, maxPrice?: string): Product[] {
  let filtered = products;
  if (query) filtered = filterBySearchQuery(filtered, query);
  if (category) filtered = filterByCategory(filtered, category);
  if (minPrice) filtered = filterByMinPrice(filtered, parseFloat(minPrice));
  if (maxPrice) filtered = filterByMaxPrice(filtered, parseFloat(maxPrice));
  return filtered;
}

function filterBySearchQuery(products: Product[], query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(p => matchesSearchQuery(p, lowerQuery));
}

function matchesSearchQuery(product: Product, query: string): boolean {
  return product.name.toLowerCase().includes(query);
}

function filterByCategory(products: Product[], categoryId: string): Product[] {
  return products.filter(p => p.categoryId === categoryId);
}

function filterByMinPrice(products: Product[], minPrice: number): Product[] {
  return products.filter(p => p.price >= minPrice);
}

function filterByMaxPrice(products: Product[], maxPrice: number): Product[] {
  return products.filter(p => p.price <= maxPrice);
}

function sortProductsByRelevance(products: Product[], query?: string): Product[] {
  if (!query) return products;
  return products.sort((a, b) => calculateRelevanceScore(b, query) - calculateRelevanceScore(a, query));
}

function calculateRelevanceScore(product: Product, query: string): number {
  let score = 0;
  if (product.name.toLowerCase().startsWith(query.toLowerCase())) score += 10;
  if (product.name.toLowerCase().includes(query.toLowerCase())) score += 5;
  return score;
}

function enrichProductData(product: Product): Product & { availability: any; priceInfo: any } {
  const availability = checkProductAvailability(product);
  const priceInfo = calculatePriceInfo(product);
  return { ...product, availability, priceInfo };
}

function checkProductAvailability(product: Product) {
  return {
    inStock: product.stock > 0,
    quantity: product.stock,
    status: getAvailabilityStatus(product.stock)
  };
}

function getAvailabilityStatus(stock: number): string {
  if (stock === 0) return 'out_of_stock';
  if (stock < 10) return 'low_stock';
  return 'in_stock';
}

function calculatePriceInfo(product: Product) {
  const originalPrice = product.price;
  const discountedPrice = applyProductDiscount(originalPrice);
  return {
    original: formatPrice(originalPrice),
    discounted: formatPrice(discountedPrice),
    savings: formatPrice(originalPrice - discountedPrice)
  };
}

function applyProductDiscount(price: number): number {
  return price * 0.9;
}

function createProduct(productData: Partial<Product>): Product {
  const newProduct = buildProductObject(productData);
  return insertRecord<Product>('products', newProduct);
}

function buildProductObject(data: Partial<Product>): Product {
  return {
    id: generateId(),
    name: data.name || '',
    price: parseFloat(String(data.price)) || 0,
    categoryId: data.categoryId || '',
    stock: parseInt(String(data.stock)) || 0,
    description: data.description || ''
  };
}

function updateProductData(id: string, updates: Partial<Product>): Product | null {
  return updateRecord<Product>('products', id, updates);
}

function updateProductStock(id: string, quantity: number): Product | null {
  return updateRecord<Product>('products', id, { stock: quantity });
}

function removeProduct(id: string): Product | null {
  return deleteRecord<Product>('products', id);
}

export default router;
