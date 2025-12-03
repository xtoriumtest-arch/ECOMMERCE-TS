import { Router, Request, Response } from 'express';
import { findRecordById, updateRecord, database } from '../utils/database';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { generateId, formatPrice } from '../utils/helpers';
import { Shipment, Order, Address, TrackingEvent, ShipmentStatus } from '../types';

const router = Router();

router.get('/rates', (req: Request, res: Response) => {
  const { weight, destination } = req.query;
  const rates = calculateShippingRates(parseFloat(weight as string) || 1, destination as string);
  const response = formatResponse(rates, 'Shipping rates calculated');
  res.json(response);
});

router.get('/order/:orderId', (req: Request, res: Response) => {
  const order = findRecordById<Order>('orders', req.params.orderId);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  const shipment = getOrderShipment(req.params.orderId);
  const response = formatResponse(shipment, 'Shipment info retrieved');
  res.json(response);
});

router.get('/tracking/:trackingNumber', (req: Request, res: Response) => {
  const shipment = getShipmentByTracking(req.params.trackingNumber);
  if (!shipment) {
    return res.status(404).json(formatErrorResponse({ message: 'Shipment not found' }, 404));
  }
  const tracking = getTrackingDetails(shipment);
  const response = formatResponse(tracking, 'Tracking info retrieved');
  res.json(response);
});

router.post('/', (req: Request, res: Response) => {
  const validation = validateShipmentData(req.body);
  if (!validation.valid) {
    return res.status(400).json(formatErrorResponse({ message: validation.message }, 400));
  }
  
  const order = findRecordById<Order>('orders', req.body.orderId);
  if (!order) {
    return res.status(404).json(formatErrorResponse({ message: 'Order not found' }, 404));
  }
  
  const shipment = createShipment(req.body, order);
  updateOrderShippingStatus(req.body.orderId, 'shipped');
  
  const response = formatResponse(shipment, 'Shipment created');
  res.status(201).json(response);
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const shipment = getShipmentById(req.params.id);
  if (!shipment) {
    return res.status(404).json(formatErrorResponse({ message: 'Shipment not found' }, 404));
  }
  
  const updated = updateShipmentStatus(req.params.id, req.body.status, req.body.location);
  
  if (req.body.status === 'delivered') {
    updateOrderShippingStatus(shipment.orderId, 'delivered');
  }
  
  const response = formatResponse(updated, 'Shipment status updated');
  res.json(response);
});

router.get('/carriers', (req: Request, res: Response) => {
  const carriers = getAvailableCarriers();
  const response = formatResponse(carriers, 'Carriers retrieved');
  res.json(response);
});

function calculateShippingRates(weight: number, destination?: string) {
  const baseRates = getBaseShippingRates();
  const multiplier = getDestinationMultiplier(destination);
  
  return baseRates.map(rate => {
    const cost = calculateRateCost(rate, weight, multiplier);
    return {
      ...rate,
      cost: cost,
      formattedCost: formatPrice(cost),
      estimatedDays: rate.days
    };
  });
}

function getBaseShippingRates() {
  return [
    { id: 'express', name: 'Express Shipping', basePrice: 15.99, perPound: 2.50, days: 2 },
    { id: 'standard', name: 'Standard Shipping', basePrice: 5.99, perPound: 1.00, days: 5 },
    { id: 'economy', name: 'Economy Shipping', basePrice: 2.99, perPound: 0.50, days: 10 }
  ];
}

function getDestinationMultiplier(destination?: string): number {
  const multipliers: Record<string, number> = {
    domestic: 1.0,
    canada: 1.5,
    international: 2.5
  };
  return multipliers[destination || 'domestic'] || 1.0;
}

function calculateRateCost(rate: { basePrice: number; perPound: number }, weight: number, multiplier: number): number {
  const baseCost = rate.basePrice + (weight * rate.perPound);
  return Math.round(baseCost * multiplier * 100) / 100;
}

function getOrderShipment(orderId: string): Shipment | undefined {
  const shipments = database.shipments || [];
  return shipments.find(s => s.orderId === orderId);
}

function getShipmentById(id: string): Shipment | undefined {
  const shipments = database.shipments || [];
  return shipments.find(s => s.id === id);
}

