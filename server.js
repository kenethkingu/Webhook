const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Your verify token - choose any random string
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_here";

// Port configuration
const PORT = process.env.PORT || 3000;

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
        // For example, you can extract message data:
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            messages.forEach(message => {
                console.log('Message received from:', message.from);
                console.log('Message text:', message.text?.body);
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
    console.log(`Webhook URL will be: https://your-app-name.herokuapp.com/webhook`);
});
