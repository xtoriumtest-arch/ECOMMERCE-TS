import { Router, Request, Response } from 'express';
import { database } from '../utils/database';
import { formatResponse } from '../utils/responseFormatter';
import { formatPrice, calculateSubtotal } from '../utils/helpers';
import { Order, Product, User, OrderItem } from '../types';

const router = Router();

router.get('/dashboard', (req: Request, res: Response) => {
  const dashboardData = getDashboardMetrics();
  const response = formatResponse(dashboardData, 'Dashboard data retrieved');
  res.json(response);
});

router.get('/sales', (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const salesData = getSalesAnalytics(startDate as string, endDate as string);
  const response = formatResponse(salesData, 'Sales analytics retrieved');
  res.json(response);
});

router.get('/products', (req: Request, res: Response) => {
  const productAnalytics = getProductAnalytics();
  const response = formatResponse(productAnalytics, 'Product analytics retrieved');
  res.json(response);
});

router.get('/customers', (req: Request, res: Response) => {
  const customerAnalytics = getCustomerAnalytics();
  const response = formatResponse(customerAnalytics, 'Customer analytics retrieved');
  res.json(response);
});

router.get('/orders', (req: Request, res: Response) => {
  const orderAnalytics = getOrderAnalytics();
  const response = formatResponse(orderAnalytics, 'Order analytics retrieved');
  res.json(response);
});

router.get('/revenue', (req: Request, res: Response) => {
  const revenueData = getRevenueAnalytics();
  const response = formatResponse(revenueData, 'Revenue analytics retrieved');
  res.json(response);
});

function getDashboardMetrics() {
  const orders = database.orders || [];
  const products = database.products || [];
  const users = database.users || [];
  
  return {
    totalOrders: calculateTotalOrders(orders),
    totalRevenue: calculateTotalRevenue(orders),
    totalProducts: countTotalProducts(products),
    totalCustomers: countTotalCustomers(users),
    recentOrders: getRecentOrders(orders, 5),
    topProducts: getTopProducts(orders, 5),
    ordersByStatus: groupOrdersByStatus(orders)
  };
}

function calculateTotalOrders(orders: Order[]): number {
  return orders.length;
}

function calculateTotalRevenue(orders: Order[]) {
  const total = orders.reduce((sum, order) => {
    const orderTotal = extractOrderTotal(order);
    return sum + orderTotal;
  }, 0);
  return { value: total, formatted: formatPrice(total) };
}

function extractOrderTotal(order: Order): number {
  if (order.totals && order.totals.rawTotal) {
    return order.totals.rawTotal;
  }
  return calculateSubtotal(order.items || []);
}

function countTotalProducts(products: Product[]): number {
  return products.length;
}

function countTotalCustomers(users: User[]): number {
  return users.filter(u => u.role === 'customer').length;
}

function getRecentOrders(orders: Order[], limit: number) {
  const sorted = sortOrdersByDate(orders);
  const recent = sorted.slice(0, limit);
  return formatOrderSummaries(recent);
}

function sortOrdersByDate(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
}

function formatOrderSummaries(orders: Order[]) {
  return orders.map(order => ({
    id: order.id,
    status: order.status,
    total: order.totals?.total || formatPrice(0),
    createdAt: order.createdAt
  }));
}

function getTopProducts(orders: Order[], limit: number) {
  const productSales = aggregateProductSales(orders);
  const sorted = sortByQuantity(productSales);
  return sorted.slice(0, limit);
}

function aggregateProductSales(orders: Order[]) {
  const salesMap = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();
  
  for (const order of orders) {
    processOrderItems(order.items || [], salesMap);
  }
  
  return Array.from(salesMap.values());
}

function processOrderItems(items: OrderItem[], salesMap: Map<string, any>): void {
  for (const item of items) {
    updateProductSalesMap(salesMap, item);
  }
}

function updateProductSalesMap(salesMap: Map<string, any>, item: OrderItem): void {
  const productId = item.productId;
  if (!salesMap.has(productId)) {
    salesMap.set(productId, createProductSalesEntry(item));
  }
  incrementProductSales(salesMap.get(productId), item);
}

function createProductSalesEntry(item: OrderItem) {
  return {
    productId: item.productId,
    productName: item.name,
    quantity: 0,
    revenue: 0
  };
}

function incrementProductSales(entry: any, item: OrderItem): void {
  entry.quantity += item.quantity || 1;
  entry.revenue += (item.price || 0) * (item.quantity || 1);
}

function sortByQuantity(products: any[]): any[] {
  return [...products].sort((a, b) => b.quantity - a.quantity);
}

function groupOrdersByStatus(orders: Order[]) {
  const statusGroups = initializeStatusGroups();
  
  for (const order of orders) {
    incrementStatusCount(statusGroups, order.status);
  }
  
  return statusGroups;
}

function initializeStatusGroups() {
  return {
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };
}

function incrementStatusCount(groups: any, status: string): void {
  if (groups.hasOwnProperty(status)) {
    groups[status]++;
  }
}

