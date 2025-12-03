import { Router, Request, Response } from 'express';
import { executeQuery, findRecordById, insertRecord, updateRecord, deleteRecord, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { generateId } from '../utils/helpers';
import { validateRequiredField } from '../utils/validators';
import { Category, Product } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const categories = getAllCategories();
  const enriched = enrichCategoryList(categories);
  const response = formatResponse(enriched, 'Categories retrieved');
  res.json(response);
});

router.get('/tree', (req: Request, res: Response) => {
  const categories = getAllCategories();
  const tree = buildCategoryTree(categories);
  const response = formatResponse(tree, 'Category tree retrieved');
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json(formatErrorResponse({ message: 'Category not found' }, 404));
  }
  const enriched = enrichCategoryData(category);
  const response = formatResponse(enriched, 'Category retrieved');
  res.json(response);
});

router.get('/:id/products', (req: Request, res: Response) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json(formatErrorResponse({ message: 'Category not found' }, 404));
  }
  const products = getCategoryProducts(req.params.id);
  const response = formatResponse(products, 'Category products retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateCategoryData(req.body);
  if (!validation.valid) {
    return res.status(400).json(formatErrorResponse({ message: validation.message }, 400));
  }
  
  const category = createCategory(req.body);
  const response = formatResponse(category, 'Category created');
  res.status(201).json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json(formatErrorResponse({ message: 'Category not found' }, 404));
  }
  
  const updated = updateCategoryData(req.params.id, req.body);
  const response = formatResponse(updated, 'Category updated');
  res.json(response);
});

router.delete('/:id', (req: Request, res: Response) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json(formatErrorResponse({ message: 'Category not found' }, 404));
  }
  
  const productsCount = countCategoryProducts(req.params.id);
  if (productsCount > 0) {
    return res.status(400).json(formatErrorResponse({ message: 'Cannot delete category with products' }, 400));
  }
  
  const deleted = removeCategory(req.params.id);
  const response = formatResponse(deleted, 'Category deleted');
  res.json(response);
});

function getAllCategories(): Category[] {
  const result = executeQuery<Category[]>('categories', 'findAll');
  return result.data || [];
}

function getCategoryById(id: string): Category | undefined {
  return findRecordById<Category>('categories', id);
}

function enrichCategoryList(categories: Category[]) {
  return categories.map(category => enrichCategoryData(category));
}

function enrichCategoryData(category: Category) {
  const productCount = countCategoryProducts(category.id);
  const subcategories = getSubcategories(category.id);
  return { ...category, productCount, subcategories };
}

function countCategoryProducts(categoryId: string): number {
  const products = database.products || [];
  return products.filter(p => p.categoryId === categoryId).length;
}

function getSubcategories(parentId: string): Category[] {
  const categories = getAllCategories();
  return categories.filter(c => c.parentId === parentId);
}

function getCategoryProducts(categoryId: string): Product[] {
  const products = database.products || [];
  return products.filter(p => p.categoryId === categoryId);
}

function buildCategoryTree(categories: Category[]) {
  const rootCategories = getRootCategories(categories);
  return rootCategories.map(root => buildCategoryNode(root, categories));
}

function getRootCategories(categories: Category[]): Category[] {
  return categories.filter(c => !c.parentId);
}

function buildCategoryNode(category: Category, allCategories: Category[]): any {
  const children = findChildCategories(category.id, allCategories);
  const productCount = countCategoryProducts(category.id);
  return {
    ...category,
    productCount,
    children: children.map(child => buildCategoryNode(child, allCategories))
  };
}

function findChildCategories(parentId: string, categories: Category[]): Category[] {
  return categories.filter(c => c.parentId === parentId);
}

function validateCategoryData(data: Partial<Category>): { valid: boolean; message?: string } {
  if (!validateRequiredField(data.name)) {
    return { valid: false, message: 'Category name is required' };
  }
  if (data.parentId && !getCategoryById(data.parentId)) {
    return { valid: false, message: 'Parent category not found' };
  }
  return { valid: true };
}

function createCategory(data: Partial<Category>): Category {
  const newCategory = buildCategoryObject(data);
  return insertRecord<Category>('categories', newCategory);
}

function buildCategoryObject(data: Partial<Category>): Category {
  return {
    id: generateId(),
    name: data.name || '',
    description: data.description || '',
    parentId: data.parentId || null,
    slug: generateSlug(data.name || '')
  };
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function updateCategoryData(id: string, updates: Partial<Category>): Category | null {
  const safeUpdates = filterCategoryUpdates(updates);
  return updateRecord<Category>('categories', id, safeUpdates);
}

function filterCategoryUpdates(updates: Partial<Category>): Partial<Category> {
  const { id, createdAt, ...safe } = updates as any;
  if (safe.name) {
    safe.slug = generateSlug(safe.name);
  }
  return safe;
}

function removeCategory(id: string): Category | null {
  return deleteRecord<Category>('categories', id);
}

export default router;
