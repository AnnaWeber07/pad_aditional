import asyncio
import json
from flask import Flask, jsonify, Response, request
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter, Gauge, generate_latest, REGISTRY
from flasgger import Swagger
from jokeapi import Jokes
import http.client
import psycopg2
from sqlalchemy.testing import db

app = Flask(__name__)
CORS(app)
metrics = PrometheusMetrics(app)
swagger = Swagger(app)

# Configure the database connection parameters
db_params = {
    'dbname': 'postgres',
    'user': 'admin',
    'password': 'admin',
    'host': 'localhost',
    'port': '5050'
}

# Prometheus Metrics
requests_counter = Counter('service1_requests_total', 'Total number of requests to Service 1')
joke_counter = Counter('jokes_delivered_total', 'Total number of jokes delivered')
joke_success_gauge = Gauge('joke_delivery_success', 'Joke delivery success (1 for success, 0 for failure)')

def create_tables():
    # Connect to the database
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()

    # Create Joke table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jokes (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255),
            content TEXT
        )
    ''')

    # Create News table with longer column lengths
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255),
            title TEXT,
            url TEXT,
            published_at TEXT,
            source TEXT
        )
    ''')

    # Commit changes and close connection
    conn.commit()
    cursor.close()
    conn.close()

def add_joke_to_db(category, joke):
    # Connect to the database
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()

    # Convert the dictionary to a JSON string
    joke_json = json.dumps(joke)

    # Insert the joke into the 'jokes' table
    cursor.execute('INSERT INTO jokes (category, content) VALUES (%s, %s)', (category, joke_json))

    conn.commit()
    cursor.close()
    conn.close()


def add_news_to_db(category, headlines):
    # Connect to the database
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()

    # Insert each news headline into the 'news' table
    for headline in headlines:
        title = headline.get("title", "")
        url = headline.get("url", "")
        published_at = headline.get("publishedAt", "")
        source = headline.get("source", "")

        # Insert the news headline into the 'news' table
        cursor.execute('''
            INSERT INTO news (category, title, url, published_at, source)
            VALUES (%s, %s, %s, %s, %s)
        ''', (category, title, url, published_at, source))

    # Commit changes and close connection
    conn.commit()
    cursor.close()
    conn.close()

@app.route('/metrics')
def expose_metrics():
    return Response(generate_latest(REGISTRY), mimetype="text/plain")

# ... (existing code)

with app.app_context():
    # Create tables
    create_tables()
# Health Endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'Service 1 is healthy'})

# Business Logic Endpoints

# New Endpoint to Fetch Random Joke using jokeapi

@app.route('/fetch-joke')
def fetch_random_joke():
    """
    Fetch a random joke.
    ---
    parameters:
      - in: query
        name: category
        description: The category of the joke (e.g., Any, Misc, Programming, etc.)
        type: string
    responses:
      200:
        description: A random joke
    """
    category = request.args.get('category', 'Any')

    # Make a direct request to the external API with the specified category
    joke_from_api = get_joke_from_api(category)

    if joke_from_api and not is_api_error_response(joke_from_api):
        # API returned a joke, increment counters and return the joke
        increment_counters()

        add_joke_to_db ( category, joke_from_api )
        return joke_from_api

    # API returned an error, or an empty response, use the Jokes class as a fallback
    return fetch_joke_using_library(category)

def get_joke_from_api(category):
    conn = http.client.HTTPSConnection("jokeapi-v2.p.rapidapi.com")

    headers = {
        'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",
        'X-RapidAPI-Host': "jokeapi-v2.p.rapidapi.com"
    }

    endpoint = f"/joke/{category}?format=json&contains=C%2523&idRange=0-150&blacklistFlags=nsfw%2Cracist"
    conn.request("GET", endpoint, headers=headers)

    res = conn.getresponse()
    data = res.read()

    joke_from_api = data.decode("utf-8")
    return joke_from_api if joke_from_api else None

def is_api_error_response(api_response):
    # Check if the API response indicates an error
    try:
        response_json = json.loads(api_response)
        return response_json.get("error", False)
    except json.JSONDecodeError:
        return False

def fetch_joke_using_library(category):
    # Initialize the Jokes class
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    j = loop.run_until_complete(Jokes())

    # Retrieve a random joke of the specified category
    joke = loop.run_until_complete(j.get_joke())

    # Save the joke to the database
    add_joke_to_db(category, joke['joke'])

    # Increment the joke delivery counter
    joke_counter.inc()

    # Set the gauge value based on the success of joke delivery
    joke_success_gauge.set(1)  # Assuming successful delivery, modify as per your logic

    # Format the response to return only the setup and delivery
    return joke

