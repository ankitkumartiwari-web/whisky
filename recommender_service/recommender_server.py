from __future__ import annotations

import json
import math
import os
import re
from collections import Counter, defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Iterable, List, Tuple


PORT = int(os.getenv("RECOMMENDER_SERVICE_PORT", "8790"))
HOST = os.getenv("RECOMMENDER_SERVICE_HOST", "127.0.0.1")
HISTORY_PATH = os.getenv("RECOMMENDER_HISTORY_PATH", "recommender_service/training_data.jsonl")


def normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def tokenize(value: Any) -> List[str]:
    text = normalize_text(value)
    if not text:
        return []
    return re.findall(r"[a-z0-9]+", text)


def feature_tokens(song: Dict[str, Any]) -> List[str]:
    tokens: List[str] = []

    def add(prefix: str, value: Any) -> None:
        if isinstance(value, str) and value.strip():
            tokens.extend(f"{prefix}:{token}" for token in tokenize(value))

    def add_many(prefix: str, values: Any) -> None:
        if isinstance(values, list):
            for value in values:
                add(prefix, value)

    add("title", song.get("title"))
    add("artist", song.get("artist"))
    add("album", song.get("album"))
    add("genre", song.get("genre"))
    add("language", song.get("language"))
    add("energy", song.get("energy"))
    add("originType", song.get("originType"))
    add("artistBio", song.get("artistBio"))
    add("originTitle", song.get("originTitle"))
    add("isInstrumental", "yes" if song.get("isInstrumental") else "no")
    add_many("mood", song.get("moods"))
    add_many("activity", song.get("activities"))
    add_many("time", song.get("timeOfDay"))

    year = song.get("originYear")
    if isinstance(year, int):
        tokens.append(f"year:{year}")
        tokens.append(f"decade:{(year // 10) * 10}")

    return tokens


def build_idf(catalog_songs: List[Dict[str, Any]]) -> Dict[str, float]:
    doc_frequency: Counter[str] = Counter()
    for song in catalog_songs:
        doc_frequency.update(set(feature_tokens(song)))

    total_docs = max(len(catalog_songs), 1)
    return {
        token: math.log((1 + total_docs) / (1 + freq)) + 1.0
        for token, freq in doc_frequency.items()
    }


def vectorize(tokens: Iterable[str], idf: Dict[str, float]) -> Dict[str, float]:
    counts = Counter(tokens)
    vector: Dict[str, float] = {}
    for token, count in counts.items():
        weight = idf.get(token, 1.0)
        vector[token] = float(count) * weight
    return vector


def cosine_similarity(left: Dict[str, float], right: Dict[str, float]) -> float:
    if not left or not right:
        return 0.0

    dot = sum(weight * right.get(token, 0.0) for token, weight in left.items())
    left_norm = math.sqrt(sum(weight * weight for weight in left.values()))
    right_norm = math.sqrt(sum(weight * weight for weight in right.values()))
    if not left_norm or not right_norm:
        return 0.0
    return dot / (left_norm * right_norm)


def merge_profiles(seed_vectors: List[Tuple[Dict[str, float], float]]) -> Dict[str, float]:
    profile: Dict[str, float] = defaultdict(float)
    for vector, weight in seed_vectors:
        for token, value in vector.items():
            profile[token] += value * weight
    return dict(profile)


def generic_popularity_score(song: Dict[str, Any]) -> float:
    score = 0.0
    energy = normalize_text(song.get("energy"))
    if energy == "high":
        score += 0.8
    elif energy == "medium":
        score += 0.5
    else:
        score += 0.35

    year = song.get("originYear")
    if isinstance(year, int):
        score += min(max((year - 2018) / 10.0, 0.0), 0.8)

    if song.get("isInstrumental"):
        score += 0.15

    moods = song.get("moods") if isinstance(song.get("moods"), list) else []
    score += min(len(moods), 3) * 0.05

    return score


