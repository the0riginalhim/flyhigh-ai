const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  groupBookingId: { type: String, required: true, index: true },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  
  flightId: String,
  passengerDetails: {
      name: { type: String, required: true },
  },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String },
  airline: String,
  from: String,
  to: String,
  date: String,
  departure: String,
  arrival: String,
  price: Number,
  status: {
    type: String,
    default: 'confirmed'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);