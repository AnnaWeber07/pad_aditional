import asyncio
from flask import Flask, jsonify, Response
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics
from prometheus_client import Counter, Gauge, generate_latest, REGISTRY
from jokeapi import Jokes

app = Flask(__name__)
CORS(app)
metrics = PrometheusMetrics(app)

# Prometheus Metrics
requests_counter = Counter('service1_requests_total', 'Total number of requests to Service 1')
joke_counter = Counter('jokes_delivered_total', 'Total number of jokes delivered')
joke_success_gauge = Gauge('joke_delivery_success', 'Joke delivery success (1 for success, 0 for failure)')

@app.route('/metrics')
def expose_metrics():
    return Response(generate_latest(REGISTRY), mimetype="text/plain")

# Health Endpoint
@app.route('/health')
def health():
    return jsonify({'status': 'Service 1 is healthy'})

# Business Logic Endpoints
@app.route('/endpoint1')
def endpoint1():
    requests_counter.inc()
    # Your existing business logic using RapidAPI or other services
    pass

# New Endpoint to Fetch Random Joke using jokeapi
@app.route('/fetch-joke')
def fetch_random_joke():
    requests_counter.inc()

    # Initialize the Jokes class
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    j = loop.run_until_complete(Jokes())

    # Retrieve a random joke
    joke = loop.run_until_complete(j.get_joke())

    # Increment the joke delivery counter
    joke_counter.inc()

    # Set the gauge value based on the success of joke delivery
    joke_success_gauge.set(1)  # Assuming successful delivery, modify as per your logic

    # Print the joke for demonstration purposes
    return jsonify(joke)

# Status Endpoint
@app.route('/status')
def status():
    return jsonify({'status': 'Service 1 is up and running'})

# ... Other middleware and configurations

if __name__ == '__main__':
    app.run(port=3001)
