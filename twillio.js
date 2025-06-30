const twilio = require('twilio');

// Use correct environment variable names
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER; // Should be like +14155238886
const client = twilio(accountSid, authToken);

/**
 * Send WhatsApp message using Twilio
 * @param {string} toPhone - Receiver's phone number (e.g., '923001234567')
 * @param {string} message - Message text to send
 */
async function sendWhatsAppMessage(toPhone, message) {
  try {
    const result = await client.messages.create({
      from: `whatsapp:${twilioFrom}`,
      to: `whatsapp:+${toPhone}`,
      body: message,
    });
    console.log("✅ WhatsApp message sent:", result.sid);
    return result.sid;
  } catch (error) {
    console.error("❌ WhatsApp send error:", error.message);
    throw error;
  }
}

module.exports = sendWhatsAppMessage;
