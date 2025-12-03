import { Router, Request, Response } from 'express';
import { executeQuery, findRecordById, insertRecord, updateRecord, deleteRecord, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { validateUser, validateEmailFormat, validateRequiredField } from '../utils/validators';
import { generateId } from '../utils/helpers';
import { User, Order } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const users = getAllUsers();
  const sanitized = sanitizeUserList(users);
  const response = formatResponse(sanitized, 'Users retrieved');
  res.json(response);
});

router.get('/:id', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  const sanitized = sanitizeUserData(user);
  const response = formatResponse(sanitized, 'User retrieved');
  res.json(response);
});

router.get('/:id/orders', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  const orders = getUserOrders(req.params.id);
  const response = formatResponse(orders, 'User orders retrieved');
  res.json(response);
});

router.get('/:id/addresses', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  const addresses = getUserAddresses(user);
  const response = formatResponse(addresses, 'User addresses retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateUser(req.body);
  if (!validation.isValid) {
    return res.status(400).json(formatErrorResponse({ message: JSON.stringify(validation.errors) }, 400));
  }
  
  if (checkEmailExists(req.body.email)) {
    return res.status(409).json(formatErrorResponse({ message: 'Email already exists' }, 409));
  }
  
  const user = createUser(req.body);
  const sanitized = sanitizeUserData(user);
  const response = formatResponse(sanitized, 'User created successfully');
  res.status(201).json(response);
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!validateRequiredField(email) || !validateRequiredField(password)) {
    return res.status(400).json(formatErrorResponse({ message: 'Email and password required' }, 400));
  }
  
  const user = authenticateUser(email, password);
  if (!user) {
    return res.status(401).json(formatErrorResponse({ message: 'Invalid credentials' }, 401));
  }
  
  const token = generateAuthToken(user);
  const response = formatResponse({ user: sanitizeUserData(user), token }, 'Login successful');
  res.json(response);
});

router.put('/:id', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  
  const updated = updateUserData(req.params.id, req.body);
  const sanitized = sanitizeUserData(updated!);
  const response = formatResponse(sanitized, 'User updated');
  res.json(response);
});

router.patch('/:id/password', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  
  const { currentPassword, newPassword } = req.body;
  if (!verifyPassword(user, currentPassword)) {
    return res.status(401).json(formatErrorResponse({ message: 'Current password incorrect' }, 401));
  }
  
  updateUserPassword(req.params.id, newPassword);
  const response = formatResponse({ success: true }, 'Password updated');
  res.json(response);
});

router.delete('/:id', (req: Request, res: Response) => {
  const user = getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(formatErrorResponse({ message: 'User not found' }, 404));
  }
  
  const deleted = removeUser(req.params.id);
  const response = formatResponse(deleted, 'User deleted');
  res.json(response);
});

function getAllUsers(): User[] {
  const result = executeQuery<User[]>('users', 'findAll');
  return result.data || [];
}

function getUserById(id: string): User | undefined {
  return findRecordById<User>('users', id);
}

function sanitizeUserList(users: User[]): Omit<User, 'password'>[] {
  return users.map(user => sanitizeUserData(user));
}

function sanitizeUserData(user: User): Omit<User, 'password'> {
  const { password, ...sanitized } = user;
  return sanitized;
}

function getUserOrders(userId: string): Order[] {
  const orders = database.orders || [];
  return orders.filter(order => order.userId === userId);
}

function getUserAddresses(user: User) {
  return user.addresses || [];
}

function checkEmailExists(email: string): boolean {
  const users = getAllUsers();
  return users.some(user => user.email === email);
}

function createUser(userData: Partial<User & { password: string }>): User {
  const newUser = buildUserObject(userData);
  return insertRecord<User>('users', newUser);
}

function buildUserObject(data: Partial<User & { password: string }>): User {
  const hashedPassword = hashPassword(data.password || '');
  return {
    id: generateId(),
    email: data.email || '',
    name: data.name || '',
    password: hashedPassword,
    role: 'customer',
    addresses: []
  };
}

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

function authenticateUser(email: string, password: string): User | null {
  const users = getAllUsers();
  const user = users.find(u => u.email === email);
  if (!user) return null;
  
  const hashedPassword = hashPassword(password);
  if (user.password !== hashedPassword) return null;
  
  return user;
}

function generateAuthToken(user: User): string {
  const tokenData = buildTokenData(user);
  return encodeToken(tokenData);
}

function buildTokenData(user: User) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 3600000
  };
}

function encodeToken(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function updateUserData(id: string, updates: Partial<User>): User | null {
  const safeUpdates = filterSafeUpdates(updates);
  return updateRecord<User>('users', id, safeUpdates);
}

function filterSafeUpdates(updates: Partial<User>): Partial<User> {
  const { password, role, ...safe } = updates;
  return safe;
}

function verifyPassword(user: User, password: string): boolean {
  const hashedPassword = hashPassword(password);
  return user.password === hashedPassword;
}

function updateUserPassword(id: string, newPassword: string): User | null {
  const hashedPassword = hashPassword(newPassword);
  return updateRecord<User>('users', id, { password: hashedPassword });
}

function removeUser(id: string): User | null {
  return deleteRecord<User>('users', id);
}

export default router;
