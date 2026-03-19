const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

const PRIORITY_MAP = {
  damage:         'critical',
  safety:         'critical',
  no_show:        'high',
  late:           'high',
  overcharged:    'high',
  poor_quality:   'medium',
  unprofessional: 'medium',
  incomplete:     'medium',
  other:          'low',
};

// ============================================================
// CREATE COMPLAINT
// POST /complaints
// Body: { bookingId, reason, description, requestRefund,
//         refundAmount, evidencePhotos: string[] }
// ============================================================
exports.createComplaint = async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      bookingId,
      reason,
      description,
      requestRefund,
      refundAmount,
      evidencePhotos,
    } = req.body;

    if (!bookingId) return errorResponse(res, 'Booking ID is required', 400);
    if (!reason)    return errorResponse(res, 'Reason is required', 400);
    if (!description || description.trim().length < 20) {
      return errorResponse(res, 'Please provide more detail (at least 20 characters)', 400);
    }

    // Validate booking exists and belongs to customer
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) return errorResponse(res, 'Booking not found', 404);

    const booking = bookingDoc.data();
    if (booking.customerId !== uid) {
      return errorResponse(res, 'You can only complain about your own bookings', 403);
    }

    // Prevent duplicate complaints for same booking
    const existingSnap = await db
      .collection('complaints')
      .where('bookingId', '==', bookingId)
      .where('reportedBy', '==', uid)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return errorResponse(res, 'You have already filed a complaint for this booking', 400);
    }

    const complaintData = {
      type: 'customer',
      status: 'open',
      priority: PRIORITY_MAP[reason] || 'low',
      category: reason,
      subject: reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: description.trim(),
      reportedBy: uid,
      reportedByName: req.user.displayName || null,
      reportedAgainst: booking.providerId || booking.assignedStaffId || null,
      reportedAgainstName: booking.assignedStaffName || null,
      bookingId,
      evidencePhotos: Array.isArray(evidencePhotos) ? evidencePhotos : [],
      requestRefund: !!requestRefund,
      refundAmount: requestRefund && refundAmount ? Number(refundAmount) : null,
      currency: booking.currency || 'LKR',
      adminNotes: '',
      adminNote: '',   // shown to customer
      resolvedBy: null,
      resolvedAt: null,
      submittedAt: new Date().toISOString(),
      // Timeline for complaint-status.tsx
      timeline: [
        { event: 'Complaint submitted',          time: new Date().toISOString(), done: true  },
        { event: 'Admin review started',          time: null,                    done: false },
        { event: 'Washer contacted for response', time: null,                    done: false },
        { event: 'Decision issued',               time: null,                    done: false },
      ],
      // Booking snapshot for complaint-status.tsx
      booking: {
        service: booking.service || null,
        vehicle: booking.vehicle || null,
        provider: booking.provider || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const complaintRef = await db.collection('complaints').add(complaintData);

    return successResponse(
      res,
      { complaint: { id: complaintRef.id, ...complaintData } },
      'Complaint submitted successfully',
      201
    );

  } catch (error) {
    console.error('Create complaint error:', error);
    return errorResponse(res, 'Failed to submit complaint', 500);
  }
};

// ============================================================
// GET MY COMPLAINTS
// GET /complaints
// ============================================================
exports.getMyComplaints = async (req, res) => {
  try {
    const { uid } = req.user;

    const snapshot = await db
      .collection('complaints')
      .where('reportedBy', '==', uid)
      .get();

    const complaints = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?._seconds || 0;
        const bTime = b.createdAt?._seconds || 0;
        return bTime - aTime;
      });

    return successResponse(res, { complaints }, 'Complaints retrieved successfully');

  } catch (error) {
    console.error('Get complaints error:', error);
    return errorResponse(res, 'Failed to retrieve complaints', 500);
  }
};

// ============================================================
// GET SINGLE COMPLAINT
// GET /complaints/:complaintId
// ============================================================
exports.getComplaintById = async (req, res) => {
  try {
    const { uid } = req.user;
    const { complaintId } = req.params;

    const complaintDoc = await db.collection('complaints').doc(complaintId).get();
    if (!complaintDoc.exists) return errorResponse(res, 'Complaint not found', 404);

    const complaint = { id: complaintDoc.id, ...complaintDoc.data() };

    // Only the reporter can view their own complaint
    if (complaint.reportedBy !== uid) {
      return errorResponse(res, 'Complaint not found', 404);
    }

    return successResponse(res, { complaint }, 'Complaint retrieved successfully');

  } catch (error) {
    console.error('Get complaint error:', error);
    return errorResponse(res, 'Failed to retrieve complaint', 500);
  }
};