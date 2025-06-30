require('dotenv').config(); // 👈 Load .env variables first

const dialogflow = require("@google-cloud/dialogflow");
const { WebhookClient } = require("dialogflow-fulfillment");
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const twilio = require("twilio");

// ✅ Twilio credentials
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8080;

app.post("/webhook", async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  console.log("🔔 Dialogflow Webhook Triggered");

  function welcome(agent) {
    agent.add("Hello! I’m the virtual assistant for Saylani Roti Bank. How can I assist you today?");
  }

  function rotiBankInfo(agent) {
    agent.add("Saylani Roti Bank provides free meals daily. You can support us by donating food or money to help the needy.");
  }

  function mealTimings(agent) {
    agent.add("Meals are served daily from 12:00 PM to 3:00 PM and 6:00 PM to 9:00 PM.");
  }

  async function donate(agent) {
    const donationType = agent.parameters.any || agent.parameters.donation_type || "donation";
    const amount = agent.parameters.number || 0;
    const personObj = agent.parameters.person;
    const email = agent.parameters.email;
    const rawPhone = agent.parameters["phone-number"];

    const name = (typeof personObj === "object" && personObj.name) ? personObj.name : personObj || "Donor";
    // Ensure phone number includes country code (e.g., '92' for Pakistan)
    let phone = rawPhone ? rawPhone.toString().replace(/\D/g, "") : "";
    if (phone && phone.length <= 11 && !phone.startsWith("92")) {
      phone = "92" + phone.replace(/^0+/, ""); // Remove leading 0s and add country code
    }

    console.log("📦 Donation Details:", { donationType, amount, name, email, phone });

    if (!donationType || !amount || !name || !email || !phone) {
      agent.add("❗ Some details are missing. Please provide all required donation info.");
      return;
    }

    const messageText = `Dear ${name}, thank you for your generous donation of ${amount} via ${donationType}. Your support helps Saylani Roti Bank feed those in need.`;

    // ✅ Email Setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let emailSent = false;
    let whatsappSent = false;
    let emailError = null;
    let whatsappError = null;

    try {
      await transporter.sendMail({
        from: `Saylani Roti Bank <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Donation Confirmation",
        text: messageText,
      });
      emailSent = true;
      console.log("✅ Email sent to:", email);
    } catch (err) {
      emailError = err.message;
      console.error("❌ Email Error:", err.message);
    }

    try {
      await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `whatsapp:+${phone}`,
        body: messageText,
      });
      whatsappSent = true;
      console.log("✅ WhatsApp sent to:", phone);
    } catch (err) {
      whatsappError = err.message;
      console.error("❌ WhatsApp Error:", err.message);
    }

    if (emailSent && whatsappSent) {
      agent.add(`🌟 Thank you, ${name}! Your ${donationType} of ${amount} has been recorded.
Confirmation sent to ${email} and WhatsApp +${phone}. May Allah bless you! 🤲`);
    } else {
      let errorMsg = `Some issues occurred:\n`;
      if (!emailSent) errorMsg += `- Email error: ${emailError}\n`;
      if (!whatsappSent) errorMsg += `- WhatsApp error: ${whatsappError}\n`;
      agent.add(errorMsg + '\nPlease check and try again.');
    }
  }

  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("Roti Bank Info", rotiBankInfo);
  intentMap.set("Meal Timings", mealTimings);
  intentMap.set("Donate", donate);

  agent.handleRequest(intentMap);
});

app.listen(PORT, () => {
  console.log(`🚀 Saylani Roti Bank Server is running on port ${PORT}`);
});
