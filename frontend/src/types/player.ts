export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  conference: string | null;
  division: string | null;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team: Team | null;
}

export interface PaginatedPlayers {
  items: Player[];
  total: number;
  page: number;
  page_size: number;
}
