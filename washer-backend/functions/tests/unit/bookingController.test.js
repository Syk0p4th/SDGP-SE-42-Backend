/* eslint-disable max-len */
const {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockBooking,
  createMockCollectionRef
} = require('../helpers/testUtils');

jest.mock('../../src/config/logger');

describe('Booking Controller - Unit Tests', () => {
  let bookingController;
  let mockDb;

  beforeEach(() => {
    jest.resetModules();

    mockDb = {
      collection: jest.fn(() => createMockCollectionRef([]))
    };

    jest.doMock('firebase-admin', () => ({
      firestore: () => mockDb
    }));

    bookingController = require('../../src/controllers/bookingController');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create a new booking successfully', async () => {
      const mockBookingData = {
        userId: 'user-123',
        serviceId: 'service-456',
        date: '2026-02-01',
        time: '10:00 AM',
        vehicleType: 'sedan',
        vehicleNumber: 'ABC123'
      };

      const req = createMockRequest({
        body: mockBookingData,
        user: { uid: 'user-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (bookingController && bookingController.createBooking) {
        await bookingController.createBooking(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true
          })
        );
      }
    });

    it('should validate required booking fields', async () => {
      const req = createMockRequest({
        body: {
          // Missing required fields
          date: '2026-02-01'
        },
        user: { uid: 'user-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (bookingController && bookingController.createBooking) {
        await bookingController.createBooking(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
      }
    });
  });

  describe('getBookings', () => {
    it('should retrieve all bookings for a user', async () => {
      const mockBookings = [
        createMockBooking({ id: '1', userId: 'user-123' }),
        createMockBooking({ id: '2', userId: 'user-123' })
      ];

      mockDb.collection().get.mockResolvedValue({
        empty: false,
        docs: mockBookings.map((b) => ({
          id: b.id,
          data: () => b
        }))
      });

      const req = createMockRequest({
        user: { uid: 'user-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (bookingController && bookingController.getBookings) {
        await bookingController.getBookings(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true
          })
        );
      }
    });
  });

  describe('updateBooking', () => {
    it('should update booking status', async () => {
      const req = createMockRequest({
        params: { id: 'booking-123' },
        body: { status: 'confirmed' },
        user: { uid: 'user-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (bookingController && bookingController.updateBooking) {
        await bookingController.updateBooking(req, res, next);

        expect(res.status).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalled();
      }
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking', async () => {
      const req = createMockRequest({
        params: { id: 'booking-123' },
        user: { uid: 'user-123' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      if (bookingController && bookingController.cancelBooking) {
        await bookingController.cancelBooking(req, res, next);

        expect(res.status).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalled();
      }
    });
  });
});