def score_candidate(
    candidate: Dict[str, Any],
    profile: Dict[str, float],
    profile_songs: List[Dict[str, Any]],
    idf: Dict[str, float],
) -> float:
    candidate_tokens = feature_tokens(candidate)
    candidate_vector = vectorize(candidate_tokens, idf)
    score = cosine_similarity(profile, candidate_vector) * 100.0

    candidate_artist = normalize_text(candidate.get("artist"))
    candidate_genre = normalize_text(candidate.get("genre"))
    candidate_language = normalize_text(candidate.get("language"))
    candidate_origin = normalize_text(candidate.get("originTitle") or candidate.get("album"))

    for seed in profile_songs:
        if normalize_text(seed.get("artist")) == candidate_artist and candidate_artist:
            score += 18.0
        if normalize_text(seed.get("genre")) == candidate_genre and candidate_genre:
            score += 10.0
        if normalize_text(seed.get("language")) == candidate_language and candidate_language:
            score += 6.0
        if normalize_text(seed.get("originTitle") or seed.get("album")) == candidate_origin and candidate_origin:
            score += 8.0
        if normalize_text(seed.get("energy")) == normalize_text(candidate.get("energy")):
            score += 3.0

        seed_moods = set(tokenize(" ".join(seed.get("moods", []))))
        candidate_moods = set(tokenize(" ".join(candidate.get("moods", []))))
        seed_activities = set(tokenize(" ".join(seed.get("activities", []))))
        candidate_activities = set(tokenize(" ".join(candidate.get("activities", []))))
        score += len(seed_moods & candidate_moods) * 1.8
        score += len(seed_activities & candidate_activities) * 1.2

    score += generic_popularity_score(candidate)
    return score


def build_profile_songs(catalog_songs: List[Dict[str, Any]], liked_ids: List[str], recent_ids: List[str], current_id: str | None) -> List[Dict[str, Any]]:
    song_by_id = {song.get("id"): song for song in catalog_songs if song.get("id")}
    seeds: List[Dict[str, Any]] = []

    for song_id in [current_id, *liked_ids, *recent_ids]:
        song = song_by_id.get(song_id)
        if song and song not in seeds:
            seeds.append(song)
    return seeds


