from fastapi import FastAPI

app = FastAPI(title="DentaVision inference API", docs_url=None, redoc_url=None)

# Filled by the model loader (M1, #6). Until then the API reports "loading".
state: dict[str, str | None] = {"status": "loading", "model_version": None}


@app.get("/health")
def health() -> dict[str, str | None]:
    return state
