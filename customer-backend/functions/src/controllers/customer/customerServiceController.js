const { db } = require('../../config/firebase');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================================
// GET ALL CATEGORIES
// ============================================================
exports.getCategories = async (req, res) => {
  try {
    const snapshot = await db
      .collection('categories')
      .where('isActive', '==', true)
      .get();

    const categories = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort in code instead of Firestore
    categories.sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, { categories }, 'Categories retrieved successfully');

  } catch (error) {
    console.error('Get categories error:', error);
    return errorResponse(res, 'Failed to retrieve categories', 500);
  }
};

// ============================================================
// GET ALL SERVICES (with optional filters)
// ============================================================
exports.getServices = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'rating',
      sortOrder = 'desc',
      limit = 10,
      page = 1,
    } = req.query;

    let query = db.collection('services').where('isActive', '==', true);

    // Filter by category
    if (category) {
      query = query.where('categoryId', '==', category);
    }

    // Fetch all matching docs first
    const snapshot = await query.get();

    // Apply filters in code
    let services = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (minPrice) {
      services = services.filter((s) => s.price >= Number(minPrice));
    }

    if (maxPrice) {
      services = services.filter((s) => s.price <= Number(maxPrice));
    }

    if (minRating) {
      services = services.filter((s) => s.rating >= Number(minRating));
    }

    // Sort in code
    const order = sortOrder === 'asc' ? 1 : -1;
    services.sort((a, b) => {
      if (sortBy === 'price') return (a.price - b.price) * order;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * order;
      return (a.rating - b.rating) * order; // default: rating
    });

    const totalCount = services.length;

    // Pagination in code
    const pageSize = Math.min(Number(limit), 50);
    const skip = (Number(page) - 1) * pageSize;
    const paginatedServices = services.slice(skip, skip + pageSize);

    // Attach provider info
    const result = [];
    for (const service of paginatedServices) {
      const providerDoc = await db.collection('providers').doc(service.providerId).get();
      if (providerDoc.exists) {
        const provider = providerDoc.data();
        service.provider = {
          uid: provider.uid,
          displayName: provider.displayName,
          photoURL: provider.photoURL,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          area: provider.area,
          location: provider.location,
        };
      }
      result.push(service);
    }

    return successResponse(res, {
      services: result,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: skip + pageSize < totalCount,
      },
    }, 'Services retrieved successfully');

  } catch (error) {
    console.error('Get services error:', error);
    return errorResponse(res, 'Failed to retrieve services', 500);
  }
};

