const { db } = require('../config/firebase');

/**
 * Get earnings summary
 * GET /earnings
 */
exports.getEarnings = async (req, res) => {
  try {
    const { uid } = req.user;
    const { startDate, endDate } = req.query;

    // Get completed bookings
    let query = db
      .collection('bookings')
      .where('providerId', '==', uid)
      .where('status', '==', 'completed');

    if (startDate) {
      query = query.where('scheduledDate', '>=', startDate);
    }
    if (endDate) {
      query = query.where('scheduledDate', '<=', endDate);
    }

    const snapshot = await query.get();

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate earnings (exclude subscription bookings)
    const totalEarnings = bookings.reduce((sum, b) => {
      return sum + (b.paidWithSubscription ? 0 : b.totalPrice);
    }, 0);

    const totalJobs = bookings.length;

    // Today's earnings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => b.scheduledDate === today);
    const todayEarnings = todayBookings.reduce((sum, b) => 
      sum + (b.paidWithSubscription ? 0 : b.totalPrice), 0
    );

    // This week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString().split('T')[0];
    const weekBookings = bookings.filter(b => b.scheduledDate >= weekStart);
    const weekEarnings = weekBookings.reduce((sum, b) => 
      sum + (b.paidWithSubscription ? 0 : b.totalPrice), 0
    );

    // This month
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthBookings = bookings.filter(b => b.scheduledDate >= monthStartStr);
    const monthEarnings = monthBookings.reduce((sum, b) => 
      sum + (b.paidWithSubscription ? 0 : b.totalPrice), 0
    );

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalEarnings,
          totalJobs,
          todayEarnings,
          todayJobs: todayBookings.length,
          weekEarnings,
          weekJobs: weekBookings.length,
          monthEarnings,
          monthJobs: monthBookings.length,
        },
        recentBookings: bookings.slice(0, 20),
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve earnings',
    });
  }
};

/**
 * Get earnings by date range with daily breakdown
 * GET /earnings/range
 */
exports.getEarningsByDateRange = async (req, res) => {
  try {
    const { uid } = req.user;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }

    const snapshot = await db
      .collection('bookings')
      .where('providerId', '==', uid)
      .where('status', '==', 'completed')
      .where('scheduledDate', '>=', startDate)
      .where('scheduledDate', '<=', endDate)
      .get();

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group by date
    const earningsByDate = {};
    
    bookings.forEach(booking => {
      const date = booking.scheduledDate;
      if (!earningsByDate[date]) {
        earningsByDate[date] = {
          date,
          earnings: 0,
          jobs: 0,
        };
      }
      earningsByDate[date].earnings += booking.paidWithSubscription ? 0 : booking.totalPrice;
      earningsByDate[date].jobs += 1;
    });

    const dateRangeData = Object.values(earningsByDate).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    res.status(200).json({
      success: true,
      data: {
        dateRangeData,
        totalEarnings: dateRangeData.reduce((sum, d) => sum + d.earnings, 0),
        totalJobs: dateRangeData.reduce((sum, d) => sum + d.jobs, 0),
      }
    });

  } catch (error) {
    console.error('Get earnings by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve earnings',
    });
  }
};