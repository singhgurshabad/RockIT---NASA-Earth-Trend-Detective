import json
from pathlib import Path

from fastapi import FastAPI

DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(title="RockIT API")


@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/variables")
def variables():
    text = (DATA_DIR / "variables.json").read_text()
    return json.loads(text)