// ============================================================
// SEARCH SERVICES BY LOCATION
// ============================================================
exports.searchServices = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 10,
      category,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'distance',
      limit = 10,
    } = req.query;

    if (!latitude || !longitude) {
      return errorResponse(res, 'Latitude and longitude are required', 400);
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const radiusKm = Number(radius);

    if (isNaN(lat) || isNaN(lng)) {
      return errorResponse(res, 'Invalid coordinates', 400);
    }

    // Bounding box
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    // Get all active providers (filter in code)
    const providerSnapshot = await db
      .collection('providers')
      .where('isActive', '==', true)
      .get();

    // Filter by bounding box + exact radius
    const nearbyProviders = [];
    providerSnapshot.docs.forEach((doc) => {
      const provider = { uid: doc.id, ...doc.data() };

      if (
        provider.location.latitude < minLat ||
        provider.location.latitude > maxLat ||
        provider.location.longitude < minLng ||
        provider.location.longitude > maxLng
      ) {
        return;
      }

      const distance = calculateDistance(
        lat, lng,
        provider.location.latitude, provider.location.longitude
      );

      if (distance <= radiusKm) {
        provider.distance = Math.round(distance * 10) / 10;
        nearbyProviders.push(provider);
      }
    });

    if (nearbyProviders.length === 0) {
      return successResponse(res, {
        services: [],
        searchCenter: { latitude: lat, longitude: lng },
        radiusKm,
        pagination: { total: 0, page: 1, limit: Number(limit), totalPages: 0, hasMore: false },
      }, 'No services found in this area');
    }

    const providerIds = nearbyProviders.map((p) => p.uid);

    // Get all active services
    const servicesSnapshot = await db
      .collection('services')
      .where('isActive', '==', true)
      .get();

    // Filter in code
    let allServices = [];
    servicesSnapshot.docs.forEach((doc) => {
      const service = { id: doc.id, ...doc.data() };

      // Only include services from nearby providers
      if (!providerIds.includes(service.providerId)) return;

      // Apply filters
      if (category && service.categoryId !== category) return;
      if (minPrice && service.price < Number(minPrice)) return;
      if (maxPrice && service.price > Number(maxPrice)) return;
      if (minRating && service.rating < Number(minRating)) return;

      // Attach provider info + distance
      const provider = nearbyProviders.find((p) => p.uid === service.providerId);
      if (provider) {
        service.provider = {
          uid: provider.uid,
          displayName: provider.displayName,
          photoURL: provider.photoURL,
          rating: provider.rating,
          totalReviews: provider.totalReviews,
          area: provider.area,
          location: provider.location,
          distance: provider.distance,
        };
        service.distance = provider.distance;
      }

      allServices.push(service);
    });

    // Sort in code
    if (sortBy === 'distance') {
      allServices.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'price') {
      allServices.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'rating') {
      allServices.sort((a, b) => b.rating - a.rating);
    }

    // Paginate
    const pageSize = Math.min(Number(limit), 50);
    const paginatedServices = allServices.slice(0, pageSize);

    return successResponse(res, {
      services: paginatedServices,
      searchCenter: { latitude: lat, longitude: lng },
      radiusKm,
      pagination: {
        total: allServices.length,
        page: 1,
        limit: pageSize,
        totalPages: Math.ceil(allServices.length / pageSize),
        hasMore: allServices.length > pageSize,
      },
    }, 'Search completed successfully');

  } catch (error) {
    console.error('Search services error:', error);
    return errorResponse(res, 'Search failed', 500);
  }
};

// ============================================================
// GET SERVICE DETAILS
// ============================================================
exports.getServiceDetails = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const serviceDoc = await db.collection('services').doc(serviceId).get();

    if (!serviceDoc.exists) {
      return errorResponse(res, 'Service not found', 404);
    }

    const service = { id: serviceDoc.id, ...serviceDoc.data() };

    // Attach provider
    const providerDoc = await db.collection('providers').doc(service.providerId).get();
    if (providerDoc.exists) {
      service.provider = { uid: providerDoc.id, ...providerDoc.data() };
    }

    // Attach category
    const categoryDoc = await db.collection('categories').doc(service.categoryId).get();
    if (categoryDoc.exists) {
      service.category = { id: categoryDoc.id, ...categoryDoc.data() };
    }

    return successResponse(res, { service }, 'Service details retrieved successfully');

  } catch (error) {
    console.error('Get service details error:', error);
    return errorResponse(res, 'Failed to retrieve service details', 500);
  }
};

// ============================================================
// GET PROVIDER PUBLIC PROFILE
// ============================================================
exports.getProviderProfile = async (req, res) => {
  try {
    const { providerId } = req.params;

    const providerDoc = await db.collection('providers').doc(providerId).get();

    if (!providerDoc.exists) {
      return errorResponse(res, 'Provider not found', 404);
    }

    const provider = { uid: providerDoc.id, ...providerDoc.data() };

    // Get their services and sort in code
    const servicesSnapshot = await db
      .collection('services')
      .where('providerId', '==', providerId)
      .where('isActive', '==', true)
      .get();

    provider.services = servicesSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.price - b.price);

    return successResponse(res, { provider }, 'Provider profile retrieved successfully');

  } catch (error) {
    console.error('Get provider profile error:', error);
    return errorResponse(res, 'Failed to retrieve provider profile', 500);
  }
};

// ============================================================
// UTILITY: Haversine distance formula
// ============================================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}