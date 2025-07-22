document.addEventListener('DOMContentLoaded', () => {

    const authToken = localStorage.getItem('flightBotToken');
    if (!authToken) {
        window.location.href = '/login.html';
        return; 
    }

    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const themeToggle = document.getElementById('theme-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    const viewBookingsBtn = document.getElementById('view-bookings-btn');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    const filterBar = document.getElementById('filter-bar');
    const sortFlightsSelect = document.getElementById('sort-flights');
    const filterAirlineSelect = document.getElementById('filter-airline');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // Modal References
    const bookingsModal = document.getElementById('bookings-modal');
    const closeBookingsModal = document.getElementById('close-bookings-modal');
    const bookingsList = document.getElementById('bookings-list');
    
    const passengerModal = document.getElementById('passenger-details-modal');
    const closePassengerModal = document.getElementById('close-passenger-modal');
    const passengerForm = document.getElementById('passenger-form');
    const passengerCountInput = document.getElementById('passenger-count');
    const passengerNamesContainer = document.getElementById('passenger-names-container');
    
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentModal = document.getElementById('close-payment-modal');
    const paymentForm = document.getElementById('payment-form');
    
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationModalMessage = document.getElementById('confirmation-modal-message');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const cancelActionBtn = document.getElementById('cancel-action-btn');
    const closeConfirmationModal = document.getElementById('close-confirmation-modal');

    // --- State Management ---
    let chatHistory = [];
    let currentFlights = [];
    let bookingPayload = null;

    // --- API Base URL ---
    const API_URL = 'http://localhost:5000';
    
    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    themeToggle.addEventListener('click', handleThemeToggle);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Filter Bar Listeners
    sortFlightsSelect.addEventListener('change', applyFiltersAndSort);
    filterAirlineSelect.addEventListener('change', applyFiltersAndSort);
    resetFiltersBtn.addEventListener('click', () => {
        sortFlightsSelect.value = 'default';
        filterAirlineSelect.value = 'all';
        applyFiltersAndSort();
    });
    
    // Modal Listeners
    viewBookingsBtn.addEventListener('click', () => {
        bookingsModal.classList.remove('hidden');
        fetchAndDisplayBookings();
    });
    closeBookingsModal.addEventListener('click', () => bookingsModal.classList.add('hidden'));
    closePassengerModal.addEventListener('click', () => passengerModal.classList.add('hidden'));
    closePaymentModal.addEventListener('click', () => paymentModal.classList.add('hidden'));
    closeConfirmationModal.addEventListener('click', () => confirmationModal.classList.add('hidden'));
    cancelActionBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));

    // Form Listeners
    passengerCountInput.addEventListener('change', () => generatePassengerNameInputs(passengerCountInput.value));
    passengerForm.addEventListener('submit', handlePassengerFormSubmit);
    paymentForm.addEventListener('submit', handlePaymentFormSubmit);

    // Event Delegation
    document.addEventListener('click', (e) => {
        // Use .closest() 
        const bookButton = e.target.closest('.book-btn-final');
        if (bookButton) {
            const flightId = bookButton.dataset.flightId;
            showPassengerForm(flightId);
        }
        if (e.target.classList.contains('cancel-btn')) {
            const bookingId = e.target.dataset.bookingId;
            showConfirmationModal(
                `Are you sure you want to cancel booking ${bookingId}?`,
                () => cancelBookingAPI(bookingId)
            );
        }
        if (e.target.classList.contains('prompt-link')) {
            e.preventDefault();
            const query = e.target.textContent;
            userInput.value = query;
            handleSendMessage();
        }
    });

    // --- Theme Persistence ---
    function applyTheme() {
        const savedTheme = localStorage.getItem('flightBotTheme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
    }

    function handleThemeToggle() {
        document.body.classList.toggle('dark');
        if (document.body.classList.contains('dark')) {
            localStorage.setItem('flightBotTheme', 'dark');
        } else {
            localStorage.setItem('flightBotTheme', 'light');
        }
    }

    // --- Initialization ---
    applyTheme();


    // --- Core Functions ---
    function handleLogout() {
        localStorage.removeItem('flightBotToken');
        localStorage.removeItem('flightBotTheme');
        window.location.href = '/login.html';
    }

    function handleSendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage) {
            if(suggestionsContainer) {
                suggestionsContainer.classList.add('hidden');
            }
            filterBar.classList.add('hidden'); 
            addMessage(userMessage, 'user');
            callChatAPI(userMessage);
            userInput.value = '';
        }
    }

    async function callChatAPI(userMessage) {
        showTypingIndicator();
        try {
            const response = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ message: userMessage, history: chatHistory })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to get response from bot.');

            removeTypingIndicator();

            if (data.reply) addMessage(data.reply, 'bot');
            if (data.flights && data.flights.length > 0) {
                currentFlights = data.flights;
                setupFilterBar(data.flights);
                addFlightsToChat(data.flights);
            }
        } catch (error) {
            removeTypingIndicator();
            showToast(error.message, 'error');
        }
    }
    
    function setupFilterBar(flights) {
        const uniqueAirlines = [...new Set(flights.map(f => f.airline))];
        filterAirlineSelect.innerHTML = `<option value="all">All Airlines</option>` +
            uniqueAirlines.map(a => `<option value="${a}">${a}</option>`).join('');
        
        sortFlightsSelect.value = 'default';
        filterAirlineSelect.value = 'all';

        filterBar.classList.remove('hidden');
    }

    function applyFiltersAndSort() {
        let processed = [...currentFlights];
        const sortBy = sortFlightsSelect.value;
        const filterBy = filterAirlineSelect.value;

        if (filterBy !== 'all') {
            processed = processed.filter(f => f.airline === filterBy);
        }
        if (sortBy === 'price_asc') {
            processed.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'duration_asc') {
            processed.sort((a, b) => convertDurationToMinutes(a.duration) - convertDurationToMinutes(b.duration));
        }
        
        addFlightsToChat(processed, true);
    }

    function addFlightsToChat(flights, isUpdate = false) {
        let flightsContainer = document.getElementById('flight-results-container');
        
        if (isUpdate && flightsContainer) {
            flightsContainer.innerHTML = '';
        } else {
            if (flightsContainer) flightsContainer.remove();
            flightsContainer = document.createElement('div');
            flightsContainer.id = 'flight-results-container';
            flightsContainer.className = 'bot-message';
            chatMessages.appendChild(flightsContainer);
        }

        if (flights.length === 0) {
            flightsContainer.innerHTML = `<p>No flights match your criteria.</p>`;
        } else {
            flights.forEach(flight => {
                const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(flight.price);
                const card = document.createElement('div');
                card.className = 'flight-card-final'; 
                card.innerHTML = `
                    <div class="flight-card-header">
                        <span>${flight.airline}</span>
                        <span>${flight.id}</span>
                    </div>
                    <div class="flight-card-body">
                        <span>${flight.from} → ${flight.to}</span>
                        <span>${flight.duration}</span>
                    </div>
                    <div class="flight-card-footer">
                        <span class="flight-price">${price}</span>
                        <button class="book-btn-final" data-flight-id="${flight.id}">Book</button>
                    </div>
                `;
                flightsContainer.appendChild(card);
            });
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showPassengerForm(flightId) {
        const flightToBook = currentFlights.find(f => f.id === flightId);
        if (!flightToBook) {
            showToast('Error: Could not find flight details.', 'error');
            return;
        }
        bookingPayload = {
            flightId: flightToBook.id,
            flightDetails: flightToBook.id.startsWith('AI-') ? flightToBook : null
        };
        passengerForm.reset();
        passengerCountInput.value = 1;
        generatePassengerNameInputs(1);
        passengerModal.classList.remove('hidden');
    }

    function generatePassengerNameInputs(count) {
        passengerNamesContainer.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Passenger ${i} Full Name`;
            input.className = 'form-input passenger-name-input';
            input.required = true;
            passengerNamesContainer.appendChild(input);
        }
    }

    function handlePassengerFormSubmit(e) {
        e.preventDefault();
        const passengerNameInputs = document.querySelectorAll('.passenger-name-input');
        const passengers = Array.from(passengerNameInputs)
            .map(input => ({ name: input.value.trim() }))
            .filter(p => p.name);

        if (passengers.length === 0) {
            showToast('Please enter at least one passenger name.', 'error');
            return;
        }

        const contactEmail = document.getElementById('contact-email').value.trim();
        if (!contactEmail) {
            showToast('A contact email is required.', 'error');
            return;
        }
        
        bookingPayload.passengers = passengers;
        bookingPayload.contactEmail = contactEmail;
        bookingPayload.contactPhone = document.getElementById('contact-phone').value.trim();

        passengerModal.classList.add('hidden');
        paymentModal.classList.remove('hidden');
    }

    function handlePaymentFormSubmit(e) {
        e.preventDefault();
        const cardNumber = document.getElementById('card-number').value;
        const cardName = document.getElementById('card-name').value;
        if (!cardNumber || !cardName) {
            showToast('Please fill in all required payment fields.', 'error');
            return;
        }

        paymentModal.classList.add('hidden');
        showToast('Processing payment...', 'success');

        setTimeout(() => {
            finalizeBooking();
        }, 2000);
    }

    async function finalizeBooking() {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/book`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(bookingPayload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Booking failed.');
            
            showToast(result.message, 'success');
            addMessage(`I've confirmed your booking for flight ${bookingPayload.flightId}. Your Group ID is ${result.groupBookingId}.`, 'bot');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
            bookingPayload = null;
        }
    }

    async function fetchAndDisplayBookings() {
        bookingsList.innerHTML = `<p class="text-center">Loading bookings...</p>`;
        try {
            const response = await fetch(`${API_URL}/api/book`, { headers: getAuthHeaders() });
            const bookings = await response.json();
            if (!response.ok) throw new Error(bookings.error || 'Failed to fetch bookings.');

            if (bookings.length === 0) {
                bookingsList.innerHTML = `<p class="text-center">You have no bookings yet.</p>`;
                return;
            }

            bookingsList.innerHTML = bookings.map(booking => `
                <div class="booking-card">
                    <h3>Booking ID: ${booking.bookingId}</h3>
                    <p><strong>Flight:</strong> ${booking.airline} (${booking.flightId}) from ${booking.from} to ${booking.to}</p>
                    <p><strong>Date:</strong> ${booking.date}</p>
                    <p><strong>Passenger:</strong> ${booking.passengerDetails.name}</p>
                    <button class="cancel-btn" data-booking-id="${booking.bookingId}">Cancel Booking</button>
                </div>
            `).join('');
        } catch (error) {
            bookingsList.innerHTML = `<p class="text-center text-red-500">${error.message}</p>`;
        }
    }
    
    function showConfirmationModal(message, onConfirm) {
        confirmationModalMessage.textContent = message;
        confirmationModal.classList.remove('hidden');

        const newConfirmBtn = confirmActionBtn.cloneNode(true);
        confirmActionBtn.parentNode.replaceChild(newConfirmBtn, confirmActionBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            confirmationModal.classList.add('hidden');
            onConfirm();
        });
    }

    async function cancelBookingAPI(bookingId) {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/book/${bookingId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Cancellation failed.');
            showToast(result.message, 'success');
            fetchAndDisplayBookings(); 
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }


    // --- Helper Functions ---
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
    }

    function addMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.className = `message-bubble ${sender}-message`;
        messageElement.innerHTML = message.replace(/\n/g, '<br>');
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        if (sender !== 'bot-error') {
            chatHistory.push({ role: sender === 'user' ? 'user' : 'assistant', content: message });
            if (chatHistory.length > 8) chatHistory.shift();
        }
    }

    function showTypingIndicator() {
        const typingBubble = document.createElement('div');
        typingBubble.className = 'typing-indicator-bubble';
        typingBubble.id = 'typing-indicator';
        typingBubble.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        chatMessages.appendChild(typingBubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function convertDurationToMinutes(durationStr) {
        if (!durationStr || typeof durationStr !== 'string') return Infinity;
        let totalMinutes = 0;
        const hoursMatch = durationStr.match(/(\d+)\s*h/);
        const minutesMatch = durationStr.match(/(\d+)\s*m/);
        if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
        if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);
        return totalMinutes > 0 ? totalMinutes : Infinity;
    }

    function setLoading(isLoading) {
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

});
