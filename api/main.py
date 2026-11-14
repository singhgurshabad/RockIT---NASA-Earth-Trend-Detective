import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI

DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(title="RockIT API")

def load_json(filename):
    return json.loads((DATA_DIR / filename).read_text())


@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/variables")
def variables():
    text = (DATA_DIR / "variables.json").read_text()
    return json.loads(text)

@app.get("/api/regions")
def regions(group: Optional[str] = None):
    items = load_json("regions.json")
    if group:
        items = [r for r in items if r["group"].lower() == group.lower()]
    return items