function getSalesAnalytics(startDate?: string, endDate?: string) {
  const orders = filterOrdersByDateRange(database.orders || [], startDate, endDate);
  
  return {
    totalSales: calculateTotalRevenue(orders),
    orderCount: orders.length,
    averageOrderValue: calculateAverageOrderValue(orders),
    salesByDay: groupSalesByDay(orders),
    salesByCategory: groupSalesByCategory(orders)
  };
}

function filterOrdersByDateRange(orders: Order[], startDate?: string, endDate?: string): Order[] {
  return orders.filter(order => {
    const orderDate = new Date(order.createdAt!);
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    return orderDate >= start && orderDate <= end;
  });
}

function calculateAverageOrderValue(orders: Order[]) {
  if (orders.length === 0) return { value: 0, formatted: formatPrice(0) };
  
  const total = calculateTotalRevenue(orders).value;
  const average = total / orders.length;
  
  return { value: Math.round(average * 100) / 100, formatted: formatPrice(average) };
}

function groupSalesByDay(orders: Order[]) {
  const dailySales: Record<string, { orders: number; revenue: number }> = {};
  
  for (const order of orders) {
    const date = formatDateKey(order.createdAt!);
    updateDailySales(dailySales, date, order);
  }
  
  return dailySales;
}

function formatDateKey(date: Date): string {
  return new Date(date).toISOString().split('T')[0];
}

function updateDailySales(dailySales: Record<string, any>, date: string, order: Order): void {
  if (!dailySales[date]) {
    dailySales[date] = { orders: 0, revenue: 0 };
  }
  dailySales[date].orders++;
  dailySales[date].revenue += extractOrderTotal(order);
}

function groupSalesByCategory(orders: Order[]) {
  const categorySales: Record<string, { quantity: number; revenue: number }> = {};
  
  for (const order of orders) {
    processCategorySales(order.items || [], categorySales);
  }
  
  return categorySales;
}

function processCategorySales(items: OrderItem[], categorySales: Record<string, any>): void {
  for (const item of items) {
    const product = database.products.find(p => p.id === item.productId);
    const categoryId = product ? product.categoryId : 'unknown';
    updateCategorySales(categorySales, categoryId, item);
  }
}

function updateCategorySales(categorySales: Record<string, any>, categoryId: string, item: OrderItem): void {
  if (!categorySales[categoryId]) {
    categorySales[categoryId] = { quantity: 0, revenue: 0 };
  }
  categorySales[categoryId].quantity += item.quantity || 1;
  categorySales[categoryId].revenue += (item.price || 0) * (item.quantity || 1);
}

function getProductAnalytics() {
  const products = database.products || [];
  const orders = database.orders || [];
  
  return {
    totalProducts: products.length,
    inStock: countInStockProducts(products),
    outOfStock: countOutOfStockProducts(products),
    lowStock: countLowStockProducts(products),
    topSelling: getTopProducts(orders, 10),
    byCategory: groupProductsByCategory(products)
  };
}

function countInStockProducts(products: Product[]): number {
  return products.filter(p => p.stock > 0).length;
}

function countOutOfStockProducts(products: Product[]): number {
  return products.filter(p => p.stock === 0).length;
}

function countLowStockProducts(products: Product[]): number {
  return products.filter(p => p.stock > 0 && p.stock < 10).length;
}

function groupProductsByCategory(products: Product[]) {
  const byCategory: Record<string, Product[]> = {};
  for (const product of products) {
    const categoryId = product.categoryId || 'uncategorized';
    if (!byCategory[categoryId]) {
      byCategory[categoryId] = [];
    }
    byCategory[categoryId].push(product);
  }
  return byCategory;
}

function getCustomerAnalytics() {
  const users = database.users || [];
  const orders = database.orders || [];
  const customers = users.filter(u => u.role === 'customer');
  
  return {
    totalCustomers: customers.length,
    newCustomers: countNewCustomers(customers),
    customersByOrders: segmentCustomersByOrders(customers, orders),
    topCustomers: getTopCustomers(orders, 10)
  };
}

