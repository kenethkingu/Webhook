const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Your verify token - choose any random string
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "Ken_12345";

// Port configuration
const PORT = process.env.PORT || 3000;

// AUTO-REPLY FUNCTION - USING YOUR PHONE NUMBER ID
async function sendAutoReply(phoneNumber, receivedMessage) {
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN; // Your access token from Meta
    const PHONE_NUMBER_ID = "829658253562571"; // Your actual Phone Number ID

    let replyMessage = "";

    // Customize your auto-reply logic here
    const message = receivedMessage.toLowerCase();

    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        replyMessage = "Hello! 👋 Thanks for reaching out. How can I help you today?";
    } else if (message.includes('price') || message.includes('cost')) {
        replyMessage = "Thanks for your interest! Please visit our website for pricing details.";
    } else if (message.includes('help') || message.includes('support')) {
        replyMessage = "Our support team is here to help! Please describe your issue.";
    } else if (message.includes('order') || message.includes('delivery')) {
        replyMessage = "For order inquiries, please share your order number.";
    } else if (message.includes('bulk') || message.includes('mass')) {
        replyMessage = "We offer bulk messaging services! Contact us for pricing and features.";
    } else {
        replyMessage = "Thank you for your message! We've received it and will get back to you soon. 😊";
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phoneNumber,
                text: { body: replyMessage }
            })
        });

        const data = await response.json();
        console.log('Auto-reply sent to:', phoneNumber);
        console.log('API Response:', data);
        
        return data;
    } catch (error) {
        console.error('Error sending auto-reply:', error);
        throw error;
    }
}

// GET endpoint for webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Respond with 200 OK and challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// POST endpoint to receive webhook events
app.post('/webhook', (req, res) => {
    const body = req.body;

    // Check if this is an event from a WhatsApp Business Account
    if (body.object) {
        console.log('Received webhook:');
        console.log(JSON.stringify(body, null, 2));

        // Process the webhook data here
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            messages.forEach(message => {
                console.log('Message received from:', message.from);
                console.log('Message text:', message.text?.body);
                
                // AUTO-REPLY LOGIC
                if (message.text && message.text.body) {
                    sendAutoReply(message.from, message.text.body)
                        .then(() => console.log('Auto-reply sent to:', message.from))
                        .catch(error => console.error('Auto-reply failed:', error));
                }
            });
        }

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp Business Account
        res.sendStatus(404);
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send('WhatsApp Webhook Server is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook URL: https://your-render-app.onrender.com/webhook`);
});