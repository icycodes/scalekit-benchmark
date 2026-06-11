import os
from flask import Flask, redirect
from dotenv import load_dotenv
from scalekit import ScalekitClient, AuthorizationUrlOptions

# Load environment variables
load_dotenv()

# Initialize ScalekitClient
env_url = os.environ.get("SCALEKIT_ENV_URL")
client_id = os.environ.get("SCALEKIT_CLIENT_ID")
client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

# Initialize the SDK once at module import time using the environment variables
scalekit_client = ScalekitClient(
    env_url=env_url,
    client_id=client_id,
    client_secret=client_secret
)

app = Flask(__name__)

@app.route("/login", methods=["GET"])
def login():
    options = AuthorizationUrlOptions()
    options.scopes = ["openid", "profile", "email", "offline_access"]
    
    auth_url = scalekit_client.get_authorization_url(
        redirect_uri="http://localhost:3000/callback",
        options=options
    )
    return redirect(auth_url, code=302)

@app.route("/healthz", methods=["GET"])
def healthz():
    return "ok", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
