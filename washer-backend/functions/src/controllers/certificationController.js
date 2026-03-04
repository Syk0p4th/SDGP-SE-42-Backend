const { db } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * Get certification progress
 * GET /certification/progress
 */
exports.getProgress = async (req, res) => {
  try {
    const { uid } = req.user;

    const providerDoc = await db.collection('providers').doc(uid).get();
    
    if (!providerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found',
      });
    }

    const provider = providerDoc.data();

    const progress = {
      certificationStatus: provider.certificationStatus,
      certificationPath: provider.certificationPath,
      isActive: provider.isActive,
      isVerified: provider.isVerified,
    };

    // Field Certification Progress
    if (provider.certificationPath === 'field_certification' && provider.fieldCertification) {
      const progressPercentage = Math.round(
        (provider.fieldCertification.completedEvaluations / 
         provider.fieldCertification.requiredEvaluations) * 100
      );

      progress.fieldCertification = {
        ...provider.fieldCertification,
        progressPercentage,
      };
    }

    // Training Center Progress
    if (provider.certificationPath === 'training_center' && provider.trainingCenter) {
      progress.trainingCenter = provider.trainingCenter;
    }

    // Professional Experience
    if (provider.professionalExperience) {
      progress.professionalExperience = provider.professionalExperience;
    }

    // Certification Review
    if (provider.certificationReview) {
      progress.certificationReview = provider.certificationReview;
    }

    res.status(200).json({
      success: true,
      data: { progress }
    });

  } catch (error) {
    console.error('Get certification progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve progress',
    });
  }
};

/**
 * Get available training centers
 * GET /certification/training-centers
 */
exports.getTrainingCenters = async (req, res) => {
  try {
    const snapshot = await db
      .collection('training_centers')
      .where('isActive', '==', true)
      .where('isVerified', '==', true)
      .get();

    const centers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({
      success: true,
      data: { centers }
    });

  } catch (error) {
    console.error('Get training centers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve training centers',
    });
  }
};

/**
 * Submit evaluation (mentor only)
 * POST /certification/evaluate
 */
exports.submitEvaluation = async (req, res) => {
  try {
    const { uid } = req.user; // Mentor's UID
    const { traineeId, bookingId, ratings, feedback } = req.body;

    // Verify mentor is certified
    const mentorDoc = await db.collection('providers').doc(uid).get();
    if (!mentorDoc.exists || mentorDoc.data().certificationStatus !== 'certified') {
      return res.status(403).json({
        success: false,
        message: 'Only certified providers can mentor',
      });
    }

    // Verify trainee
    const traineeDoc = await db.collection('providers').doc(traineeId).get();
    if (!traineeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Trainee not found',
      });
    }

    const trainee = traineeDoc.data();
    
    if (trainee.certificationPath !== 'field_certification') {
      return res.status(400).json({
        success: false,
        message: 'Trainee is not in field certification program',
      });
    }

    // Check if already evaluated
    const existingEvaluations = trainee.fieldCertification?.evaluations || [];
    const alreadyEvaluated = existingEvaluations.some(e => e.mentorId === uid);
    
    if (alreadyEvaluated) {
      return res.status(400).json({
        success: false,
        message: 'You have already evaluated this trainee',
      });
    }

    // Calculate overall rating
    const ratingValues = Object.values(ratings);
    const overallRating = ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length;

    // Create evaluation
    const evaluation = {
      id: `eval_${Date.now()}`,
      mentorId: uid,
      mentorName: mentorDoc.data().displayName,
      bookingId,
      ratings,
      overallRating: Math.round(overallRating * 10) / 10,
      feedback,
      approved: overallRating >= 3.5,
      evaluatedAt: new Date().toISOString(),
    };

    // Store evaluation
    await db.collection('certification_evaluations').add({
      ...evaluation,
      traineeId,
      type: 'field_evaluation',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update trainee profile
    const updatedEvaluations = [...existingEvaluations, evaluation];
    const approvedCount = updatedEvaluations.filter(e => e.approved).length;

    const updates = {
      'fieldCertification.evaluations': updatedEvaluations,
      'fieldCertification.completedEvaluations': approvedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // If reached required, mark for admin review
    if (approvedCount >= trainee.fieldCertification.requiredEvaluations) {
      updates.certificationStatus = 'pending_admin_review';
      updates['certificationReview.status'] = 'pending';
    }

    await db.collection('providers').doc(traineeId).update(updates);

    res.status(200).json({
      success: true,
      message: 'Evaluation submitted successfully',
      data: {
        evaluation,
        progress: {
          completed: approvedCount,
          required: trainee.fieldCertification.requiredEvaluations,
        }
      }
    });

  } catch (error) {
    console.error('Submit evaluation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit evaluation',
    });
  }
};