function getShipmentByTracking(trackingNumber: string): Shipment | undefined {
  const shipments = database.shipments || [];
  return shipments.find(s => s.trackingNumber === trackingNumber);
}

function getTrackingDetails(shipment: Shipment) {
  const events = shipment.trackingEvents || [];
  const currentStatus = getCurrentStatus(shipment);
  const estimatedDelivery = calculateEstimatedDelivery(shipment);
  
  return {
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: currentStatus,
    estimatedDelivery,
    events: formatTrackingEvents(events)
  };
}

function getCurrentStatus(shipment: Shipment): string {
  const events = shipment.trackingEvents || [];
  if (events.length === 0) return 'pending';
  return events[events.length - 1].status;
}

function calculateEstimatedDelivery(shipment: Shipment): string {
  const shippingRate = getBaseShippingRates().find(r => r.id === shipment.shippingMethod);
  const days = shippingRate ? shippingRate.days : 5;
  const estimatedDate = new Date(shipment.createdAt!);
  estimatedDate.setDate(estimatedDate.getDate() + days);
  return estimatedDate.toISOString();
}

function formatTrackingEvents(events: TrackingEvent[]) {
  return events.map(event => ({
    ...event,
    formattedDate: new Date(event.timestamp).toLocaleString()
  }));
}

function validateShipmentData(data: any): { valid: boolean; message?: string } {
  if (!data.orderId) {
    return { valid: false, message: 'Order ID is required' };
  }
  if (!data.carrier) {
    return { valid: false, message: 'Carrier is required' };
  }
  return { valid: true };
}

function createShipment(data: any, order: Order): Shipment {
  const shipment = buildShipmentObject(data, order);
  if (!database.shipments) database.shipments = [];
  database.shipments.push(shipment);
  return shipment;
}

function buildShipmentObject(data: any, order: Order): Shipment {
  const trackingNumber = generateTrackingNumber();
  return {
    id: generateId(),
    orderId: data.orderId,
    carrier: data.carrier,
    shippingMethod: order.shippingMethod || 'standard',
    trackingNumber,
    status: 'created',
    origin: getWarehouseAddress(),
    destination: order.shippingAddress,
    trackingEvents: [createTrackingEvent('created', 'Shipment created', 'Warehouse')],
    createdAt: new Date()
  };
}

function generateTrackingNumber(): string {
  const prefix = 'TRK';
  const number = Date.now().toString().slice(-10);
  const suffix = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}${number}${suffix}`;
}

function getWarehouseAddress(): Address {
  return {
    street: '123 Warehouse St',
    city: 'Distribution City',
    state: 'CA',
    zipCode: '90210',
    country: 'USA'
  };
}

function createTrackingEvent(status: string, description: string, location: string): TrackingEvent {
  return {
    status,
    description,
    location,
    timestamp: new Date()
  };
}

function updateShipmentStatus(id: string, status: ShipmentStatus, location?: string): Shipment | null {
  const shipments = database.shipments || [];
  const index = shipments.findIndex(s => s.id === id);
  if (index !== -1) {
    const event = createTrackingEvent(status, getStatusDescription(status), location || 'Unknown');
    database.shipments[index].status = status;
    database.shipments[index].trackingEvents.push(event);
    database.shipments[index].updatedAt = new Date();
    return database.shipments[index];
  }
  return null;
}

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    created: 'Shipment created',
    picked_up: 'Package picked up',
    in_transit: 'Package in transit',
    out_for_delivery: 'Out for delivery',
    delivered: 'Package delivered'
  };
  return descriptions[status] || status;
}

function updateOrderShippingStatus(orderId: string, status: string): void {
  updateRecord('orders', orderId, { shippingStatus: status });
}

function getAvailableCarriers() {
  return [
    { id: 'ups', name: 'UPS', logo: 'ups-logo.png', trackingUrl: 'https://ups.com/track' },
    { id: 'fedex', name: 'FedEx', logo: 'fedex-logo.png', trackingUrl: 'https://fedex.com/track' },
    { id: 'usps', name: 'USPS', logo: 'usps-logo.png', trackingUrl: 'https://usps.com/track' },
    { id: 'dhl', name: 'DHL', logo: 'dhl-logo.png', trackingUrl: 'https://dhl.com/track' }
  ];
}

export default router;
