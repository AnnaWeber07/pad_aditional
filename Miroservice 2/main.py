# microservice2/app.py
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from prometheus_client import start_http_server, Counter
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

app = Flask ( __name__ )
CORS ( app )  # Enable CORS for all routes

# Prometheus Metrics
requests_counter = Counter ( 'service2_requests_total', 'Total number of requests to Service 2' )


# New Endpoint to Receive Joke and Send Email
@app.route('/send-email', methods=['POST'])
def send_email():
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


# Health Endpoint
@app.route ( '/health' )
def health():
    return jsonify ( {'status': 'Service 2 is healthy'} )


# ... Other middleware and configurations

if __name__ == '__main__':
    start_http_server ( 8002 )  # Expose Prometheus metrics on port 8002
    app.run ( port=3002 )
