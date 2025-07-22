const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/authMiddleware'); 

// POST /api/book - Handles new flight bookings (Protected)
router.post('/', protect, bookController.handleBooking);

// GET /api/book - Fetches bookings for the logged-in user (Protected)
router.get('/', protect, async (req, res) => { 
  try {
    // Find only bookings that belong to the logged-in user
    const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// DELETE /api/book/:bookingId - Handles booking cancellation (Protected)
router.delete('/:bookingId', protect, bookController.cancelBooking); 

module.exports = router;