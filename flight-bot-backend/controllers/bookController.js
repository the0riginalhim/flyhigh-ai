const flights = require('../data/flights');
const Booking = require('../models/Booking');

// The handleBooking function
exports.handleBooking = async (req, res) => {
  const { flightId, flightDetails, passengers, contactEmail, contactPhone } = req.body;

  if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ error: 'Passenger details are required.' });
  }
  if (!contactEmail) {
    return res.status(400).json({ error: 'A contact email is required.' });
  }

  let flightToBook = null;
  if (flightId) {
    flightToBook = flights.find(f => f.id === flightId);
  }
  if (!flightToBook && flightDetails) {
    flightToBook = flightDetails;
  }

  if (!flightToBook) {
    return res.status(404).json({ error: 'Flight not found or invalid booking request.' });
  }

  try {
    const groupBookingId = `GRP-${Date.now()}`;
    const newBookings = [];
    const createdBookingIds = [];

    for (const passenger of passengers) {
      const bookingId = `BK${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
      createdBookingIds.push(bookingId);

      const booking = new Booking({
        user: req.user._id, 
        bookingId,
        groupBookingId,
        flightId: flightToBook.id,
        passengerDetails: { name: passenger.name },
        contactEmail,
        contactPhone,
        airline: flightToBook.airline,
        from: flightToBook.from,
        to: flightToBook.to,
        date: flightToBook.date,
        departure: flightToBook.departure,
        arrival: flightToBook.arrival,
        price: flightToBook.price,
      });
      newBookings.push(booking);
    }

    await Booking.insertMany(newBookings);

    res.json({
      groupBookingId,
      bookingIds: createdBookingIds,
      passengers: passengers.length,
      flight: flightToBook,
      status: 'confirmed',
      message: `Booking confirmed for ${passengers.length} passenger(s). Group ID: ${groupBookingId}.`
    });
  } catch (err) {
    console.error('Error saving group booking to MongoDB:', err);
    res.status(500).json({ error: 'Failed to save group booking.' });
  }
};


exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const booking = await Booking.findOne({ bookingId: bookingId });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Security Check: Ensure the booking belongs to the user making the request
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to cancel this booking.' });
    }

    // If checks pass, delete the booking
    await booking.deleteOne();

    res.json({ message: `Booking ${bookingId} cancelled successfully.` });

  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
};
