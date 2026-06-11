import os
from flask import Flask, redirect
from dotenv import load_dotenv
from scalekit import ScalekitClient, AuthorizationUrlOptions

# Load environment variables from .env file if present
load_dotenv()

# Initialize Scalekit client from environment variables
SCALEKIT_ENV_URL = os.environ["SCALEKIT_ENV_URL"]
SCALEKIT_CLIENT_ID = os.environ["SCALEKIT_CLIENT_ID"]
SCALEKIT_CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]

sc = ScalekitClient(
    SCALEKIT_ENV_URL,
    SCALEKIT_CLIENT_ID,
    SCALEKIT_CLIENT_SECRET,
)

REDIRECT_URI = "http://localhost:3000/callback"

app = Flask(__name__)


@app.route("/login", methods=["GET"])
def login():
    options = AuthorizationUrlOptions()
    options.scopes = ["openid", "profile", "email", "offline_access"]
    auth_url = sc.get_authorization_url(REDIRECT_URI, options)
    return redirect(auth_url, code=302)


@app.route("/healthz", methods=["GET"])
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)