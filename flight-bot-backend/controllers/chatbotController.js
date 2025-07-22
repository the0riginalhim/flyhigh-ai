const flightData = require('../data/flights');
const { 
    extractFlightDetails, 
    generateFakeFlight,
    processMultilingualMessage, 
    translateText              
} = require('../utils/simpleExtractor');

exports.handleUserMessage = async (req, res) => {
  try {
    const { message: userMessage, history: chatHistory } = req.body;

    // 1. Detect language and get English translation
    const langResult = await processMultilingualMessage(userMessage);
    const detectedLanguage = langResult.language;
    const translatedMessage = langResult.translatedMessage;

    // 2. Process the translated (English) message to extract details
    const extractedDetails = await extractFlightDetails(translatedMessage, chatHistory);
    const { from, to, date, passengers, followUpQuestion } = extractedDetails;

    // 3. Handle follow-up questions (translate if necessary)
    if (followUpQuestion) {
      const finalReply = await translateText(followUpQuestion, detectedLanguage);
      return res.json({ reply: finalReply, flights: [] });
    }

    if (!from || !to || !date) {
      const errorReply = "Sorry, I need a departure city, destination, and a date to search for flights.";
      const finalReply = await translateText(errorReply, detectedLanguage);
      return res.json({ reply: finalReply, flights: [] });
    }

    // Capitalize city names for matching
    const capitalizedFrom = from.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const capitalizedTo = to.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Filter flights based on the English details
    let results = flightData.filter(flight =>
        flight.from.toLowerCase() === capitalizedFrom.toLowerCase() &&
        flight.to.toLowerCase() === capitalizedTo.toLowerCase() &&
        flight.date.toLowerCase() === date.toLowerCase()
    );
    
    // Generate fake flights if needed
    if (results.length < 2) {
        const needed = 2 - results.length;
        console.log(`Found ${results.length} real flights. Generating ${needed} more.`);
        const generatedFlights = await generateFakeFlight({ from: capitalizedFrom, to: capitalizedTo, date, count: needed });
        results = [...results, ...generatedFlights];
    }
    
    // 4. Create the reply message in English, then translate it
    let replyMessage = '';
    if (results.length > 0) {
        replyMessage = `I found ${results.length} flight(s) from ${capitalizedFrom} to ${capitalizedTo} for you.`;
    } else {
        replyMessage = `Sorry, I couldn't find any flights from ${capitalizedFrom} to ${capitalizedTo} on ${date}. Please try another search.`;
    }
    
    const finalReply = await translateText(replyMessage, detectedLanguage);

    return res.json({
      reply: finalReply,
      flights: results,
      passengers: passengers
    });

  } catch (err) {
    console.error('Error in chatbot controller:', err);
    res.status(500).json({ reply: 'Sorry, a critical error occurred on my end. Please try again.' });
  }
};