function countNewCustomers(customers: User[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return customers.filter(c => new Date(c.createdAt!) >= thirtyDaysAgo).length;
}

function segmentCustomersByOrders(customers: User[], orders: Order[]) {
  const segments = { noOrders: 0, oneOrder: 0, multipleOrders: 0 };
  
  for (const customer of customers) {
    const orderCount = countCustomerOrders(customer.id, orders);
    categorizeCustomer(segments, orderCount);
  }
  
  return segments;
}

function countCustomerOrders(customerId: string, orders: Order[]): number {
  return orders.filter(o => o.userId === customerId).length;
}

function categorizeCustomer(segments: any, orderCount: number): void {
  if (orderCount === 0) segments.noOrders++;
  else if (orderCount === 1) segments.oneOrder++;
  else segments.multipleOrders++;
}

function getTopCustomers(orders: Order[], limit: number) {
  const customerSpending: Record<string, { userId: string; totalSpent: number; orderCount: number }> = {};
  
  for (const order of orders) {
    updateCustomerSpending(customerSpending, order);
  }
  
  const sorted = sortCustomersBySpending(customerSpending);
  return sorted.slice(0, limit);
}

function updateCustomerSpending(spending: Record<string, any>, order: Order): void {
  const userId = order.userId;
  if (!spending[userId]) {
    spending[userId] = { userId, totalSpent: 0, orderCount: 0 };
  }
  spending[userId].totalSpent += extractOrderTotal(order);
  spending[userId].orderCount++;
}

function sortCustomersBySpending(spending: Record<string, any>): any[] {
  return Object.values(spending).sort((a, b) => b.totalSpent - a.totalSpent);
}

function getOrderAnalytics() {
  const orders = database.orders || [];
  
  return {
    totalOrders: orders.length,
    byStatus: groupOrdersByStatus(orders),
    averageOrderValue: calculateAverageOrderValue(orders),
    orderTrends: calculateOrderTrends(orders),
    fulfillmentRate: calculateFulfillmentRate(orders)
  };
}

function calculateOrderTrends(orders: Order[]) {
  const last7Days = getLast7DaysOrders(orders);
  const previous7Days = getPrevious7DaysOrders(orders);
  
  const currentCount = last7Days.length;
  const previousCount = previous7Days.length;
  const change = calculatePercentageChange(previousCount, currentCount);
  
  return { currentPeriod: currentCount, previousPeriod: previousCount, percentageChange: change };
}

function getLast7DaysOrders(orders: Order[]): Order[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return orders.filter(o => new Date(o.createdAt!) >= sevenDaysAgo);
}

function getPrevious7DaysOrders(orders: Order[]): Order[] {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return orders.filter(o => {
    const date = new Date(o.createdAt!);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });
}

function calculatePercentageChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function calculateFulfillmentRate(orders: Order[]): number {
  const totalOrders = orders.length;
  if (totalOrders === 0) return 0;
  
  const fulfilledOrders = orders.filter(o => o.status === 'delivered').length;
  return Math.round((fulfilledOrders / totalOrders) * 100);
}

function getRevenueAnalytics() {
  const orders = database.orders || [];
  
  return {
    totalRevenue: calculateTotalRevenue(orders),
    revenueByMonth: groupRevenueByMonth(orders),
    projectedRevenue: calculateProjectedRevenue(orders),
    revenueGrowth: calculateRevenueGrowth(orders)
  };
}

function groupRevenueByMonth(orders: Order[]) {
  const monthlyRevenue: Record<string, number> = {};
  
  for (const order of orders) {
    const monthKey = getMonthKey(order.createdAt!);
    updateMonthlyRevenue(monthlyRevenue, monthKey, order);
  }
  
  return monthlyRevenue;
}

function getMonthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function updateMonthlyRevenue(monthlyRevenue: Record<string, number>, monthKey: string, order: Order): void {
  if (!monthlyRevenue[monthKey]) {
    monthlyRevenue[monthKey] = 0;
  }
  monthlyRevenue[monthKey] += extractOrderTotal(order);
}

function calculateProjectedRevenue(orders: Order[]) {
  const monthlyRevenue = groupRevenueByMonth(orders);
  const months = Object.keys(monthlyRevenue);
  
  if (months.length < 2) return { value: 0, formatted: formatPrice(0) };
  
  const averageGrowth = calculateAverageGrowthRate(monthlyRevenue, months);
  const lastMonthRevenue = monthlyRevenue[months[months.length - 1]] || 0;
  const projected = lastMonthRevenue * (1 + averageGrowth);
  
  return { value: Math.round(projected * 100) / 100, formatted: formatPrice(projected) };
}

function calculateAverageGrowthRate(monthlyRevenue: Record<string, number>, months: string[]): number {
  if (months.length < 2) return 0;
  
  let totalGrowth = 0;
  for (let i = 1; i < months.length; i++) {
    const prevRevenue = monthlyRevenue[months[i - 1]] || 1;
    const currRevenue = monthlyRevenue[months[i]] || 0;
    totalGrowth += (currRevenue - prevRevenue) / prevRevenue;
  }
  
  return totalGrowth / (months.length - 1);
}

function calculateRevenueGrowth(orders: Order[]) {
  const currentMonth = getCurrentMonthRevenue(orders);
  const previousMonth = getPreviousMonthRevenue(orders);
  
  return {
    currentMonth: { value: currentMonth, formatted: formatPrice(currentMonth) },
    previousMonth: { value: previousMonth, formatted: formatPrice(previousMonth) },
    percentageChange: calculatePercentageChange(previousMonth, currentMonth)
  };
}

function getCurrentMonthRevenue(orders: Order[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return orders
    .filter(o => new Date(o.createdAt!) >= startOfMonth)
    .reduce((sum, o) => sum + extractOrderTotal(o), 0);
}

function getPreviousMonthRevenue(orders: Order[]): number {
  const now = new Date();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  
  return orders
    .filter(o => {
      const date = new Date(o.createdAt!);
      return date >= startOfPrevMonth && date <= endOfPrevMonth;
    })
    .reduce((sum, o) => sum + extractOrderTotal(o), 0);
}

export default router;
