import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Path as PathParam, Query

from schemas import GlossaryEntry, Region, Variable

DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(
    title="RockIT API",
    description="Environmental trends from NASA GLDAS data.",
)

def load_json(filename):
    return json.loads((DATA_DIR / filename).read_text())


@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/variables", 
         response_model=list[Variable], 
         summary="List the environmental variables")
def variables():
    """Returns the four variables (temperature, precipitation, soil moisture,
    evapotranspiration) with their units and plain-language descriptions."""
    return load_json("variables.json")

@app.get("/api/regions",
         response_model=list[Region], 
         summary="List the regions")
def regions(
    group: Optional[str] = Query(
        None,
        description="Only show regions in this group. Leave empty to see all regions.",
        examples=["Africa"],
    ),
):
    """Returns each region with its map box (`bbox`), centre point and descriptions.
    Groups: North America, South America, Oceania, Africa."""
    items = load_json("regions.json")
    if group:
        items = [r for r in items if r["group"].lower() == group.lower()]
    return items

@app.get("/api/glossary",
         response_model=list[GlossaryEntry], 
         summary="List all glossary terms")
def glossary(
    category: Optional[str] = Query(
        None,
        description="Only show terms in this category: variable, statistics, dataset or discovery. Leave empty for all.",
        examples=["statistics"],
    ),
):
    """Returns the dictionary of terms used in the app."""
    items = load_json("glossary.json")
    if category:
        items = [g for g in items if g["category"] == category]
    return items

@app.get("/api/glossary/{term_id}", 
         response_model=GlossaryEntry, 
         summary="Look up one glossary term")
def glossary_term(
    term_id: str = PathParam(..., description="The term's id, as shown in the `id` field of /api/glossary.",
        examples=["p_value"],),):
    for entry in load_json("glossary.json"):
        if entry["id"] == term_id:
            return entry
    raise HTTPException(status_code=404, detail=f"Unknown glossary term '{term_id}'")