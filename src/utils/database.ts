import { generateId } from './helpers';
import { formatResponse } from './responseFormatter';
import { Product, User, Order, Cart, Category, Review, Payment, Shipment, Database, ApiResponse } from '../types';

const database: Database = {
  products: [],
  users: [],
  orders: [],
  carts: [],
  categories: [],
  reviews: [],
  payments: [],
  shipments: []
};

export function initializeDatabase(): void {
  seedProducts();
  seedCategories();
  seedUsers();
  console.log('Database initialized with seed data');
}

function seedProducts(): void {
  const products = createSampleProducts();
  database.products = products;
}

function seedCategories(): void {
  const categories = createSampleCategories();
  database.categories = categories;
}

function seedUsers(): void {
  const users = createSampleUsers();
  database.users = users;
}

function createSampleProducts(): Product[] {
  return [
    { id: generateId(), name: 'Laptop', price: 999.99, categoryId: 'cat-1', stock: 50 },
    { id: generateId(), name: 'Phone', price: 699.99, categoryId: 'cat-1', stock: 100 },
    { id: generateId(), name: 'Headphones', price: 199.99, categoryId: 'cat-2', stock: 200 }
  ];
}

function createSampleCategories(): Category[] {
  return [
    { id: 'cat-1', name: 'Electronics', description: 'Electronic devices' },
    { id: 'cat-2', name: 'Accessories', description: 'Product accessories' }
  ];
}

function createSampleUsers(): User[] {
  return [
    { id: generateId(), email: 'john@example.com', name: 'John Doe', role: 'customer' },
    { id: generateId(), email: 'admin@example.com', name: 'Admin User', role: 'admin' }
  ];
}

export function executeQuery<T>(collection: keyof Database, operation: string, data?: any): ApiResponse<T> {
  const result = performDatabaseOperation(collection, operation, data);
  return formatResponse(result as T);
}

function performDatabaseOperation<T>(collection: keyof Database, operation: string, data?: any): T | null {
  switch (operation) {
    case 'findAll':
      return (database[collection] || []) as T;
    case 'findById':
      return findRecordById(collection, data.id) as T;
    case 'insert':
      return insertRecord(collection, data) as T;
    case 'update':
      return updateRecord(collection, data.id, data.updates) as T;
    case 'delete':
      return deleteRecord(collection, data.id) as T;
    default:
      return null;
  }
}

export function findRecordById<T>(collection: keyof Database, id: string): T | undefined {
  const records = database[collection] as any[];
  return records.find((record: any) => record.id === id) as T;
}

export function insertRecord<T extends { id?: string }>(collection: keyof Database, data: T): T {
  const newRecord = { ...data, id: data.id || generateId(), createdAt: new Date() } as T;
  (database[collection] as any[]).push(newRecord);
  return newRecord;
}

export function updateRecord<T>(collection: keyof Database, id: string, updates: Partial<T>): T | null {
  const records = database[collection] as any[];
  const index = records.findIndex((record: any) => record.id === id);
  if (index !== -1) {
    records[index] = { ...records[index], ...updates, updatedAt: new Date() };
    return records[index] as T;
  }
  return null;
}

export function deleteRecord<T>(collection: keyof Database, id: string): T | null {
  const records = database[collection] as any[];
  const index = records.findIndex((record: any) => record.id === id);
  if (index !== -1) {
    const deleted = records.splice(index, 1);
    return deleted[0] as T;
  }
  return null;
}

export { database };
