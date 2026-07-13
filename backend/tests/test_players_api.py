"""
Tests the /players endpoint against a throwaway SQLite database so
tests run fast and don't touch your real Postgres instance.

Run with: pytest
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.player import Player
from app.models.team import Team

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_and_teardown_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    team = Team(external_id=1, name="Houston Rockets", abbreviation="HOU", conference="West", division="Southwest")
    db.add(team)
    db.flush()
    db.add(Player(external_id=101, first_name="Alperen", last_name="Sengun", team_id=team.id))
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_list_players_returns_seeded_player():
    response = client.get("/api/v1/players")
    assert response.status_code == 200

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["last_name"] == "Sengun"
    assert body["items"][0]["team"]["abbreviation"] == "HOU"


def test_list_players_filters_by_name():
    response = client.get("/api/v1/players", params={"name": "sengun"})
    assert response.status_code == 200
    assert response.json()["total"] == 1

    response = client.get("/api/v1/players", params={"name": "nobody"})
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_get_player_404_for_unknown_id():
    response = client.get("/api/v1/players/9999")
    assert response.status_code == 404
