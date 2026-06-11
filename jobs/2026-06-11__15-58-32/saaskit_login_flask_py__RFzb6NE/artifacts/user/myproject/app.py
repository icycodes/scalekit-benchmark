import os
from flask import Flask, redirect
from dotenv import load_dotenv
from scalekit import ScalekitClient, AuthorizationUrlOptions

load_dotenv()

scalekit = ScalekitClient(
    env_url=os.environ["SCALEKIT_ENV_URL"],
    client_id=os.environ["SCALEKIT_CLIENT_ID"],
    client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
)

app = Flask(__name__)

REDIRECT_URI = "http://localhost:3000/callback"
SCOPES = ["openid", "profile", "email", "offline_access"]


@app.route("/login")
def login():
    options = AuthorizationUrlOptions()
    options.scopes = SCOPES
    authorization_url = scalekit.get_authorization_url(
        redirect_uri=REDIRECT_URI,
        options=options,
    )
    return redirect(authorization_url, code=302)


@app.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