def get_dominant_value(songs: List[Dict[str, Any]], key: str) -> str:
    counts: Counter[str] = Counter()
    for song in songs:
        value = song.get(key)
        if isinstance(value, str) and value.strip():
            counts[normalize_text(value)] += 1
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def get_dominant_artist(songs: List[Dict[str, Any]]) -> str:
    counts: Counter[str] = Counter()
    for song in songs:
        artist = song.get("artist")
        if isinstance(artist, str) and artist.strip():
            counts[normalize_text(artist)] += 1
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def load_history_records() -> List[Dict[str, Any]]:
    if not os.path.exists(HISTORY_PATH):
        return []

    records: List[Dict[str, Any]] = []
    try:
        with open(HISTORY_PATH, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    if isinstance(record, dict):
                        records.append(record)
                except Exception:
                    continue
    except Exception:
        return []

    return records


def build_history_boosts(history_records: List[Dict[str, Any]]) -> Tuple[Dict[str, float], Dict[Tuple[str, str], float]]:
    song_popularity: Counter[str] = Counter()
    co_occurrence: Counter[Tuple[str, str]] = Counter()

    for record in history_records:
        song_id = record.get("songId")
        if isinstance(song_id, str):
            song_popularity[song_id] += 1.0 if record.get("eventType") == "play" else 1.5

        seeds = [song_id] if isinstance(song_id, str) else []
        for field in ("likedSongIds", "recentlyPlayedIds"):
            values = record.get(field)
            if isinstance(values, list):
                seeds.extend([value for value in values if isinstance(value, str)])

        unique_seeds = list(dict.fromkeys(seeds))
        for source in unique_seeds:
            for target in unique_seeds:
                if source == target:
                    continue
                co_occurrence[(source, target)] += 1.0

    return dict(song_popularity), dict(co_occurrence)


def recommend(payload: Dict[str, Any]) -> Dict[str, Any]:
    catalog = payload.get("catalog") or {}
    catalog_songs = catalog.get("songs") if isinstance(catalog, dict) else []
    if not isinstance(catalog_songs, list):
        catalog_songs = []

    liked_ids = [song_id for song_id in payload.get("likedSongIds", []) if isinstance(song_id, str)]
    recent_ids = [song_id for song_id in payload.get("recentlyPlayedIds", []) if isinstance(song_id, str)]
    current_id = payload.get("currentSongId") if isinstance(payload.get("currentSongId"), str) else None
    limit = payload.get("limit", 8)
    try:
        limit = max(1, min(int(limit), 12))
    except Exception:
        limit = 8

    if not catalog_songs:
        return {"songs": [], "songIds": [], "source": "python-ml-service"}

    idf = build_idf(catalog_songs)
    history_records = load_history_records()
    song_popularity, co_occurrence = build_history_boosts(history_records)
    seed_songs = build_profile_songs(catalog_songs, liked_ids, recent_ids, current_id)
    dominant_language = get_dominant_value(seed_songs, "language")
    dominant_genre = get_dominant_value(seed_songs, "genre")
    dominant_artist = get_dominant_artist(seed_songs)
    seed_weights = []
    if seed_songs:
        for song in seed_songs:
            weight = 1.0
            if song.get("id") == current_id:
                weight = 3.5
            elif song.get("id") in liked_ids:
                weight = 2.6
            elif song.get("id") in recent_ids:
                weight = 1.4
            seed_weights.append((vectorize(feature_tokens(song), idf), weight))

    profile = merge_profiles(seed_weights)
    blocked_ids = {song_id for song_id in [current_id, *liked_ids, *recent_ids] if song_id}

    language_candidates = [
        song for song in catalog_songs
        if isinstance(song.get("id"), str)
        and song.get("id") not in blocked_ids
        and dominant_language
        and normalize_text(song.get("language")) == dominant_language
    ]

    artist_or_genre_candidates = [
        song for song in catalog_songs
        if isinstance(song.get("id"), str)
        and song.get("id") not in blocked_ids
        and (
            (dominant_artist and normalize_text(song.get("artist")) == dominant_artist)
            or (dominant_genre and normalize_text(song.get("genre")) == dominant_genre)
        )
    ]

    candidate_pool = language_candidates or artist_or_genre_candidates
    if len(candidate_pool) < limit:
        if dominant_language:
            candidate_pool = language_candidates or candidate_pool
        if len(candidate_pool) < limit:
            candidate_pool = artist_or_genre_candidates or candidate_pool
        if len(candidate_pool) < limit:
            candidate_pool = [
                song for song in catalog_songs
                if isinstance(song.get("id"), str) and song.get("id") not in blocked_ids
            ]

    ranked: List[Tuple[float, Dict[str, Any]]] = []
    for song in candidate_pool:
        song_id = song.get("id")
        if not isinstance(song_id, str) or song_id in blocked_ids:
            continue
        score = score_candidate(song, profile, seed_songs, idf)
        score += song_popularity.get(song_id, 0.0) * 1.8
        for seed_id in blocked_ids:
            score += co_occurrence.get((seed_id, song_id), 0.0) * 2.5
        if dominant_language and normalize_text(song.get("language")) == dominant_language:
            score += 15.0
        if dominant_genre and normalize_text(song.get("genre")) == dominant_genre:
            score += 12.0
        if dominant_artist and normalize_text(song.get("artist")) == dominant_artist:
            score += 20.0
        ranked.append((score, song))

    if not ranked:
        ranked = [
            (generic_popularity_score(song), song)
            for song in candidate_pool
            if isinstance(song.get("id"), str) and song.get("id") not in blocked_ids
        ]

    ranked.sort(key=lambda item: item[0], reverse=True)
    selected = [song for _, song in ranked[:limit]]

    return {
        "songs": selected,
        "songIds": [song.get("id") for song in selected if isinstance(song.get("id"), str)],
        "source": "python-ml-service",
    }


def json_response(handler: BaseHTTPRequestHandler, code: int, payload: Dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class RecommenderHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            json_response(self, 200, {"ok": True, "service": "python-ml-service"})
            return
        json_response(self, 404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/recommendations":
            json_response(self, 404, {"error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", "0") or 0)
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"

        try:
            payload = json.loads(raw_body)
            result = recommend(payload if isinstance(payload, dict) else {})
            json_response(self, 200, result)
        except Exception as exc:  # pragma: no cover - runtime guard
            json_response(self, 500, {"error": str(exc)})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), RecommenderHandler)
    print(f"[python-ml-service] Listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
