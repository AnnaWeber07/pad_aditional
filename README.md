Gateway Microservice
The Gateway Microservice is a Node.js application built with the Express framework, serving as a central gateway to various microservices and external APIs. It provides functionalities such as fetching jokes, subscribing users, sending emails, and more.

Table of Contents
Dependencies
Initialization
Redis Setup
Prometheus Metrics
Swagger Documentation
Service Status and Subscribed Users
Cache Middleware
Update Service Statuses
Endpoints
Metrics Endpoint
Status Endpoint
Subscribe/Unsubscribe Endpoints
Validate Email Endpoint
Fetch Joke Endpoint
Paraphrase/Scrape URL Endpoints
Send Email Endpoint
Fetch Jokes Aggregated Endpoint
Other Configurations
Periodic Execution
Redis Helper Function
Parse News Function
Running the Application
Dependencies
Express
Axios
Cors
Prom-Client
Swagger-Jsdoc
Swagger-Ui-Express
SendGrid/Mail
Redis
Initialization
The application is created using express() with middleware like cors and express.json() for handling HTTP requests and CORS.

Redis Setup
A Redis client (redisClient) is created for caching data.

Prometheus Metrics
Prometheus metrics are collected using prom-client. A counter (gatewayRequestsCounter) is created to count the total number of requests to the gateway.

Swagger Documentation
Swagger documentation is set up using swagger-jsdoc and exposed via the /api-docs endpoint using swagger-ui-express.

Service Status and Subscribed Users
The serviceStatuses object is used to store the status of microservices. The subscribedUsers array keeps track of users subscribed to some service.

Cache Middleware
cacheMiddleware is a middleware function that checks the Redis cache before processing certain endpoints.

Update Service Statuses
updateServiceStatuses function fetches the health status of two microservices (service1 and service2) and updates serviceStatuses.

Endpoints
Metrics Endpoint (/metrics)
Exposes metrics in Prometheus format.

Status Endpoint (/status)
Provides the status of microservices. Uses Redis cache middleware to cache the response for an hour.

Subscribe/Unsubscribe Endpoints (/subscribe and /unsubscribe)
Subscribe and unsubscribe users using an email address. Validates emails using an external API.

Validate Email Endpoint (/validate-email)
Validates an email address using an external email validation API.

Fetch Joke Endpoint (/fetch-joke)
Fetches a random joke, optionally caching the response using Redis.

Paraphrase/Scrape URL Endpoints (/paraphrase and /scrape-url)
Paraphrases text and scrapes data from a given URL using external APIs.

Send Email Endpoint (/send-email)
Sends an email with a joke to a specified recipient.

Fetch Jokes Aggregated Endpoint (/fetch-jokes-aggregated)
Fetches jokes from multiple API endpoints in a round-robin fashion.

Other Configurations
Additional endpoints may exist beyond those explained here.

Periodic Execution
A periodic task fetches jokes and news from microservices and sends them to subscribed users every 5 seconds.

Redis Helper Function (redisGetAsync)
A helper function to handle Redis get with promises.

Parse News Function (parseNews)
A function to parse news data.

Running the Application
Ensure that Node.js is installed on your system.
Install dependencies using npm install.
Set up any required API keys and configurations (e.g., SendGrid API key, RapidAPI key).
Run the application using npm start or node <filename>.
Make sure to replace placeholder values and configurations with your actual API keys and endpoints before running the application. Additionally, adapt the code to your specific use case and replace placeholders accordingly.



1. Flask App Setup:
   The code starts by importing necessary libraries and initializing a Flask application.
   CORS (Cross-Origin Resource Sharing) is enabled to allow cross-origin requests.
   Swagger is initialized for API documentation.
   python
   Copy code
   import json
   from flask import Flask, jsonify, request
   from flask_cors import CORS
   from prometheus_client import start_http_server, Counter
   from sendgrid import SendGridAPIClient
   from sendgrid.helpers.mail import Mail
   from flasgger import Swagger
   import http.client
   from timeout_decorator import timeout, TimeoutError
   import psycopg2

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
swagger = Swagger(app)  # Initialize Swagger
2. Prometheus Metrics:
   Prometheus metrics are set up using the Counter class from prometheus_client.
   python
   Copy code
# Prometheus Metrics
service2_requests_total = Counter('service2_requests_total', 'Total number of requests to Service 2')
3. Database Connection:
   A connection to a PostgreSQL database is established.
   Tables emails and contents are created if they don't exist.
   python
   Copy code
