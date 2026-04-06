from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="MWS Invoice Parser API",
    description="Parses Enbridge CNG and Elexicon electricity PDF invoices for Miller Waste Systems.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Routes will be added in Phase 3
# from routers import parse, records
# app.include_router(parse.router)
# app.include_router(records.router)
