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

create_table_query = '''
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL
);
'''

cursor.execute(create_table_query)
conn.commit()

# New Endpoint to Receive Joke and Send Email
@app.route('/send-email', methods=['POST'])
def send_email():
    """
    Send an email with content (joke, news, or parsed webpage).
    ---
    parameters:
      - name: content
        in: body
        required: true
        schema:
          type: object
          properties:
            type:
              type: string
              enum: ['joke', 'news', 'webpage']

            setup:
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

    # Receive the content and email from the Gateway
    content_data = request.json  # Assuming the content is sent as JSON in the request body

    # Check if 'type' key exists in the content_data dictionary
    content_type = content_data.get('type')
    if not content_type or content_type not in ['joke', 'news', 'webpage']:
        return jsonify({'error': True, 'message': 'Invalid content type'})

    # Extract content information based on the content type
    setup_text = content_data.get('setup', 'No setup provided')

    to_email = content_data.get('to')

    if not to_email:
        return jsonify({'error': True, 'message': 'Recipient email not provided'})

    # Save content data to the database
    save_content_to_database(content_type, to_email, f"{setup_text} ")

    # Prepare email payload using SendGrid library
    subject = get_subject_based_on_type(content_type)
    content = f"{setup_text} "

    message = Mail(
        from_email='heihnnreh@gmail.com',  # Replace with your email address
        to_emails=to_email,
        subject=subject,
        plain_text_content=content
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


def save_content_to_database(content_type, to_email, content):
    # Save content data to the 'contents' table in the database
    insert_query = "INSERT INTO contents (content_type, to_email, content) VALUES (%s, %s, %s);"
    cursor.execute(insert_query, (content_type, to_email, content))
    conn.commit()


def get_subject_based_on_type(content_type):
    # Determine the subject based on the content type
    if content_type == 'joke':
        return "Here's a Joke for You!"
    elif content_type == 'news':
        return "Latest News Update"
    elif content_type == 'webpage':
        return "Parsed Web Page"

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

    app.run(port=3002)
