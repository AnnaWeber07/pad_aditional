const express = require('express');
const axios = require('axios');
const cors = require('cors');
const promClient = require('prom-client');

const app = express();
app.use(cors());
app.use(express.json());

// Prometheus Metrics
promClient.collectDefaultMetrics();
const gatewayRequestsCounter = new promClient.Counter({
    name: 'gateway_requests_total',
    help: 'Total number of requests to Gateway',
});

// Variable to store service statuses
let serviceStatuses = {
    service1: 'unknown',
    service2: 'unknown',
};

// Variable to store subscribed users
let subscribedUsers = [];

// Function to fetch and update service statuses
const updateServiceStatuses = async () => {
    try {
        const healthService1 = await axios.get('http://localhost:3001/health');
        const healthService2 = await axios.get('http://localhost:3002/health');

        serviceStatuses = {
            service1: healthService1.data.status,
            service2: healthService2.data.status,
        };

        console.log('Service Statuses Updated:', serviceStatuses);
    } catch (error) {
        console.error('Error fetching service statuses:', error.message);
    }
};

// New Endpoint to Subscribe Users
app.post('/subscribe', (req, res) => {
    const { email } = req.body;
    if (email) {
        subscribedUsers.push(email);
        res.json({ subscribedUsers });
    } else {
        res.status(400).json({ error: 'Email is required for subscription' });
    }
});

// New Endpoint to Unsubscribe Users
app.post('/unsubscribe', (req, res) => {
    const { email } = req.body;
    subscribedUsers = subscribedUsers.filter(user => user !== email);
    res.json({ subscribedUsers });
});

// New Endpoint to Fetch and Send Joke to Subscribers
app.post('/fetch-and-send-joke', async (req, res) => {
    try {
        // Fetch a joke from Service 1
        const response = await axios.get('http://localhost:3001/fetch-joke');
        const jokeData = response.data;

        // Check if there is an error in the response
        if (jokeData.error) {
            console.error('Error fetching joke from Service 1:', jokeData.message);
            res.status(500).json({ error: 'Error fetching joke from Service 1' });
        } else {
            // Log the entire joke data for inspection
            console.log('Received Joke from Service 1:', jokeData);

            // Extract relevant properties and log them separately
            const joke = {
                error: jokeData.error,
                category: jokeData.category,
                type: jokeData.type,
                setup: jokeData.setup,
                delivery: jokeData.delivery,
                flags: jokeData.flags,
                id: jokeData.id,
                safe: jokeData.safe,
                lang: jokeData.lang,
            };
            console.log('Parsed Joke from Service 1:', joke);

            // Send the joke to all subscribed users
            for (const email of subscribedUsers) {
                try {
                    // Assume a hypothetical send-email API endpoint
                    await axios.post('http://localhost:3002/send-email', { ...joke, to: email });
                    console.log(`Joke sent to ${email}`);
                } catch (error) {
                    console.error(`Error sending joke to ${email}:`, error.message);
                }
            }

            res.json({ status: 'Joke sent to subscribers' });
        }
    } catch (error) {
        console.error('Error fetching joke from Service 1:', error.message);
        res.status(500).json({ error: 'Error fetching joke from Service 1' });
    }
});

// ... Other endpoints and configurations

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Gateway is running on port ${PORT}`);
});

// Periodically update service statuses every 5 seconds
setInterval(updateServiceStatuses, 10000);

// Periodically send jokes to all subscribed users every 5 seconds
setInterval(async () => {
    try {
        // Fetch a joke from Service 1
        const response = await axios.get('http://localhost:3001/fetch-joke');
        const jokeData = response.data;

        // Check if there is an error in the response
        if (jokeData.error) {
            console.error('Error fetching joke from Service 1:', jokeData.message);
        } else {
            // Log the entire joke data for inspection
            console.log('Received Joke from Service 1:', jokeData);

            // Extract relevant properties and log them separately
            const joke = {
                error: jokeData.error,
                category: jokeData.category,
                type: jokeData.type,
                setup: jokeData.setup,
                delivery: jokeData.delivery,
                flags: jokeData.flags,
                id: jokeData.id,
                safe: jokeData.safe,
                lang: jokeData.lang,
            };
            console.log('Parsed Joke from Service 1:', joke);

            // Send the joke to all subscribed users
            for (const email of subscribedUsers) {
                try {
                    // Assume a hypothetical send-email API endpoint in Service 2
                    await axios.post('http://localhost:3002/send-email', { ...joke, to: email });
                    console.log(`Joke sent to ${email}`);
                } catch (error) {
                    console.error(`Error sending joke to ${email}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching joke from Service 1:', error.message);
    }
}, 10000);
