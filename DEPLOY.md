# Deploy RockIT to Google Cloud Run

Two services: `rockit-api` (the data service) and `rockit-web` (the web app).
Deploy the API first: the web app needs the API's address when it is built.
First deploy takes about 30 to 60 minutes, most of it account setup and the first builds.

## 0. One-time setup (Mac)

1. Claim the Space Apps Google Cloud offer and start the free trial ($300 credit, no auto-charge).
2. Install the gcloud command-line tool: https://cloud.google.com/sdk/docs/install
   (or `brew install --cask google-cloud-sdk` if you use Homebrew).
3. In Terminal:

```bash
gcloud auth login                         # opens the browser to sign in

# Use the project the free trial created, or make one. The id must be unique worldwide.
gcloud projects create rockit-spaceapps-<yourname> --name="RockIT"
gcloud config set project rockit-spaceapps-<yourname>

# Link the trial billing account to the project
gcloud billing accounts list              # copy the ACCOUNT_ID
gcloud billing projects link rockit-spaceapps-<yourname> --billing-account=<ACCOUNT_ID>

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud config set run/region us-west1
```

If `gcloud projects create` complains, create the project in the console (console.cloud.google.com, project picker, New project) and continue from `gcloud config set project`.

## 1. Deploy the API

```bash
cd ~/Downloads/RockIT---NASA-Earth-Trend-Detective/api
gcloud run deploy rockit-api --source . --allow-unauthenticated --memory 1Gi
```

- If asked to create an Artifact Registry repository, answer **Y**.
- When it finishes it prints `Service URL: https://rockit-api-....run.app`. Copy it.
- Check it: open `<API URL>/api/health` in the browser. It should say `"status":"ok"`.

## 2. Deploy the web app

```bash
cd ../rockit
echo "NEXT_PUBLIC_API_URL=<API URL from step 1>" > .env.production
gcloud run deploy rockit-web --source . --allow-unauthenticated
```

No trailing slash on the URL. It prints `Service URL: https://rockit-web-....run.app`. Copy it.

## 3. Let the web app talk to the API

```bash
gcloud run services update rockit-api --update-env-vars ROCKIT_ALLOWED_ORIGINS=<WEB URL from step 2>
```

No trailing slash. Then open the WEB URL (exactly that address) and press Run analysis.

If the page says it cannot reach the data service, the address in step 3 does not match the one in your browser's address bar. Cloud Run can show two addresses for one service; use the one you actually open.

## Updating after a code change

```bash
cd api    && gcloud run deploy rockit-api --source .     # if the API changed
cd rockit && gcloud run deploy rockit-web --source .     # if the web app changed
```

Settings from steps 2 and 3 are kept. Only redo step 2's `.env.production` if the API address changes.

## Cost and safety

- Both services scale to zero when idle, so they cost almost nothing. The first visit after a quiet spell takes a few seconds; open the site once before you present.
- Set a budget alert: console, Billing, Budgets & alerts, Create budget (for example $10).
- To stop everything after judging: `gcloud run services delete rockit-web` and `gcloud run services delete rockit-api`.
