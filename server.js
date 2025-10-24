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

// BULK MESSAGING FUNCTION
async function sendBulkMessages(phoneNumbers, message) {
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "829658253562571";

    console.log('📨 Starting bulk message send');
    console.log('📊 Total recipients:', phoneNumbers.length);
    console.log('💬 Message:', message);

    const results = {
        successful: [],
        failed: []
    };

    // Send messages with delay to avoid rate limits
    for (let i = 0; i < phoneNumbers.length; i++) {
        const phoneNumber = phoneNumbers[i];
        
        try {
            console.log(`📤 Sending to ${i + 1}/${phoneNumbers.length}: ${phoneNumber}`);
            
            const response = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phoneNumber,
                    text: { body: message }
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                console.log(`✅ Sent to ${phoneNumber}`);
                results.successful.push({
                    phone: phoneNumber,
                    messageId: data.messages?.[0]?.id
                });
            } else {
                console.error(`❌ Failed for ${phoneNumber}:`, data.error?.message);
                results.failed.push({
                    phone: phoneNumber,
                    error: data.error?.message
                });
            }

            // Add delay to avoid rate limits (1 second between messages)
            if (i < phoneNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error(`❌ Error sending to ${phoneNumber}:`, error.message);
            results.failed.push({
                phone: phoneNumber,
                error: error.message
            });
        }
    }

    console.log('📊 Bulk send completed:');
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    return results;
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

// BULK MESSAGING ENDPOINT
app.post('/bulk-send', express.json(), async (req, res) => {
    console.log('📨 Bulk send endpoint called');
    
    try {
        const { phoneNumbers, message } = req.body;

        // Validate input
        if (!phoneNumbers || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing phoneNumbers or message in request body'
            });
        }

        if (!Array.isArray(phoneNumbers)) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumbers must be an array'
            });
        }

        if (phoneNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumbers array is empty'
            });
        }

        console.log('🚀 Starting bulk send process...');
        const results = await sendBulkMessages(phoneNumbers, message);

        res.json({
            success: true,
            summary: {
                total: phoneNumbers.length,
                successful: results.successful.length,
                failed: results.failed.length
            },
            details: {
                successful: results.successful,
                failed: results.failed
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Bulk send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// BULK MESSAGING STATUS ENDPOINT
app.get('/bulk-status', (req, res) => {
    res.json({
        service: 'WhatsApp Bulk Messaging',
        status: 'Active',
        max_batch_size: 100,
        rate_limit: '1 message per second',
        features: [
            'Send to multiple contacts',
            'Detailed success/failure reports',
            'Rate limiting',
            'Real-time progress tracking'
        ],
        endpoints: {
            bulk_send: 'POST /bulk-send',
            status: 'GET /bulk-status',
            webhook: 'GET/POST /webhook'
        }
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Webhook Server is running!',
        features: ['Auto-reply', 'Bulk Messaging', 'Webhook Handling'],
        endpoints: {
            home: 'GET /',
            webhook: 'GET/POST /webhook', 
            bulk_send: 'POST /bulk-send',
            bulk_status: 'GET /bulk-status'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook URL: https://webhook-d484.onrender.com/webhook`);
    console.log(`Bulk SMS URL: https://webhook-d484.onrender.com/bulk-send`);
    console.log(`Bulk Status URL: https://webhook-d484.onrender.com/bulk-status`);
});