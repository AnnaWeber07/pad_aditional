const express = require('express');
const axios = require('axios');
const cors = require('cors');
const promClient = require('prom-client');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sgMail = require('@sendgrid/mail');
const redis = require('redis');

const app = express();
app.use(cors());
app.use(express.json());

// Redis setup
const redisClient = redis.createClient();

// Prometheus Metrics
promClient.collectDefaultMetrics();
const gatewayRequestsCounter = new promClient.Counter({
    name: 'gateway_requests_total',
    help: 'Total number of requests to Gateway',
});

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


    // Variable to store service statuses
    let serviceStatuses = {
        service1: 'unknown',
        service2: 'unknown',
    };

    let subscribedUsers = [];
// Middleware to implement Redis cache
const cacheMiddleware = (req, res, next) => {
    const key = req.originalUrl || req.url;
    redisClient.get(key, (err, data) => {
        if (err) {
            console.error('Error in Redis cache middleware:', err.message);
            next();
        }

        if (data !== null) {
            res.send(data);
        } else {
            next();
        }
    });
};

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

    // Endpoint for Prometheus to scrape metrics
    app.get('/metrics', (req, res) => {
        res.set('Content-Type', promClient.register.contentType);
        res.end(promClient.register.metrics());
    });
// New Endpoint to Get Microservices Status with Redis cache
app.get('/status', cacheMiddleware, async (req, res) => {
    // ... (existing code)

    // Update service statuses with Redis cache
    redisClient.setex(key, 3600, JSON.stringify({ serviceStatuses }));
    res.json({ serviceStatuses });
});
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
     *         description: Bad request, email is required or invalid
     */
    app.post('/subscribe', async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required for subscription' });
        }

        try {
            // Call the validate-email endpoint
            const validationResponse = await axios.post('http://localhost:3002/validate-email', { email });

            // Check if email is valid based on the validation response
            if (validationResponse.data.result.valid) {
                // If email is valid, subscribe the user
                subscribedUsers.push(email);
                return res.json({ subscribedUsers });
            } else {
                // If email is not valid, return an error
                return res.status(400).json({ error: 'Invalid email address' });
            }
        } catch (error) {
            // Handle errors from the validation endpoint
            console.error('Error validating email:', error.message);
            return res.status(500).json({ error: 'Internal server error' });
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
// New Endpoint to Fetch Random Joke using jokeapi with Redis cache
app.get('/fetch-joke', cacheMiddleware, async (req, res) => {
    try {
        const category = req.query.category || 'Any';

        const key = `/fetch-joke?category=${category}`;
        const cachedData = await redisGetAsync(key);

        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        const jokeFromApi = await getJokeFromApi(category);

        if (jokeFromApi && !isApiErrorResponse(jokeFromApi)) {
            // API returned a joke, increment counters, cache data, and return the joke
            incrementCounters();
            redisClient.setex(key, 3600, JSON.stringify(jokeFromApi));
            return res.json(jokeFromApi);
        }

        // API returned an error, or an empty response, use the Jokes class as a fallback
        const joke = await fetchJokeUsingLibrary(category);

        return res.json(joke);
    } catch (error) {
        console.error('Error fetching joke:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching joke' });
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

// New Endpoint to Fetch Jokes from various APIs with round-robin aggregation
app.get('/fetch-jokes-aggregated', async (req, res) => {
    try {
        // List of API endpoints (replace with your actual endpoints)
        const apiEndpoints = [
            'http://localhost:3001/fetch-joke',
            'http://localhost:3002/fetch-joke',
            // Add more endpoints as needed
        ];

        // Get the current instance for round-robin aggregation
        const currentInstance = instanceCounter % apiEndpoints.length;

        // Fetch a joke from the selected API endpoint
        const jokeResponse = await axios.get(apiEndpoints[currentInstance]);

        // Increment the counter for the next round-robin iteration
        instanceCounter++;

        // Check if there is an error in the joke response
        const jokeData = jokeResponse.data;
        if (jokeData.error) {
            console.error('Error fetching joke:', jokeData.message);
            return res.status(500).json({ error: true, message: 'Error fetching joke' });
        }

        // Log the entire joke data for inspection
        console.log(`Received Joke from Service ${currentInstance + 1}:`, jokeData);

        // Extract relevant properties and log them separately
        const joke = {
            type: jokeData.type,
            setup: jokeData.setup,
            delivery: jokeData.delivery,
        };
        console.log(`Parsed Joke from Service ${currentInstance + 1}:`, joke);

        return res.json(joke);
    } catch (error) {
        console.error('Error fetching aggregated joke:', error.message);
        return res.status(500).json({ error: true, message: 'Error fetching aggregated joke' });
    }
});

    // ... Other endpoints and configurations

    // Swagger UI endpoint
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));




    // ... Other endpoints and configurations

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Gateway is running on port ${PORT}`);
    });

    // Periodically send jokes and news to all subscribed users every 5 seconds
    setInterval(async () => {
        try {
            // Fetch a joke from Service 1
            const jokeResponse = await axios.get('http://localhost:3001/fetch-joke');
            const jokeData = jokeResponse.data;

            // Check if there is an error in the joke response
            if (jokeData.error) {
                console.error('Error fetching joke:', jokeData.message);
                return;
            }

            // Log the entire joke data for inspection
            console.log('Received Joke from Service 1:', jokeData);

            // Extract relevant properties and log them separately
            const joke = {
                type: jokeData.type,
                setup: jokeData.setup,
                delivery: jokeData.delivery,
            };
            console.log('Parsed Joke from Service 1:', joke);

            // Fetch news based on a specific category
            const newsCategory = 'general'; // Replace with the desired category
            const newsResponse = await axios.get(`http://localhost:3001/fetch-news-category?category=${newsCategory}`);
            const newsData = newsResponse.data;

            // Check if there is an error in the news response
            if (newsData.error) {
                console.error('Error fetching news:', newsData.message);
                return;
            }

            // Log the entire news data for inspection
            console.log('Received News from Service 1:', newsData);

            // Extract relevant properties and log them separately
            const news = {
                headlines: newsData.headlines,
            };
            console.log('Parsed News from Service 1:', parseNews(news.headlines[0]));

            // Send the joke and news to all subscribed users using a single request
            for (const email of subscribedUsers) {
                try {
                    const sendEmailEndpoint = 'http://localhost:3002/send-email';

                    // Combine joke and news content in the body of the email
                    const emailContent = `Joke: ${joke.setup}\nDelivery: ${joke.delivery}\n\nNews: ${news.headlines[0].title}\n${news.headlines[0].url}`;

                    const emailData = {
                        type: 'joke',
                        setup: emailContent,
                        to: email,
                    };

                    const emailResponse = await axios.post(sendEmailEndpoint, emailData);
                    console.log(`Joke and news sent to ${email}. Email response:`, emailResponse.data);
                } catch (error) {
                    console.error(`Error sending joke and news to ${email}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error fetching joke or news:', error.message);
        }
    }, 5000); // Reduced interval to 5 seconds for testing purposes

// Function to handle Redis get with Promise
const redisGetAsync = (key) => {
    return new Promise((resolve, reject) => {
        redisClient.get(key, (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
};
    // Function to parse news data
    function parseNews(newsData) {
        if (newsData) {
            return {
                url: newsData.url || 'Undefined',
                source: newsData.source || 'Undefined',
                title: newsData.title || 'Undefined',
            };
        } else {
            return {
                url: 'Undefined',
                source: 'Undefined',
                title: 'Undefined',
            };
        }
    }