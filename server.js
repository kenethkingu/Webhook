const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Your verify token - choose any random string
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "Ken_12345";

// Port configuration
const PORT = process.env.PORT || 3000;

// AUTO-REPLY FUNCTION - USING YOUR PHONE NUMBER ID
async function sendAutoReply(phoneNumber, receivedMessage) {
    const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "829658253562571";

    let replyMessage = "";

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

// CSV UPLOAD ENDPOINT - NEW!
app.post('/bulk-upload', upload.single('csvFile'), async (req, res) => {
    console.log('📁 CSV upload endpoint called');
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No CSV file uploaded'
            });
        }

        const { message } = req.body;
        
        if (!message) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        console.log('📄 Processing CSV file:', req.file.originalname);
        console.log('💬 Message:', message);

        const phoneNumbers = [];
        
        // Read and parse CSV file
        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    // Extract phone numbers from CSV
                    // Supports columns: phone, number, contact, etc.
                    const phone = row.phone || row.number || row.contact || row.Phone || row.Number;
                    if (phone) {
                        // Clean phone number (remove spaces, +, etc.)
                        const cleanPhone = phone.toString().replace(/[+\s]/g, '');
                        phoneNumbers.push(cleanPhone);
                    }
                })
                .on('end', () => {
                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        if (phoneNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid phone numbers found in CSV file'
            });
        }

        console.log(`📊 Found ${phoneNumbers.length} numbers in CSV`);
        
        // Send bulk messages
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
        console.error('❌ CSV upload error:', error);
        
        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET endpoint for webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// POST endpoint for webhook events
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object) {
        console.log('Received webhook:');
        console.log(JSON.stringify(body, null, 2));

        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            messages.forEach(message => {
                console.log('Message received from:', message.from);
                console.log('Message text:', message.text?.body);
                
                if (message.text && message.text.body) {
                    sendAutoReply(message.from, message.text.body)
                        .then(() => console.log('Auto-reply sent to:', message.from))
                        .catch(error => console.error('Auto-reply failed:', error));
                }
            });
        }

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// BULK MESSAGING ENDPOINT (original)
app.post('/bulk-send', express.json(), async (req, res) => {
    console.log('📨 Bulk send endpoint called');
    
    try {
        const { phoneNumbers, message } = req.body;

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
            'Real-time progress tracking',
            'CSV file upload support'
        ],
        endpoints: {
            bulk_send: 'POST /bulk-send',
            bulk_upload: 'POST /bulk-upload (CSV file)',
            status: 'GET /bulk-status',
            webhook: 'GET/POST /webhook'
        }
    });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Webhook Server is running!',
        features: ['Auto-reply', 'Bulk Messaging', 'CSV Upload', 'Webhook Handling'],
        endpoints: {
            home: 'GET /',
            webhook: 'GET/POST /webhook', 
            bulk_send: 'POST /bulk-send',
            bulk_upload: 'POST /bulk-upload',
            bulk_status: 'GET /bulk-status'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Webhook URL: https://webhook-d484.onrender.com/webhook`);
    console.log(`Bulk SMS URL: https://webhook-d484.onrender.com/bulk-send`);
    console.log(`CSV Upload URL: https://webhook-d484.onrender.com/bulk-upload`);
    console.log(`Bulk Status URL: https://webhook-d484.onrender.com/bulk-status`);
});