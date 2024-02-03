const express = require('express');
const axios = require('axios');
const cors = require('cors');
const promClient = require('prom-client');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(cors());
app.use(express.json());

// Swagger options
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Gateway API',
            version: '1.0.0',
            description: 'API documentation for the Gateway service',
        },
    },
    apis: ['./index.js'], // Replace with the actual path to your main file or where your routes are defined
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

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

let subscribedUsers = [];

// Function to fetch and update service statuses
const updateServiceStatuses = async () => {
    try {
        // Update service statuses without Redis
        const healthService1 = await axios.get('http://localhost:3001/health');
        const healthService2 = await axios.get('http://localhost:3002/health');

        serviceStatuses = {
            service1: healthService1.data.status,
            service2: healthService2.data.status,
        };

        console.log('Service Statuses Updated:', serviceStatuses);
    } catch (error) {
        console.error('Error in updateServiceStatuses:', error.message);
    }
};

// New Endpoint to Get Microservices Status
/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get Microservices Status
 *     description: Endpoint to get the current status of the connected microservices.
 *     responses:
 *       200:
 *         description: Successful response with microservices status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service1:
 *                   type: string
 *                 service2:
 *                   type: string
 */
app.get('/status', (req, res) => {
    res.json({ serviceStatuses });
});


// New Endpoint to Subscribe Users
/**
 * @swagger
 * /subscribe:
 *   post:
 *     summary: Subscribe Users
 *     description: Endpoint to subscribe users.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful subscription
 *       400:
 *         description: Bad request, email is required
 */
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
/**
 * @swagger
 * /unsubscribe:
 *   post:
 *     summary: Unsubscribe Users
 *     description: Endpoint to unsubscribe users.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful unsubscription
 */
app.post('/unsubscribe', (req, res) => {
    const { email } = req.body;
    subscribedUsers = subscribedUsers.filter(user => user !== email);
    res.json({ subscribedUsers });
});

// New Endpoint to Fetch and Send Joke to Subscribers
/**
 * @swagger
 * /fetch-and-send-joke:
 *   post:
 *     summary: Fetch and Send Joke to Subscribers
 *     description: Endpoint to fetch and send a joke to subscribed users.
 *     responses:
 *       200:
 *         description: Joke sent to subscribers successfully
 *       500:
 *         description: Error fetching joke from Service 1
 */
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
                    // Update this part based on your email sending logic
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

// Swagger UI endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
                    // Update this part based on your email sending logic
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
