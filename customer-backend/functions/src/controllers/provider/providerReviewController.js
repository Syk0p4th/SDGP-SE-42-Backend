const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// GET MY REVIEWS (as provider)
// GET /provider/reviews
// ============================================================
exports.getMyReviews = async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20, page = 1, minRating } = req.query;

    let query = db.collection('reviews').where('providerId', '==', uid);

    const snapshot = await query.get();

    let reviews = [];

    for (const doc of snapshot.docs) {
      const review = { id: doc.id, ...doc.data() };

      // Get customer info
      const customerDoc = await db.collection('customers').doc(review.customerId).get();
      if (customerDoc.exists) {
        const customer = customerDoc.data();
        review.customer = {
          uid: customer.uid,
          displayName: customer.displayName,
          photoURL: customer.photoURL,
        };
      }

      // Get booking info
      const bookingDoc = await db.collection('bookings').doc(review.bookingId).get();
      if (bookingDoc.exists) {
        const booking = bookingDoc.data();
        review.booking = {
          id: bookingDoc.id,
          serviceName: booking.service.name,
          scheduledDate: booking.scheduledDate,
          vehicle: booking.vehicle,
        };
      }

      reviews.push(review);
    }

    // Filter by minimum rating if provided
    if (minRating) {
      reviews = reviews.filter((r) => r.rating >= Number(minRating));
    }

    // Sort by createdAt desc (newest first)
    reviews.sort((a, b) => {
      const aTime = a.createdAt?._seconds || 0;
      const bTime = b.createdAt?._seconds || 0;
      return bTime - aTime;
    });

    const totalCount = reviews.length;

    // Paginate
    const pageSize = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * pageSize;
    const paginatedReviews = reviews.slice(skip, skip + pageSize);

    return successResponse(res, {
      reviews: paginatedReviews,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: skip + pageSize < totalCount,
      },
    }, 'Reviews retrieved successfully');

  } catch (error) {
    console.error('Get provider reviews error:', error);
    return errorResponse(res, 'Failed to retrieve reviews', 500);
  }
};

// ============================================================
// RESPOND TO REVIEW
// PATCH /provider/reviews/:reviewId/respond
// ============================================================
exports.respondToReview = async (req, res) => {
  try {
    const { uid } = req.user;
    const { reviewId } = req.params;
    const { response } = req.body;

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();

    if (!reviewDoc.exists) {
      return errorResponse(res, 'Review not found', 404);
    }

    const review = reviewDoc.data();

    // Only the provider being reviewed can respond
    if (review.providerId !== uid) {
      return errorResponse(res, 'You can only respond to your own reviews', 403);
    }

    await db.collection('reviews').doc(reviewId).update({
      providerResponse: response,
      providerResponseAt: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Fetch updated review
    const updatedReview = await db.collection('reviews').doc(reviewId).get();

    return successResponse(
      res,
      { review: { id: updatedReview.id, ...updatedReview.data() } },
      'Response added successfully'
    );

  } catch (error) {
    console.error('Respond to review error:', error);
    return errorResponse(res, 'Failed to respond to review', 500);
  }
};