/* eslint-disable max-len */
// User roles
const ROLES = {
  CUSTOMER: 'customer',
  WASHER: 'washer',
  STAFF: 'staff',
  ADMIN: 'admin'
};

// User statuses
const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled'
};

// Washer approval statuses
const WASHER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Booking statuses
const BOOKING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Vehicle types
const VEHICLE_TYPES = {
  CAR: 'car',
  SUV: 'suv',
  VAN: 'van',
  BIKE: 'bike'
};

// Service categories
const SERVICE_CATEGORIES = {
  WASH: 'wash',
  DETAIL: 'detail',
  MAINTENANCE: 'maintenance',
  SPECIAL: 'special'
};

// Payment methods
const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card'
};

// Payment statuses
const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Notification types
const NOTIFICATION_TYPES = {
  BOOKING_CREATED: 'booking_created',
  BOOKING_ACCEPTED: 'booking_accepted',
  BOOKING_DECLINED: 'booking_declined',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_COMPLETED: 'booking_completed',
  STAFF_ASSIGNED: 'staff_assigned',
  REVIEW_REQUEST: 'review_request'
};

const COLLECTIONS = {
  USERS: 'users',
  PROVIDERS: 'providers',
  WASHERS: 'washers',
  SERVICES: 'services',
  BOOKINGS: 'bookings',
  VEHICLES: 'vehicles',
  NOTIFICATIONS: 'notifications',
  REVIEWS: 'reviews',
  PAYMENTS: 'payments'
};

module.exports = {
  ROLES,
  USER_STATUS,
  WASHER_STATUS,
  BOOKING_STATUS,
  VEHICLE_TYPES,
  SERVICE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  NOTIFICATION_TYPES,
  COLLECTIONS
};
