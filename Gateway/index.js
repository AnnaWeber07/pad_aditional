const express = require('express');
const axios = require('axios');
const cors = require('cors');
const promClient = require('prom-client');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const sgMail = require('@sendgrid/mail');

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



// Endpoint to Validate Email
/**
 * @swagger
 * /validate-email:
 *   post:
 *     summary: Validate Email
 *     description: Validate an email address using an external API.
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
 *         description: Email validation result
 *       400:
 *         description: Invalid request or missing parameters
 */
app.post('/validate-email', async (req, res) => {
    const email = req.body.email;
    if (!email) {
        return res.status(400).json({ error: true, message: 'Email not provided' });
    }

    try {
        const response = await axios.post(
            'https://email-validator8.p.rapidapi.com/api/v2.0/email',
            { email },
            {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                    'X-RapidAPI-Host': 'email-validator8.p.rapidapi.com',
                },
            }
        );

        res.json({ result: response.data });
    } catch (error) {
        res.status(500).json({ error: true, message: 'Error validating email' });
    }
});

// Endpoint to Paraphrase Text
/**
 * @swagger
 * /paraphrase:
 *   post:
 *     summary: Paraphrase Text
 *     description: Paraphrase text using an external API.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paraphrased text
 *       400:
 *         description: Invalid request or missing parameters
 */
app.post('/paraphrase', async (req, res) => {
    const textToParaphrase = req.body.text;
    if (!textToParaphrase) {
        return res.status(400).json({ error: true, message: 'Text not provided' });
    }

    try {
        const response = await axios.post(
            'https://rewriter-paraphraser-text-changer-multi-language.p.rapidapi.com/rewrite',
            { language: 'en', strength: 3, text: textToParaphrase },
            {
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                    'X-RapidAPI-Host': 'rewriter-paraphraser-text-changer-multi-language.p.rapidapi.com',
                },
            }
        );

        res.json({ paraphrased_text: response.data });
    } catch (error) {
        res.status(500).json({ error: true, message: 'Error paraphrasing text' });
    }
});

// Endpoint to Scrape URL
/**
 * @swagger
 * /scrape-url:
 *   post:
 *     summary: Scrape URL
 *     description: Scrape data from a given URL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scraped data
 *       400:
 *         description: Invalid request or missing parameters
 */
app.post('/scrape-url', async (req, res) => {
    const urlToScrape = req.body.url;
    if (!urlToScrape) {
        return res.status(400).json({ error: true, message: 'URL not provided' });
    }

    try {
        const response = await axios.get(
            `https://website-article-data-extraction-and-text-mining1.p.rapidapi.com/v1/scrape?url=${urlToScrape}&device=desktop&country=us&block_ads=true&js=true&include_html=false`,
            {
                headers: {
                    'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                    'X-RapidAPI-Host': 'website-article-data-extraction-and-text-mining1.p.rapidapi.com',
                },
            }
        );

        res.json({ scraped_data: response.data });
    } catch (error) {
        res.status(500).json({ error: true, message: 'Error scraping URL' });
    }
});


// SendGrid setup (replace with your SendGrid API key)
sgMail.setApiKey("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");

// New Endpoint to Receive Joke and Send Email
/**
 * @swagger
 * /send-email:
 *   post:
 *     summary: Send Email
 *     description: Send an email with a joke.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               setup:
 *                 type: string
 *               delivery:
 *                 type: string
 *               to:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Invalid request or missing parameters
 */
app.post('/send-email', async (req, res) => {
    try {
        const jokeData = req.body;

        // Check if 'setup' key exists in the jokeData object
        const setupText = jokeData.setup || 'No setup provided';
        const deliveryText = jokeData.delivery || 'No delivery provided';

        // Check if 'to' key exists in the jokeData object
        const toEmail = jokeData.to;
        if (!toEmail) {
            return res.status(400).json({ error: true, message: 'Recipient email not provided' });
        }

        // Prepare email payload using SendGrid library
        const message = {
            from: 'heihnnreh@gmail.com',  // Replace with your email address
            to: toEmail,
            subject: "Here's a Joke for You!",
            text: `${setupText} ${deliveryText}`,
        };

        // Send email using the SendGrid API
        await SendGridAPIClient.send(message); // Correct method

        console.log(`Email sent to ${toEmail}`);

        return res.json({ status: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ error: true, message: 'Error sending email' });
    }
});

// New Endpoint to Fetch Random Joke using jokeapi
/**
 * @swagger
 * /fetch-joke:
 *   get:
 *     summary: Fetch a random joke.
 *     parameters:
 *       - in: query
 *         name: category
 *         description: The category of the joke (e.g., Any, Misc, Programming, etc.)
 *         type: string
 *     responses:
 *       200:
 *         description: A random joke
 */