# Database Connection
conn = psycopg2.connect(
host="localhost",  # Use the correct host where your PostgreSQL is running
port=5051,          # Port specified when running the PostgreSQL container
user="admin",
password="admin",
database="postgres"
)
4. Email Timeout Function:
   The timeout decorator is used to set a timeout for the send_email function.
   The function sends an email using the SendGrid API and saves data to the database.
   python
   Copy code
   @timeout(10)  # Set a timeout of 10 seconds
   def send_email(content_data):
   # ... (function code)
5. Flask Route for Sending Email:
   A Flask route /send-email is defined to handle POST requests.
   It calls the send_email function and increments the Prometheus metric for each request.
   Timeout and other exceptions are caught and handled.
   python
   Copy code
   @app.route('/send-email', methods=['POST'])
   def send_email_route():
   service2_requests_total.inc()
   try:
   content_data = request.json
   send_email(content_data)
   return jsonify({'status': 'Email sent successfully'})
   except TimeoutError:
   return jsonify({'error': True, 'message': 'Request timed out'})
   except Exception as e:
   return jsonify({'error': True, 'message': str(e)})
6. Running the Application:
   The Prometheus metrics endpoint is started on port 8002.
   The Flask application is run on port 3002.
   python
   Copy code
   if __name__ == '__main__':
   start_http_server(8002)  # Prometheus metrics endpoint
   app.run(port=3002)
   README Instructions:
   Running Three Copies of the Service:
   Clone the Repository:

bash
Copy code
git clone https://github.com/your-username/your-repository.git
cd your-repository
Install Dependencies:

bash
Copy code
pip install Flask Flask-CORS prometheus-client sendgrid flasgger timeout-decorator psycopg2
Run Services with Docker Compose:

Create a docker-compose.yml file with the following content:
yaml
Copy code
version: '3'
services:
service2_1:
build: .
ports:
- "3002:3002"
service2_2:
build: .
ports:
- "3003:3002"
service2_3:
build: .
ports:
- "3004:3002"
Run the services:
bash
Copy code
docker-compose up --build
Access Services:

Service 1: http://localhost:3002/send-email
Service 2: http://localhost:3003/send-email
Service 3: http://localhost:3004/send-email
Access Prometheus Metrics:

http://localhost:8002/
Access Grafana Dashboard:

http://localhost:3000/
Set up Prometheus as a data source and create dashboards for monitoring.
Remember to customize the instructions based on your specific application and repository details.

Setting up PostgreSQL in a Docker Container:
Install Docker:

Ensure that Docker is installed on your system. You can download it from the official Docker website.
Create a Docker Compose File for PostgreSQL:

Create a file named docker-compose-db.yml with the following content:
yaml
Copy code
version: '3'
services:
postgres:
image: postgres
restart: always
environment:
POSTGRES_DB: postgres
POSTGRES_USER: admin
POSTGRES_PASSWORD: admin
ports:
- "5051:5432"
This configuration sets up a PostgreSQL container with a database named postgres, a user admin, and a password admin. The container is accessible on port 5051.
Run PostgreSQL Container:

Open a terminal in the directory containing the docker-compose-db.yml file.
Run the following command to start the PostgreSQL container:
bash
Copy code
docker-compose -f docker-compose-db.yml up -d
Verify PostgreSQL Container is Running:

Check if the container is running using:
bash
Copy code
docker ps
You should see a container with the name docker_postgres or similar.
Access PostgreSQL with a Client (Optional):

You can use a database client (e.g., DBeaver, pgAdmin) to connect to the PostgreSQL database running in the container.
Use the following connection details:
Host: localhost (or 127.0.0.1)
Port: 5051
Database: postgres
User: admin
Password: admin
Update Flask App to Connect to PostgreSQL:
Update your Flask app's database connection details to match the PostgreSQL container configuration:

python
Copy code
# Update the database connection parameters
conn = psycopg2.connect(
host="localhost",
port=5051,
user="admin",
password="admin",
database="postgres"
)
Update README Instructions:
Update the README to include instructions for setting up and running PostgreSQL:

Running Three Copies of the Service with PostgreSQL:
Run PostgreSQL Container:

Before running the Flask services, start the PostgreSQL container using the provided Docker Compose file:
bash
Copy code
docker-compose -f docker-compose-db.yml up -d
Run Three Copies of the Service:

