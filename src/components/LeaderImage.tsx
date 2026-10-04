import { useState } from "react";
import type { LeaderInfo } from "../engine/types";
import { getLeaderImageUrl } from "../engine/types";

interface LeaderImageProps {
  leader: LeaderInfo;
  className?: string;
}

/** Leader card art, with a name placard when no art is bundled for the leader */
export function LeaderImage({ leader, className = "" }: LeaderImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} aspect-[5/7] flex items-center justify-center bg-gradient-to-b from-stone-800 to-black p-2`}
        title={leader.name}
      >
        <span className="text-display text-xs text-center text-sand leading-tight">{leader.name}</span>
      </div>
    );
  }

  return (
    <img
      src={getLeaderImageUrl(leader)}
      alt={leader.name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
