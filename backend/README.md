# Backend

The backend is the FastAPI application for Sprynt.

For full project documentation, setup instructions, and architecture details, use the root README:

- [README.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/README.md)

Local backend development with Python:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Local backend development with Docker:

```bash
docker compose build backend
docker compose up -d backend
docker compose logs -f backend
docker compose down
```