Create a docker-compose.yml file with the instructions from the previous README section.
Run the services along with PostgreSQL:
bash
Copy code
docker-compose -f docker-compose.yml -f docker-compose-db.yml up --build
Access Services:

Service 1: http://localhost:3002/send-email
Service 2: http://localhost:3003/send-email
Service 3: http://localhost:3004/send-email
Access Prometheus Metrics:

http://localhost:8002/
Access Grafana Dashboard:

http://localhost:3000/
Set up Prometheus as a data source and create dashboards for monitoring.
Stopping the Containers:

To stop the containers, run the following command:
bash
Copy code
docker-compose -f docker-compose.yml -f docker-compose-db.yml down
This will stop and remove both the Flask services and the PostgreSQL container.

Flask App Setup:
Similar to the previous code, this script initializes a Flask application, enables CORS, and sets up Prometheus metrics, Swagger for documentation, and a connection to the PostgreSQL database.
python
Copy code
import asyncio
from flask import Flask, jsonify, Response, request
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter, Gauge, generate_latest, REGISTRY
from flasgger import Swagger
from jokeapi import Jokes
import http.client
import psycopg2
2. Database Configuration:
   The code configures the PostgreSQL database connection parameters.
   python
   Copy code
   db_params = {
   'dbname': 'postgres',
   'user': 'admin',
   'password': 'admin',
   'host': 'localhost',
   'port': '5050'
   }
3. Prometheus Metrics:
   It sets up Prometheus metrics using the Counter and Gauge classes.
   python
   Copy code
   requests_counter = Counter('service1_requests_total', 'Total number of requests to Service 1')
   joke_counter = Counter('jokes_delivered_total', 'Total number of jokes delivered')
   joke_success_gauge = Gauge('joke_delivery_success', 'Joke delivery success (1 for success, 0 for failure)')
4. Database Initialization Functions:
   Functions to create tables and add jokes/news to the database are defined.
   python
   Copy code
   def create_tables():
   # ...

def add_joke_to_db(category, joke):
# ...

def add_news_to_db(category, headlines):
# ...
5. Flask Routes:
   New Flask routes are defined for fetching metrics, checking health, and fetching jokes and news.
   python
   Copy code
# Metrics Endpoint
@app.route('/metrics')
def expose_metrics():
return Response(generate_latest(REGISTRY), mimetype="text/plain")

# Health Endpoint
@app.route('/health')
def health():
return jsonify({'status': 'Service 1 is healthy'})

# ... (Existing code)

# New Endpoint to Fetch Random Joke using jokeapi
@app.route('/fetch-joke')
def fetch_random_joke():
# ...

# New Endpoint to Fetch News from RapidAPI on a Specific Topic
@app.route('/fetch-news')
def fetch_news():
# ...

# New Endpoint to Fetch News from RapidAPI on a Specific Category
@app.route('/fetch-news-category', methods=['GET'])
def fetch_news_by_category():
# ...

# New Endpoint to Fetch Joke Categories
@app.route('/joke-categories')
def get_joke_categories():
# ...

# Status Endpoint
@app.route('/status')
def status():
return jsonify({'status': 'Service 1 is up and running'})
6. Running the Application:
   The script runs the Flask application on port 3001.
   python
   Copy code
   if __name__ == '__main__':
   app.run(port=3001)
   README Instructions:
   Running Three Copies of the Service with PostgreSQL:
   Run PostgreSQL Container:

Follow the instructions provided in the README for the previous service to set up PostgreSQL in a Docker container.
Run Three Copies of the Service:

Create a docker-compose-service1.yml file with the following content:
yaml
Copy code
version: '3'
services:
service1_1:
build: .
ports:
- "3001:3001"
service1_2:
build: .
ports:
- "3005:3001"
service1_3:
build: .
ports:
- "3006:3001"
Run the services along with PostgreSQL:
bash
Copy code
docker-compose -f docker-compose-service1.yml -f docker-compose-db.yml up --build
Access Services:

Service 1: http://localhost:3001/fetch-joke
Service 2: http://localhost:3005/fetch-joke
Service 3: http://localhost:3006/fetch-joke
Access Prometheus Metrics:

http://localhost:8001/
Access Grafana Dashboard:

http://localhost:3000/
Set up Prometheus as a data source and create dashboards for monitoring.
Stopping the Containers:

To stop the containers, run the following command:
bash
Copy code
docker-compose -f docker-compose-service1.yml -f docker-compose-db.yml down
Make sure to adjust paths and names based on your project structure and preferences.