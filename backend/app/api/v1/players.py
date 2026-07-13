from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.player import Player
from app.schemas.player import PaginatedPlayers, PlayerOut

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=PaginatedPlayers)
def list_players(
    db: Session = Depends(get_db),
    name: str | None = Query(None, description="Filter by first/last name, case-insensitive"),
    team_id: int | None = Query(None, description="Filter by internal team id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> PaginatedPlayers:
    query = db.query(Player).options(joinedload(Player.team))

    if name:
        like_pattern = f"%{name}%"
        query = query.filter(
            (Player.first_name.ilike(like_pattern)) | (Player.last_name.ilike(like_pattern))
        )

    if team_id:
        query = query.filter(Player.team_id == team_id)

    total = query.count()
    items = (
        query.order_by(Player.last_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedPlayers(items=items, total=total, page=page, page_size=page_size)


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)) -> Player:
    player = (
        db.query(Player)
        .options(joinedload(Player.team))
        .filter(Player.id == player_id)
        .one_or_none()
    )
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return player
