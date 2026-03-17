// washer-backend/functions/src/controllers/complaintController.js
const admin = require('firebase-admin');
const db = admin.firestore();

// ─── POST /api/washer/bookings/:bookingId/pre-damage ─────────────────────────
// Washer uploads photos of pre-existing damage BEFORE starting a job.
// These photos are saved to the booking document and shown to the admin
// if the customer later files a damage complaint.
exports.uploadPreExistingDamage = async (req, res) => {
  try {
    const washerId = req.user.uid;
    const { bookingId } = req.params;

    const bookingSnap = await db.collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    const booking = bookingSnap.data();

    if (booking.providerId !== washerId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Pre-damage photos can only be uploaded before the job starts (status must be confirmed).',
      });
    }

    // Files come via multipart/form-data — multer handles them
    // In production, upload each file to Firebase Storage and store the download URL
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No photos provided.' });
    }

    const photoUrls = req.files.map((f) => f.path || f.filename);

    // Append to any previously uploaded pre-damage photos on this booking
    await db.collection('bookings').doc(bookingId).update({
      preExistingDamagePhotos: admin.firestore.FieldValue.arrayUnion(...photoUrls),
      preExistingDamageUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: 'Pre-existing damage photos saved.',
      data: { photoUrls },
    });
  } catch (error) {
    console.error('uploadPreExistingDamage error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/washer/complaints ───────────────────────────────────────────────
// Returns complaints that have been filed against this washer.
// Used in the washer app to let the washer see their complaint history.
exports.getComplaintsAgainstMe = async (req, res) => {
  try {
    const washerId = req.user.uid;
    const snap = await db
      .collection('complaints')
      .where('washerId', '==', washerId)
      .orderBy('submittedAt', 'desc')
      .get();

    const complaints = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        bookingId: data.bookingId,
        reason: data.reason,
        status: data.status,
        requestRefund: data.requestRefund,
        refundAmount: data.refundAmount,
        currency: data.currency,
        adminNote: data.adminNote,
        resolution: data.resolution,
        // Do NOT expose customerId or customer personal info
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return res.json({ success: true, data: { complaints } });
  } catch (error) {
    console.error('getComplaintsAgainstMe error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
