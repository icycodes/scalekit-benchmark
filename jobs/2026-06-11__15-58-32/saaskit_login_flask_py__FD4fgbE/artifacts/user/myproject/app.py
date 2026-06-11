import os
from flask import Flask, redirect
from dotenv import load_dotenv
from scalekit import ScalekitClient, AuthorizationUrlOptions

load_dotenv()

app = Flask(__name__)

# Initialize the SDK once at module import time using the environment variables
scalekit_client = ScalekitClient(
    os.environ.get('SCALEKIT_ENV_URL'),
    os.environ.get('SCALEKIT_CLIENT_ID'),
    os.environ.get('SCALEKIT_CLIENT_SECRET')
)

@app.route('/healthz', methods=['GET'])
def healthz():
    return 'ok', 200

@app.route('/login', methods=['GET'])
def login():
    redirect_uri = 'http://localhost:3000/callback'
    options = AuthorizationUrlOptions()
    options.scopes = ['openid', 'profile', 'email', 'offline_access']
    
    url = scalekit_client.get_authorization_url(
        redirect_uri,
        options=options
    )
    return redirect(url, code=302)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
