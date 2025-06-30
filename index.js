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

console.log("Loaded ENV:", {
  EMAIL_USER: process.env.EMAIL_USER,
  TWILIO_SID: process.env.TWILIO_SID,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  PORT: PORT
});

app.get("/", (req, res) => {
  res.send("👋 Welcome to Saylani Roti Bank Virtual Assistant!");
}); 

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
      console.error("❌ Email Error:", err);
    }

    // WhatsApp sending logic with sandbox/business number check
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const isSandbox = twilioFrom === "+14155238886";
    if (isSandbox) {
      // Twilio sandbox: remind user to join sandbox
      console.log("[Twilio Sandbox] Make sure recipient has joined the sandbox by sending the join code to +14155238886");
    } else {
      // Business number: must be approved by Twilio
      console.log("[Twilio Business] Using approved WhatsApp business number.");
    }
    try {
      await twilioClient.messages.create({
        from: `whatsapp:${twilioFrom}`,
        to: `whatsapp:+${phone}`,
        body: messageText,
      });
      whatsappSent = true;
      console.log("✅ WhatsApp sent to:", phone);
    } catch (err) {
      whatsappError = err.message;
      if (err.message && err.message.includes("not a valid phone number")) {
        whatsappError +=
          isSandbox
            ? " (Twilio Sandbox: Make sure the recipient has joined the sandbox by sending the join code to +14155238886)"
            : " (Your Twilio WhatsApp sender number is not approved. Use a valid business number or the sandbox number.)";
      }
      console.error("❌ WhatsApp Error:", err);
    }
    // ✅ ✅ 🔽 Add these lines here
    console.log("WHATSAPP SENT STATUS:", whatsappSent);
    console.log("EMAIL SENT STATUS:", emailSent);

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

app.get("/test-email", async (req, res) => {
  const testEmail = req.query.email || process.env.EMAIL_USER;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  try {
    await transporter.sendMail({
      from: `Saylani Roti Bank <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: "Test Email",
      text: "This is a test email from Saylani Roti Bank server.",
    });
    res.send("✅ Test email sent to: " + testEmail);
  } catch (err) {
    res.status(500).send("❌ Email Error: " + err.message);
  }
});

app.get("/test-whatsapp", async (req, res) => {
  const testPhone = req.query.phone || "923001234567"; // Change to your test number
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:+${testPhone}`,
      body: "This is a test WhatsApp message from Saylani Roti Bank server.",
    });
    res.send("✅ Test WhatsApp sent to: +" + testPhone);
  } catch (err) {
    res.status(500).send("❌ WhatsApp Error: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Saylani Roti Bank Server is running on port ${PORT}`);
});
