// customer-backend/functions/src/controllers/complaintController.js
const admin = require('firebase-admin');
const db = admin.firestore();

// ─── POST /api/customer/complaints ───────────────────────────────────────────
// Customer files a new complaint against a completed booking
exports.submitComplaint = async (req, res) => {
  try {
    const customerId = req.user.uid;
    const { bookingId, reason, description, requestRefund, refundAmount } = req.body;

    // Validate required fields
    if (!bookingId || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, reason, and description are required.',
      });
    }
    if (description.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Description must be at least 20 characters.',
      });
    }

    // Confirm booking belongs to this customer and is in a complaintable state
    const bookingSnap = await db.collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const booking = bookingSnap.data();

    if (booking.customerId !== customerId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (!['completed', 'in_progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Complaints can only be filed on completed or in-progress bookings.',
      });
    }

    // Prevent duplicate complaints for the same booking
    const existing = await db
      .collection('complaints')
      .where('bookingId', '==', bookingId)
      .where('customerId', '==', customerId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: 'A complaint has already been filed for this booking.',
      });
    }

    // Handle evidence photo file uploads
    // Files come via multipart/form-data — use multer middleware on the route
    // In production, upload each file to Firebase Storage and store the download URL
    // For now, store the local paths / filenames returned by multer
    const evidencePhotos = req.files ? req.files.map((f) => f.path || f.filename) : [];

    const ref = db.collection('complaints').doc();
    const complaint = {
      id: ref.id,
      bookingId,
      customerId,
      washerId: booking.providerId,
      reason,
      description: description.trim(),
      requestRefund: requestRefund === 'true' || requestRefund === true,
      refundAmount:
        (requestRefund === 'true' || requestRefund === true) && refundAmount
          ? parseFloat(refundAmount)
          : null,
      currency: booking.currency || 'LKR',
      evidencePhotos,
      // Washer's pre-existing damage photos — pulled from the booking document
      washerPreDamagePhotos: booking.preExistingDamagePhotos || [],
      status: 'submitted',
      adminNote: null,
      adminId: null,
      resolution: null,
      refundApproved: 0,
      penaltyApplied: 0,
      timeline: [
        { event: 'Complaint submitted', time: new Date().toISOString(), done: true },
        { event: 'Admin review started', time: null, done: false },
        { event: 'Washer contacted for response', time: null, done: false },
        { event: 'Decision issued', time: null, done: false },
      ],
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await ref.set(complaint);

    // Create an admin notification so the admin panel can pick this up
    await db.collection('admin_notifications').add({
      type: 'new_complaint',
      complaintId: ref.id,
      bookingId,
      customerId,
      washerId: booking.providerId,
      message: `New complaint filed for booking ${bookingId}`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: { complaintId: ref.id },
    });
  } catch (error) {
    console.error('submitComplaint error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/customer/complaints ────────────────────────────────────────────
// Returns all complaints filed by the logged-in customer
exports.getMyComplaints = async (req, res) => {
  try {
    const customerId = req.user.uid;
    const snap = await db
      .collection('complaints')
      .where('customerId', '==', customerId)
      .orderBy('submittedAt', 'desc')
      .get();

    const complaints = snap.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return res.json({ success: true, data: { complaints } });
  } catch (error) {
    console.error('getMyComplaints error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/customer/complaints/:id ────────────────────────────────────────
// Returns a single complaint with booking context (for the status tracking screen)
exports.getComplaintById = async (req, res) => {
  try {
    const customerId = req.user.uid;
    const { id } = req.params;

    const snap = await db.collection('complaints').doc(id).get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    const complaint = snap.data();

    if (complaint.customerId !== customerId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Attach a booking summary for the status screen to display
    let booking = null;
    const bookingSnap = await db.collection('bookings').doc(complaint.bookingId).get();
    if (bookingSnap.exists) {
      const b = bookingSnap.data();
      booking = {
        service: b.service,
        vehicle: b.vehicle,
        provider: b.provider,
        scheduledDate: b.scheduledDate,
      };
    }

    return res.json({
      success: true,
      data: {
        complaint: {
          ...complaint,
          submittedAt: complaint.submittedAt?.toDate?.()?.toISOString?.() ?? null,
          updatedAt: complaint.updatedAt?.toDate?.()?.toISOString?.() ?? null,
          booking,
        },
      },
    });
  } catch (error) {
    console.error('getComplaintById error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