app.get('/fetch-joke', async (req, res) => {
    try {
        const category = req.query.category || 'Any';

        // Make a direct request to the external API with the specified category
        const jokeFromApi = await getJokeFromApi(category);

        if (jokeFromApi && !isApiErrorResponse(jokeFromApi)) {
            // API returned a joke, increment counters and return the joke
            incrementCounters();

            return res.json(JSON.parse(jokeFromApi));
        }

        // API returned an error, or an empty response, use the Jokes class as a fallback
        const joke = await fetchJokeUsingLibrary(category);

        return res.json(joke);
    } catch (error) {
        console.error('Error fetching joke:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching joke' });
    }
});
/**
 * @swagger
 * /joke-categories:
 *   get:
 *     summary: Fetch joke categories.
 *     responses:
 *       200:
 *         description: Joke categories
 */
app.get('/joke-categories', async (req, res) => {
    try {
        const categoriesResponse = await axios.get('https://jokeapi-v2.p.rapidapi.com/categories?format=json', {
            headers: {
                'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                'X-RapidAPI-Host': 'jokeapi-v2.p.rapidapi.com',
            },
        });

        const categoryNames = categoriesResponse.data.categories || [];
        return res.json({ joke_categories: categoryNames });
    } catch (error) {
        console.error('Error fetching joke categories:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching joke categories' });
    }
});

// New Endpoint to Fetch News from RapidAPI on a Specific Topic
/**
 * @swagger
 * /fetch-news:
 *   get:
 *     summary: Fetch news from RapidAPI on a specific topic and store it in the database.
 *     responses:
 *       200:
 *         description: News on a specific topic
 */
app.get('/fetch-news', async (req, res) => {
    try {
        const newsResponse = await axios.post('https://newsnow.p.rapidapi.com/headline', {
            text: 'Programming',
        }, {
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                'X-RapidAPI-Host': 'newsnow.p.rapidapi.com',
            },
        });

        const headlines = newsResponse.data.headlines || [];
        const formattedHeadlines = headlines.map(headline => ({
            title: headline.title || '',
            url: headline.url || '',
            publishedAt: headline.publishedAt || '',
            source: headline.source || '',
        }));

        return res.json({ headlines: formattedHeadlines });
    } catch (error) {
        console.error('Error fetching news:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching news' });
    }
});

// New Endpoint to Fetch News from RapidAPI on a Specific Category
/**
 * @swagger
 * /fetch-news-category:
 *   get:
 *     summary: Fetch news from RapidAPI on a specific category.
 *     parameters:
 *       - in: query
 *         name: category
 *         description: The category for fetching news
 *         type: string
 *     responses:
 *       200:
 *         description: News on a specific category
 */
app.get('/fetch-news-category', async (req, res) => {
    try {
        const category = req.query.category || 'Programming';

        const newsResponse = await axios.post('https://newsnow.p.rapidapi.com/', {
            text: category,
            region: 'wt-wt',
            max_results: 1,
        }, {
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
                'X-RapidAPI-Host': 'newsnow.p.rapidapi.com',
            },
        });

        const headlines = newsResponse.data.news || [];
        const formattedHeadlines = headlines.map(headline => ({
            title: headline.title || '',
            url: headline.url || '',
            publishedAt: headline.date || '', // Use "date" instead of "publishedAt"
            source: headline.source || '',
        }));

        return res.json({ headlines: formattedHeadlines });
    } catch (error) {
        console.error('Error fetching news by category:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching news by category' });
    }
});

// Helper functions
async function getJokeFromApi(category) {
    const response = await axios.get(`https://jokeapi-v2.p.rapidapi.com/joke/${category}?format=json&contains=C%2523&idRange=0-150&blacklistFlags=nsfw%2Cracist`, {
        headers: {
            'X-RapidAPI-Key': '074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e',
            'X-RapidAPI-Host': 'jokeapi-v2.p.rapidapi.com',
        },
    });

    return response.data;
}

function isApiErrorResponse(apiResponse) {
    try {
        const responseJson = JSON.parse(apiResponse);
        return responseJson.error || false;
    } catch (error) {
        return false;
    }
}

async function fetchJokeUsingLibrary(category) {
    try {
        const jokes = new Jokes();
        const joke = await jokes.getJoke(category);

        // Increment the joke delivery counter
        incrementCounters();

        // Set the gauge value based on the success of joke delivery
        jokeSuccessGauge.set(1); // Assuming successful delivery, modify as per your logic

        return joke;
    } catch (error) {
        console.error('Error fetching joke using library:', error.message);
        throw error;
    }
}

function incrementCounters() {
    // Increment the requests counter
    requestsCounter.inc();

    // Increment the joke delivery counter
    jokeCounter.inc();

    // Set the gauge value based on the success of joke delivery
    jokeSuccessGauge.set(1); // Assuming successful delivery, modify as per your logic
}


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
