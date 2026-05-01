# Recommender Service

This directory contains the Python recommendation microservice used by the app.

## Run

```bash
python recommender_service/recommender_server.py
```

## Endpoints

- `GET /health`
- `POST /recommendations`

## Environment

- `RECOMMENDER_SERVICE_HOST` defaults to `127.0.0.1`
- `RECOMMENDER_SERVICE_PORT` defaults to `8790`

