import { Router, Request, Response } from 'express';
import { findRecordById, updateRecord, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { generateId } from '../utils/helpers';
import { validateRequiredField } from '../utils/validators';
import { Review, Product } from '../types';

const router = Router();

router.get('/product/:productId', (req: Request, res: Response) => {
  const product = findRecordById<Product>('products', req.params.productId);
  if (!product) {
    return res.status(404).json(formatErrorResponse({ message: 'Product not found' }, 404));
  }
  
  const reviews = getProductReviews(req.params.productId);
  const stats = calculateReviewStats(reviews);
  const response = formatResponse({ reviews, stats }, 'Reviews retrieved');
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const review = getReviewById(req.params.id);
  if (!review) {
    return res.status(404).json(formatErrorResponse({ message: 'Review not found' }, 404));
  }
  const enriched = enrichReviewData(review);
  const response = formatResponse(enriched, 'Review retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateReviewData(req.body);
  if (!validation.valid) {
    return res.status(400).json(formatErrorResponse({ message: validation.message }, 400));
  }
  
  const existingReview = checkExistingReview(req.body.userId, req.body.productId);
  if (existingReview) {
    return res.status(409).json(formatErrorResponse({ message: 'User already reviewed this product' }, 409));
  }
  
  const review = createReview(req.body);
  updateProductRating(req.body.productId);
  
  const response = formatResponse(review, 'Review created');
  res.status(201).json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const review = getReviewById(req.params.id);
  if (!review) {
    return res.status(404).json(formatErrorResponse({ message: 'Review not found' }, 404));
  }
  
  const updated = updateReviewData(req.params.id, req.body);
  updateProductRating(review.productId);
  
  const response = formatResponse(updated, 'Review updated');
  res.json(response);
});

router.delete('/:id', (req: Request, res: Response) => {
  const review = getReviewById(req.params.id);
  if (!review) {
    return res.status(404).json(formatErrorResponse({ message: 'Review not found' }, 404));
  }
  
  const deleted = removeReview(req.params.id);
  updateProductRating(review.productId);
  
  const response = formatResponse(deleted, 'Review deleted');
  res.json(response);
});

router.post('/:id/helpful', (req: Request, res: Response) => {
  const review = getReviewById(req.params.id);
  if (!review) {
    return res.status(404).json(formatErrorResponse({ message: 'Review not found' }, 404));
  }
  
  const updated = markReviewHelpful(req.params.id);
  const response = formatResponse(updated, 'Review marked as helpful');
  res.json(response);
});

function getProductReviews(productId: string): Review[] {
  const reviews = database.reviews || [];
  const productReviews = filterReviewsByProduct(reviews, productId);
  return sortReviewsByDate(productReviews);
}

function filterReviewsByProduct(reviews: Review[], productId: string): Review[] {
  return reviews.filter(r => r.productId === productId);
}

function sortReviewsByDate(reviews: Review[]): Review[] {
  return reviews.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
}

function getReviewById(id: string): Review | undefined {
  const reviews = database.reviews || [];
  return reviews.find(r => r.id === id);
}

function enrichReviewData(review: Review) {
  const user = findRecordById<any>('users', review.userId);
  const product = findRecordById<Product>('products', review.productId);
  return {
    ...review,
    userName: user ? user.name : 'Anonymous',
    productName: product ? product.name : 'Unknown'
  };
}

function calculateReviewStats(reviews: Review[]) {
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return buildEmptyStats();
  }
  
  const averageRating = calculateAverageRating(reviews);
  const ratingDistribution = calculateRatingDistribution(reviews);
  
  return { totalReviews, averageRating, ratingDistribution };
}

function buildEmptyStats() {
  return {
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };
}

function calculateAverageRating(reviews: Review[]): number {
  const sum = reviews.reduce((total, r) => total + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

function calculateRatingDistribution(reviews: Review[]): Record<number, number> {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });
  return distribution;
}

function validateReviewData(data: Partial<Review>): { valid: boolean; message?: string } {
  if (!validateRequiredField(data.userId)) {
    return { valid: false, message: 'User ID is required' };
  }
  if (!validateRequiredField(data.productId)) {
    return { valid: false, message: 'Product ID is required' };
  }
  if (!validateRating(data.rating)) {
    return { valid: false, message: 'Rating must be between 1 and 5' };
  }
  return { valid: true };
}

function validateRating(rating: unknown): boolean {
  const numRating = parseInt(String(rating));
  return !isNaN(numRating) && numRating >= 1 && numRating <= 5;
}

function checkExistingReview(userId: string, productId: string): Review | undefined {
  const reviews = database.reviews || [];
  return reviews.find(r => r.userId === userId && r.productId === productId);
}

function createReview(data: Partial<Review>): Review {
  const newReview = buildReviewObject(data);
  if (!database.reviews) database.reviews = [];
  database.reviews.push(newReview);
  return newReview;
}

function buildReviewObject(data: Partial<Review>): Review {
  return {
    id: generateId(),
    userId: data.userId || '',
    productId: data.productId || '',
    rating: parseInt(String(data.rating)) || 0,
    title: data.title || '',
    content: data.content || '',
    helpfulCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function updateReviewData(id: string, updates: Partial<Review>): Review | null {
  const reviews = database.reviews || [];
  const index = reviews.findIndex(r => r.id === id);
  if (index !== -1) {
    const safeUpdates = filterReviewUpdates(updates);
    database.reviews[index] = { ...database.reviews[index], ...safeUpdates, updatedAt: new Date() };
    return database.reviews[index];
  }
  return null;
}

function filterReviewUpdates(updates: Partial<Review>): Partial<Review> {
  const { id, userId, productId, createdAt, ...safe } = updates;
  return safe;
}

function removeReview(id: string): Review | null {
  const reviews = database.reviews || [];
  const index = reviews.findIndex(r => r.id === id);
  if (index !== -1) {
    return database.reviews.splice(index, 1)[0];
  }
  return null;
}

function markReviewHelpful(id: string): Review | null {
  const reviews = database.reviews || [];
  const index = reviews.findIndex(r => r.id === id);
  if (index !== -1) {
    database.reviews[index].helpfulCount += 1;
    return database.reviews[index];
  }
  return null;
}

function updateProductRating(productId: string): void {
  const reviews = getProductReviews(productId);
  const stats = calculateReviewStats(reviews);
  updateRecord('products', productId, { 
    averageRating: stats.averageRating, 
    reviewCount: stats.totalReviews 
  });
}

export default router;
