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
    const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // Your access token from Meta
    const PHONE_NUMBER_ID = "829658253562571"; // Your actual Phone Number ID

    console.log('🔑 DEBUG: Starting sendAutoReply function');
    console.log('📞 DEBUG: Phone number:', phoneNumber);
    console.log('💬 DEBUG: Received message:', receivedMessage);
    console.log('🔑 DEBUG: Access token exists:', !!ACCESS_TOKEN);
    console.log('🆔 DEBUG: Phone Number ID:', PHONE_NUMBER_ID);

    // Check if token exists
    if (!ACCESS_TOKEN) {
        console.error('❌ DEBUG: ACCESS_TOKEN is missing or undefined');
        throw new Error('ACCESS_TOKEN is missing');
    }

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

    console.log('📝 DEBUG: Reply message:', replyMessage);

    try {
        console.log('🚀 DEBUG: Making API request to WhatsApp...');
        console.log('🌐 DEBUG: URL:', `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`);
        
        const requestBody = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            text: { body: replyMessage }
        };

        console.log('📦 DEBUG: Request body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📨 DEBUG: Response status:', response.status);
        console.log('📨 DEBUG: Response OK:', response.ok);

        const data = await response.json();
        console.log('📄 DEBUG: Full API response:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            console.error('❌ DEBUG: API returned error status');
            throw new Error(`WhatsApp API error: ${data.error?.message || 'Unknown error'}`);
        }

        console.log('✅ DEBUG: Auto-reply sent successfully to:', phoneNumber);
        return data;
    } catch (error) {
        console.error('❌ DEBUG: Error in sendAutoReply:', error.message);
        console.error('🔍 DEBUG: Error stack:', error.stack);
        throw error;
    }
}

// GET endpoint for webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔍 DEBUG: Webhook verification attempt');
    console.log('🔍 DEBUG: Mode:', mode);
    console.log('🔍 DEBUG: Token:', token);
    console.log('🔍 DEBUG: Challenge:', challenge);

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            // Respond with 200 OK and challenge token from the request
            console.log('✅ WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            console.log('❌ Webhook verification failed - token mismatch');
            res.sendStatus(403);
        }
    } else {
        console.log('❌ Webhook verification failed - missing mode or token');
        res.sendStatus(403);
    }
});

// POST endpoint to receive webhook events
app.post('/webhook', (req, res) => {
    const body = req.body;

    console.log('=== 🚨 WEBHOOK TRIGGERED 🚨 ===');
    console.log('📨 DEBUG: Webhook POST received');

    // Check if this is an event from a WhatsApp Business Account
    if (body.object) {
        console.log('✅ DEBUG: Valid WhatsApp webhook object');

        // Process the webhook data here
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            console.log(`📨 DEBUG: Found ${messages.length} message(s)`);
            
            messages.forEach((message, index) => {
                console.log(`--- 📝 Processing Message ${index + 1} ---`);
                console.log('📞 DEBUG: Message from:', message.from);
                console.log('💬 DEBUG: Message text:', message.text?.body);
                console.log('📋 DEBUG: Message type:', message.type);
                
                // AUTO-REPLY LOGIC
                if (message.text && message.text.body) {
                    console.log('🚀 DEBUG: Triggering auto-reply...');
                    sendAutoReply(message.from, message.text.body)
                        .then(() => console.log('✅ DEBUG: Auto-reply completed for:', message.from))
                        .catch(error => {
                            console.error('❌ DEBUG: Auto-reply failed for:', message.from);
                            console.error('🔍 DEBUG: Error details:', error.message);
                        });
                } else {
                    console.log('⏭️ DEBUG: No text message, skipping auto-reply');
                }
            });
        } else {
            console.log('❌ DEBUG: No messages found in webhook payload');
            console.log('🔍 DEBUG: Webhook structure:', JSON.stringify(body, null, 2));
        }

        // Return a '200 OK' response to all events
        console.log('✅ DEBUG: Sending 200 response to webhook');
        res.status(200).send('EVENT_RECEIVED');
    } else {
        console.log('❌ DEBUG: Invalid webhook object - no body.object');
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
    console.log(`Verify Token: ${VERIFY_TOKEN}`);
});