def increment_counters():
    # Increment the requests counter
    requests_counter.inc()

    # Increment the joke delivery counter
    joke_counter.inc()

    # Set the gauge value based on the success of joke delivery
    joke_success_gauge.set(1)  # Assuming successful delivery, modify as per your logic


# New Endpoint to Fetch News from RapidAPI on a Specific Topic
@app.route('/fetch-news')
def fetch_news():
    """
    Fetch news from RapidAPI on a specific topic and store it in the database.
    ---
    responses:
      200:
        description: News on a specific topic
    """
    try:
        # Your RapidAPI news fetching logic
        conn = http.client.HTTPSConnection("newsnow.p.rapidapi.com")

        payload = "{\r\n    \"text\": \"Programming\"\r\n}"

        headers = {
            'content-type': "application/json",
            'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",  # Replace with your RapidAPI key
            'X-RapidAPI-Host': "newsnow.p.rapidapi.com"
        }

        conn.request("POST", "/headline", payload, headers)

        res = conn.getresponse()
        data = res.read().decode("utf-8")

        # Parse the JSON response
        response_json = json.loads(data)

        # Extract headlines from the response
        headlines = response_json.get("headlines", [])



        # Process the headlines as needed
        formatted_headlines = []
        for headline in headlines:
            formatted_headline = {
                "title": headline.get("title", ""),
                "url": headline.get("url", ""),
                "publishedAt": headline.get("publishedAt", ""),
                "source": headline.get("source", "")
            }
            formatted_headlines.append(formatted_headline)

        # Return the formatted headlines as JSON
        return jsonify({'headlines': formatted_headlines})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# New Endpoint to Fetch News from RapidAPI on a Specific Category
@app.route('/fetch-news-category', methods=['GET'])
def fetch_news_by_category():
    """
    Fetch news from RapidAPI on a specific category.
    ---
    parameters:
      - in: query
        name: category
        description: The category for fetching news
        type: string
    responses:
      200:
        description: News on a specific category
    """
    try:
        # Get the category from the query parameters or use 'Programming' as the default
        category = request.args.get('category', 'Europe')

        # Your RapidAPI news fetching logic
        conn = http.client.HTTPSConnection("newsnow.p.rapidapi.com")

        payload = f'{{\n    "text": "{category}",\n    "region": "wt-wt",\n    "max_results": 1\n}}'

        headers = {
            'content-type': "application/json",
            'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",  # Replace with your RapidAPI key
            'X-RapidAPI-Host': "newsnow.p.rapidapi.com"
        }

        conn.request("POST", "/", payload, headers)

        res = conn.getresponse()
        data = res.read().decode("utf-8")

        # Parse the JSON response
        response_json = json.loads(data)

        # Extract headlines from the "news" key in the response
        headlines = response_json.get("news", [])

        # Save the news to the database
        add_news_to_db(category, headlines)

        # Process the headlines as needed
        formatted_headlines = []
        for headline in headlines:
            formatted_headline = {
                "title": headline.get("title", ""),
                "url": headline.get("url", ""),
                "publishedAt": headline.get("date", ""),  # Use "date" instead of "publishedAt"
                "source": headline.get("source", "")
            }
            formatted_headlines.append(formatted_headline)

        # Return the formatted headlines as JSON
        return jsonify({'headlines': formatted_headlines})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# New Endpoint to Fetch Joke Categories
@app.route('/joke-categories')
def get_joke_categories():
    """
    Fetch joke categories.
    ---
    responses:
      200:
        description: Joke categories
    """
    conn = http.client.HTTPSConnection("jokeapi-v2.p.rapidapi.com")

    headers = {
        'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",
        'X-RapidAPI-Host': "jokeapi-v2.p.rapidapi.com"
    }

    conn.request("GET", "/categories?format=json", headers=headers)

    res = conn.getresponse()
    data = res.read().decode("utf-8")

    # Parse the JSON response and extract category names
    categories_response = json.loads(data)
    category_names = categories_response.get('categories', [])

    return jsonify({'joke_categories': category_names})

# Status Endpoint
@app.route('/status')
def status():
    """
    Check the status of Service 1.
    ---
    responses:
      200:
        description: Service status
    """
    return jsonify({'status': 'Service 1 is up and running'})

# ... Other middleware and configurations

if __name__ == '__main__':
    app.run(port=3001)
