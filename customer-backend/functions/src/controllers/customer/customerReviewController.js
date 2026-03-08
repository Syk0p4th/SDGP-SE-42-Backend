const { admin, db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// CREATE REVIEW
// POST /reviews
// ============================================================
exports.createReview = async (req, res) => {
  try {
    const { uid } = req.user;
    const { bookingId, rating, comment } = req.body;

    // Validate booking exists
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();

    if (!bookingDoc.exists) {
      return errorResponse(res, 'Booking not found', 404);
    }

    const booking = bookingDoc.data();

    // Only customer who made the booking can review
    if (booking.customerId !== uid) {
      return errorResponse(res, 'You can only review your own bookings', 403);
    }

    // Can only review completed bookings
    if (booking.status !== 'completed') {
      return errorResponse(res, 'You can only review completed bookings', 400);
    }

    // Check if review already exists for this booking
    const existingReviewSnapshot = await db
      .collection('reviews')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();

    if (!existingReviewSnapshot.empty) {
      return errorResponse(res, 'You have already reviewed this booking', 400);
    }

    // Create review
    const reviewData = {
      bookingId,
      customerId: uid,
      providerId: booking.providerId,
      rating: Number(rating),
      comment: comment || null,
      providerResponse: null,
      providerResponseAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const reviewRef = await db.collection('reviews').add(reviewData);

    // Update provider rating
    await updateProviderRating(booking.providerId);

    // Fetch created review
    const createdReview = await reviewRef.get();

    return successResponse(
      res,
      { review: { id: createdReview.id, ...createdReview.data() } },
      'Review submitted successfully',
      201
    );

  } catch (error) {
    console.error('Create review error:', error);
    return errorResponse(res, 'Failed to submit review', 500);
  }
};

// ============================================================
// GET MY REVIEWS (as customer)
// GET /reviews
// ============================================================
exports.getMyReviews = async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20, page = 1 } = req.query;

    const snapshot = await db
      .collection('reviews')
      .where('customerId', '==', uid)
      .get();

    let reviews = [];

    for (const doc of snapshot.docs) {
      const review = { id: doc.id, ...doc.data() };

      // Get provider info
      const providerDoc = await db.collection('providers').doc(review.providerId).get();
      if (providerDoc.exists) {
        const provider = providerDoc.data();
        review.provider = {
          uid: provider.uid,
          displayName: provider.displayName,
          photoURL: provider.photoURL,
          area: provider.area,
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
    console.error('Get my reviews error:', error);
    return errorResponse(res, 'Failed to retrieve reviews', 500);
  }
};

// ============================================================
// UPDATE REVIEW
// PUT /reviews/:reviewId
// ============================================================
exports.updateReview = async (req, res) => {
  try {
    const { uid } = req.user;
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();

    if (!reviewDoc.exists) {
      return errorResponse(res, 'Review not found', 404);
    }

    const review = reviewDoc.data();

    // Only the review author can update
    if (review.customerId !== uid) {
      return errorResponse(res, 'You can only update your own reviews', 403);
    }

    const updates = {};
    if (rating !== undefined) updates.rating = Number(rating);
    if (comment !== undefined) updates.comment = comment;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('reviews').doc(reviewId).update(updates);

    // Recalculate provider rating if rating changed
    if (rating !== undefined) {
      await updateProviderRating(review.providerId);
    }

    // Fetch updated review
    const updatedReview = await db.collection('reviews').doc(reviewId).get();

    return successResponse(
      res,
      { review: { id: updatedReview.id, ...updatedReview.data() } },
      'Review updated successfully'
    );

  } catch (error) {
    console.error('Update review error:', error);
    return errorResponse(res, 'Failed to update review', 500);
  }
};

// ============================================================
// DELETE REVIEW
// DELETE /reviews/:reviewId
// ============================================================
exports.deleteReview = async (req, res) => {
  try {
    const { uid } = req.user;
    const { reviewId } = req.params;

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();

    if (!reviewDoc.exists) {
      return errorResponse(res, 'Review not found', 404);
    }

    const review = reviewDoc.data();

    // Only the review author can delete
    if (review.customerId !== uid) {
      return errorResponse(res, 'You can only delete your own reviews', 403);
    }

    await db.collection('reviews').doc(reviewId).delete();

    // Recalculate provider rating
    await updateProviderRating(review.providerId);

    return successResponse(res, null, 'Review deleted successfully');

  } catch (error) {
    console.error('Delete review error:', error);
    return errorResponse(res, 'Failed to delete review', 500);
  }
};

// ============================================================
// GET PROVIDER REVIEWS (Public)
// GET /reviews/provider/:providerId
// ============================================================
exports.getProviderReviews = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { limit = 20, page = 1, minRating } = req.query;

    // Validate provider exists
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return errorResponse(res, 'Provider not found', 404);
    }

    const snapshot = await db
      .collection('reviews')
      .where('providerId', '==', providerId)
      .get();

    let reviews = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

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

    // Calculate rating distribution
    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    // Paginate
    const pageSize = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * pageSize;
    const paginatedReviews = reviews.slice(skip, skip + pageSize);

    const provider = providerDoc.data();

    return successResponse(res, {
      provider: {
        uid: provider.uid,
        displayName: provider.displayName,
        photoURL: provider.photoURL,
        rating: provider.rating,
        totalReviews: provider.totalReviews,
        area: provider.area,
      },
      reviews: paginatedReviews,
      ratingDistribution,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: skip + pageSize < totalCount,
      },
    }, 'Provider reviews retrieved successfully');

  } catch (error) {
    console.error('Get provider reviews error:', error);
    return errorResponse(res, 'Failed to retrieve provider reviews', 500);
  }
};

// ============================================================
// UTILITY: Update Provider Rating
// ============================================================
async function updateProviderRating(providerId) {
  try {
    const reviewsSnapshot = await db
      .collection('reviews')
      .where('providerId', '==', providerId)
      .get();

    if (reviewsSnapshot.empty) {
      // No reviews, reset to 0
      await db.collection('providers').doc(providerId).update({
        rating: 0,
        totalReviews: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const reviews = reviewsSnapshot.docs.map((doc) => doc.data());
    const totalReviews = reviews.length;
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    // Round to 1 decimal place
    const roundedRating = Math.round(averageRating * 10) / 10;

    await db.collection('providers').doc(providerId).update({
      rating: roundedRating,
      totalReviews: totalReviews,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    console.error('Update provider rating error:', error);
  }
}