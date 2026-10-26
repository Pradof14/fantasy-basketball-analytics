import { useState } from "react";
import { headshotUrl } from "../lib/data";
import { initials } from "../lib/format";

export function Headshot({ name, nbaId, large }: { name: string; nbaId?: number | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = headshotUrl(nbaId);
  return (
    <span className={`headshot${large ? " lg" : ""}`} aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
