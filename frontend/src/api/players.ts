import { apiGet } from "./client";
import type { PaginatedPlayers } from "../types/player";

export interface ListPlayersParams {
  name?: string;
  team_id?: number;
  page?: number;
  page_size?: number;
}

export function listPlayers(params: ListPlayersParams = {}): Promise<PaginatedPlayers> {
  return apiGet<PaginatedPlayers>("/players", {
    name: params.name ?? "",
    team_id: params.team_id ?? "",
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
  });
}
