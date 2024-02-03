import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from prometheus_client import start_http_server, Counter
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from flasgger import Swagger
import http.client
import psycopg2

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
swagger = Swagger(app)  # Initialize Swagger

# Prometheus Metrics
requests_counter = Counter('service2_requests_total', 'Total number of requests to Service 2')

# Database Connection
conn = psycopg2.connect(
    host="localhost",  # Use the correct host where your PostgreSQL is running
    port=5051,          # Port specified when running the PostgreSQL container
    user="admin",
    password="admin",
    database="postgres"
)

# Create a cursor object to execute SQL queries
cursor = conn.cursor()

# Create 'emails' table if not exists
create_table_query = '''
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL
);
'''
cursor.execute(create_table_query)
conn.commit()

# New Endpoint to Receive Joke and Send Email
@app.route('/send-email', methods=['POST'])
def send_email():
    """
    Send an email with a joke.
    ---
    parameters:
      - name: joke
        in: body
        required: true
        schema:
          type: object
          properties:
            setup:
              type: string
            delivery:
              type: string
            to:
              type: string
    responses:
      200:
        description: Email sent successfully
      400:
        description: Invalid request or missing parameters
    """
    requests_counter.inc()

    # Receive the joke and email from the Gateway
    joke_data = request.json  # Assuming the joke is sent as JSON in the request body

    # Check if 'setup' key exists in the joke_data dictionary
    setup_text = joke_data.get('setup', 'No setup provided')
    delivery_text = joke_data.get('delivery', 'No delivery provided')

    # Check if 'to' key exists in the joke_data dictionary
    to_email = joke_data.get('to')
    if not to_email:
        return jsonify({'error': True, 'message': 'Recipient email not provided'})

    # Save email data to the database
    save_email_to_database(to_email, "Here's a Joke for You!", f"{setup_text} {delivery_text}")

    # Prepare email payload using SendGrid library
    message = Mail(
        from_email='heihnnreh@gmail.com',  # Replace with your email address
        to_emails=to_email,
        subject="Here's a Joke for You!",
        plain_text_content=f"{setup_text} {delivery_text}"
    )

    # Send email using the SendGrid API
    try:
        sg = SendGridAPIClient(api_key="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")
        response = sg.send(message)
        print(f'Email sent to {to_email}. Response:', response.body)
        return jsonify({'status': 'Email sent successfully'})
    except Exception as e:
        # Handle any exceptions (e.g., network issues) and return an error response
        return jsonify({'error': True, 'message': str(e)})


def save_email_to_database(to_email, subject, content):
    # Save email data to the 'emails' table in the database
    insert_query = "INSERT INTO emails (to_email, subject, content) VALUES (%s, %s, %s);"
    cursor.execute(insert_query, (to_email, subject, content))
    conn.commit()

# Email Validation Endpoint
@app.route('/validate-email', methods=['POST'])
def validate_email():
    """
    Validate an email address using an external API.
    ---
    parameters:
      - name: email
        in: body
        required: true
        schema:
          type: object
          properties:
            email:
              type: string
    responses:
      200:
        description: Email validation result
      400:
        description: Invalid request or missing parameters
    """
    email = request.json.get('email')
    if not email:
        return jsonify({'error': True, 'message': 'Email not provided'})

    # Validate email using the email-check API
    conn = http.client.HTTPSConnection("email-validator8.p.rapidapi.com", timeout=30)
    payload = f"email={email}"
    headers = {
        'content-type': "application/x-www-form-urlencoded",
        'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",
        'X-RapidAPI-Host': "email-validator8.p.rapidapi.com"
    }

    conn.request("POST", "/api/v2.0/email", payload, headers)
    res = conn.getresponse()
    data = res.read()

    return jsonify({'result': json.loads(data.decode("utf-8"))})


# Paraphrase Text Endpoint
@app.route('/paraphrase', methods=['POST'])
def paraphrase_text():
    """
    Paraphrase text using an external API.
    ---
    parameters:
      - name: text
        in: body
        required: true
        schema:
          type: object
          properties:
            text:
              type: string
    responses:
      200:
        description: Paraphrased text
      400:
        description: Invalid request or missing parameters
    """
    text_to_paraphrase = request.json.get('text')
    if not text_to_paraphrase:
        return jsonify({'error': True, 'message': 'Text not provided'})

    # Paraphrase text using the paraphraser API
    conn = http.client.HTTPSConnection("rewriter-paraphraser-text-changer-multi-language.p.rapidapi.com", timeout=30)
    payload = {
        "language": "en",
        "strength": 3,
        "text": text_to_paraphrase
    }
    headers = {
        'content-type': "application/json",
        'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",
        'X-RapidAPI-Host': "rewriter-paraphraser-text-changer-multi-language.p.rapidapi.com"
    }

    conn.request("POST", "/rewrite", json.dumps(payload), headers)
    res = conn.getresponse()
    data = res.read()

    return jsonify({'paraphrased_text': json.loads(data.decode("utf-8"))})


# Scraping Endpoint
@app.route('/scrape-url', methods=['POST'])
def scrape_url():
    """
    Scrape data from a given URL.
    ---
    parameters:
      - name: url
        in: body
        required: true
        schema:
          type: object
          properties:
            url:
              type: string
    responses:
      200:
        description: Scraped data
      400:
        description: Invalid request or missing parameters
    """
    url_to_scrape = request.json.get('url')
    if not url_to_scrape:
        return jsonify({'error': True, 'message': 'URL not provided'})

    # Scrape data using the website scraper API
    conn = http.client.HTTPSConnection("website-article-data-extraction-and-text-mining1.p.rapidapi.com", timeout=30)
    headers = {
        'X-RapidAPI-Key': "074ca7a0c0msh5e211b173d20249p1d0b43jsn5c770313e32e",
        'X-RapidAPI-Host': "website-article-data-extraction-and-text-mining1.p.rapidapi.com"
    }

    conn.request("GET", f"/v1/scrape?url={url_to_scrape}&device=desktop&country=us&block_ads=true&js=true&include_html=false", headers=headers)
    res = conn.getresponse()
    scraped_data = res.read()

    return jsonify({'scraped_data': json.loads(scraped_data.decode("utf-8"))})


# Health Endpoint
@app.route('/health')
def health():
    """
    Check the health status of the service.
    ---
    responses:
      200:
        description: Service is healthy
    """
    return jsonify({'status': 'Service 2 is healthy'})


# ... Other middleware and configurations

if __name__ == '__main__':
    start_http_server(8002)  # Expose Prometheus metrics on port 8002
    app.run(port=3002)
