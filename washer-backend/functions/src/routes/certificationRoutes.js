const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getProgress,
  getTrainingCenters,
  getMyTrainees,
  submitEvaluation,
} = require('../controllers/certificationController');

router.use(authenticate);

router.get('/progress', getProgress);
router.get('/training-centers', getTrainingCenters);
router.get('/my-trainees', getMyTrainees);
router.post('/evaluate', submitEvaluation);

module.exports = router;