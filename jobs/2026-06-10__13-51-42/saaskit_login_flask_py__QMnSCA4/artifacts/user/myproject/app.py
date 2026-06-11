import os

from dotenv import load_dotenv
from flask import Flask, redirect

from scalekit import ScalekitClient
from scalekit.client import AuthorizationUrlOptions

load_dotenv()

app = Flask(__name__)

scalekit_client = ScalekitClient(
    env_url=os.environ["SCALEKIT_ENV_URL"],
    client_id=os.environ["SCALEKIT_CLIENT_ID"],
    client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
)

REDIRECT_URI = "http://localhost:3000/callback"


@app.route("/login")
def login():
    options = AuthorizationUrlOptions()
    options.scopes = "openid profile email offline_access"

    auth_url = scalekit_client.get_authorization_url(
        redirect_uri=REDIRECT_URI,
        options=options,
    )

    return redirect(auth_url, code=302)


@app.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
