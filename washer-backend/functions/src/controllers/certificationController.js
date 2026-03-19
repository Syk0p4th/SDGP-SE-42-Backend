exports.getMyTrainees = async (req, res) => {
  try {
    const { uid } = req.user;

    const mentorDoc = await db.collection('providers').doc(uid).get();
    if (!mentorDoc.exists) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const mentorData = mentorDoc.data();

    // Must be certified
    if (mentorData.certificationStatus !== 'certified') {
      return res.status(403).json({
        success: false,
        message: 'Only certified washers can access mentor features',
        code: 'NOT_CERTIFIED',
      });
    }

    // Must have accepted the mentorship agreement
    if (!mentorData.isMentor && !mentorData.mentorshipAgreement?.accepted) {
      return res.status(403).json({
        success: false,
        message: 'You must accept the Mentorship Program agreement before accessing trainees.',
        code: 'AGREEMENT_REQUIRED',
      });
    }

    const snapshot = await db
      .collection('providers')
      .where('certificationPath', '==', 'field_certification')
      .where('fieldCertification.assignedMentors', 'array-contains', uid)
      .get();

    const trainees = snapshot.docs.map((doc) => {
      const data = doc.data();
      const allEvaluations = data.fieldCertification?.evaluations || [];
      const myEvaluations = allEvaluations.filter((e) => e.mentorId === uid);
      const completedSessions = data.fieldCertification?.completedSessions || 0;
      const requiredSessions = data.fieldCertification?.requiredSessions || 3;

      let averageRating = null;
      if (myEvaluations.length > 0) {
        const total = myEvaluations.reduce((sum, e) => {
          const r = e.ratings;
          return sum + (r.technique + r.speed + r.customerService + r.safety) / 4;
        }, 0);
        averageRating = Math.round((total / myEvaluations.length) * 10) / 10;
      }

      return {
        uid: doc.id,
        displayName: data.displayName || 'Unknown',
        email: data.email || '',
        phone: data.phone || '',
        photoURL: data.photoURL || null,
        createdAt: data.createdAt || null,
        certificationStatus: data.certificationStatus,
        certificationPath: data.certificationPath,
        professionalExperience: data.professionalExperience || {},
        fieldCertification: {
          assignedMentors: data.fieldCertification?.assignedMentors || [],
          evaluations: myEvaluations,
          completedSessions,
          requiredSessions,
        },
        averageRating,
      };
    });

    res.status(200).json({ success: true, data: { trainees } });
  } catch (error) {
    console.error('Get my trainees error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve trainees' });
  }
};

/**
 * Submit evaluation (mentor → trainee)
 * POST /certification/evaluate
 */
exports.submitEvaluation = async (req, res) => {
  try {
    const { uid } = req.user;
    const { traineeId, bookingId, ratings, feedback, notes } = req.body;

    if (!traineeId || !ratings || !feedback) {
      return res.status(400).json({ success: false, message: 'traineeId, ratings, and feedback are required' });
    }

    if (feedback.trim().length < 50) {
      return res.status(400).json({ success: false, message: 'Feedback must be at least 50 characters' });
    }

    const ratingFields = ['technique', 'speed', 'customerService', 'safety'];
    for (const field of ratingFields) {
      const val = Number(ratings[field]);
      if (!val || val < 1 || val > 5) {
        return res.status(400).json({ success: false, message: `Rating for "${field}" must be between 1 and 5` });
      }
    }

    // Verify mentor is certified AND has accepted agreement
    const mentorDoc = await db.collection('providers').doc(uid).get();
    if (!mentorDoc.exists) {
      return res.status(404).json({ success: false, message: 'Mentor profile not found' });
    }

    const mentorData = mentorDoc.data();

    if (mentorData.certificationStatus !== 'certified') {
      return res.status(403).json({
        success: false,
        message: 'Only certified providers can submit evaluations',
      });
    }

    // Must have accepted the mentorship agreement
    if (!mentorData.isMentor && !mentorData.mentorshipAgreement?.accepted) {
      return res.status(403).json({
        success: false,
        message: 'You must accept the Mentorship Program agreement first.',
        code: 'AGREEMENT_REQUIRED',
      });
    }

    const traineeDoc = await db.collection('providers').doc(traineeId).get();
    if (!traineeDoc.exists) {
      return res.status(404).json({ success: false, message: 'Trainee not found' });
    }

    const trainee = traineeDoc.data();

    if (trainee.certificationPath !== 'field_certification') {
      return res.status(400).json({ success: false, message: 'Trainee is not in field certification program' });
    }

    if (trainee.certificationStatus !== 'in_training') {
      return res.status(400).json({ success: false, message: 'Trainee is not currently in training' });
    }

    const assignedMentors = trainee.fieldCertification?.assignedMentors || [];
    if (!assignedMentors.includes(uid)) {
      return res.status(403).json({ success: false, message: 'You are not assigned as a mentor for this trainee' });
    }

    const completedSessions = trainee.fieldCertification?.completedSessions || 0;
    const requiredSessions = trainee.fieldCertification?.requiredSessions || 3;

    if (completedSessions >= requiredSessions) {
      return res.status(400).json({ success: false, message: 'Trainee has already completed all required sessions' });
    }

    const ratingValues = ratingFields.map((f) => Number(ratings[f]));
    const overallRating = ratingValues.reduce((sum, r) => sum + r, 0) / ratingValues.length;

    const evaluation = {
      id: `eval_${Date.now()}`,
      mentorId: uid,
      mentorName: mentorData.displayName || 'Unknown',
      bookingId: bookingId || null,
      ratings: {
        technique: Number(ratings.technique),
        speed: Number(ratings.speed),
        customerService: Number(ratings.customerService),
        safety: Number(ratings.safety),
      },
      overallRating: Math.round(overallRating * 10) / 10,
      feedback: feedback.trim(),
      notes: notes ? notes.trim() : '',
      submittedAt: new Date().toISOString(),
    };

    await db.collection('certification_evaluations').add({
      ...evaluation,
      traineeId,
      type: 'field_evaluation',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const existingEvaluations = trainee.fieldCertification?.evaluations || [];
    const newCompletedSessions = completedSessions + 1;
    const isComplete = newCompletedSessions >= requiredSessions;

    await db.collection('providers').doc(traineeId).update({
      'fieldCertification.evaluations': [...existingEvaluations, evaluation],
      'fieldCertification.completedSessions': newCompletedSessions,
      certificationStatus: isComplete ? 'pending_certification' : 'in_training',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: 'Evaluation submitted successfully',
      data: {
        evaluation,
        progress: {
          completedSessions: newCompletedSessions,
          requiredSessions,
          isComplete,
        },
      },
    });
  } catch (error) {
    console.error('Submit evaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit evaluation' });
  }
};