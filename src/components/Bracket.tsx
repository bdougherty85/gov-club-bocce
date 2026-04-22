'use client';

interface Team {
  id: string;
  name: string;
}

interface BracketGame {
  id: string;
  playoffRound: number;
  playoffPosition: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  nextGameId: string | null;
  nextGamePosition: string | null;
  court?: { name: string } | null;
  timeSlot?: { startTime: string } | null;
}

interface BracketProps {
  games: BracketGame[];
  onSelectWinner?: (gameId: string, winnerId: string) => void;
  onClearWinner?: (gameId: string) => void;
  compact?: boolean;
  showControls?: boolean;
}

export default function Bracket({ games, onSelectWinner, onClearWinner, compact = false, showControls = true }: BracketProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        No bracket games found
      </div>
    );
  }

  // Group games by round
  const gamesByRound = games.reduce((acc, game) => {
    const round = game.playoffRound || 1;
    if (!acc[round]) acc[round] = [];
    acc[round].push(game);
    return acc;
  }, {} as Record<number, BracketGame[]>);

  // Sort games within each round by position
  Object.values(gamesByRound).forEach(roundGames => {
    roundGames.sort((a, b) => (a.playoffPosition || 0) - (b.playoffPosition || 0));
  });

  const rounds = Object.keys(gamesByRound).map(Number).sort((a, b) => a - b);
  const maxRound = Math.max(...rounds);
  const totalRounds = maxRound;

  const getRoundName = (round: number) => {
    const diff = maxRound - round;
    if (diff === 0) return 'Finals';
    if (diff === 1) return 'Semi-Finals';
    if (diff === 2) return 'Quarter-Finals';
    return `Round ${round}`;
  };

  const getWinner = (game: BracketGame): Team | null => {
    if (game.homeScore === null || game.awayScore === null) return null;
    if (game.homeScore > game.awayScore) return game.homeTeam;
    if (game.awayScore > game.homeScore) return game.awayTeam;
    return null;
  };

  const handleTeamClick = (game: BracketGame, team: Team | null) => {
    if (!team || !onSelectWinner || !showControls) return;

    const winner = getWinner(game);

    if (winner?.id === team.id && onClearWinner) {
      onClearWinner(game.id);
    } else {
      onSelectWinner(game.id, team.id);
    }
  };

  // Calculate dimensions
  const matchupHeight = compact ? 56 : 72;
  const matchupWidth = compact ? 140 : 180;
  const horizontalGap = compact ? 40 : 60;
  const connectorWidth = horizontalGap;

  // Calculate the total height needed
  const firstRoundGames = gamesByRound[1]?.length || 0;
  const totalHeight = firstRoundGames * matchupHeight * 2;

  return (
    <div className="overflow-x-auto overflow-y-auto pb-4">
      <div className="relative" style={{
        minWidth: `${(totalRounds + 1) * (matchupWidth + connectorWidth) + matchupWidth}px`,
        minHeight: `${totalHeight + 40}px`
      }}>
        {/* Round headers */}
        <div className="flex mb-4" style={{ gap: `${connectorWidth}px` }}>
          {rounds.map((round) => (
            <div
              key={`header-${round}`}
              className={`text-center font-semibold text-foreground ${compact ? 'text-sm' : 'text-base'}`}
              style={{ width: `${matchupWidth}px` }}
            >
              {getRoundName(round)}
            </div>
          ))}
          <div
            className={`text-center font-semibold text-foreground ${compact ? 'text-sm' : 'text-base'}`}
            style={{ width: `${matchupWidth}px` }}
          >
            Champion
          </div>
        </div>

        {/* Bracket SVG for connectors */}
        <svg
          className="absolute top-8 left-0 pointer-events-none"
          style={{
            width: `${(totalRounds + 1) * (matchupWidth + connectorWidth) + matchupWidth}px`,
            height: `${totalHeight}px`
          }}
        >
          {rounds.slice(0, -1).map((round) => {
            const roundGames = gamesByRound[round] || [];
            const nextRoundGames = gamesByRound[round + 1] || [];
            const gamesInRound = roundGames.length;

            // Calculate vertical spacing for this round
            const spacingMultiplier = Math.pow(2, round - 1);
            const baseSpacing = matchupHeight * 2;
            const roundSpacing = baseSpacing * spacingMultiplier;
            const roundStartY = (roundSpacing - matchupHeight) / 2;

            // Calculate x positions
            const roundX = (round - 1) * (matchupWidth + connectorWidth);
            const nextRoundX = round * (matchupWidth + connectorWidth);

            return roundGames.map((game, idx) => {
              const y1 = roundStartY + idx * roundSpacing + matchupHeight / 2;

              // Find the partner game (the other game feeding into the same next round game)
              const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
              const partnerGame = roundGames[partnerIdx];

              if (!partnerGame || idx % 2 !== 0) return null;

              const y2 = roundStartY + partnerIdx * roundSpacing + matchupHeight / 2;
              const midY = (y1 + y2) / 2;

              // Connection path: right from game, down/up to midpoint, right to next game
              const startX = roundX + matchupWidth;
              const endX = nextRoundX;
              const midX = startX + connectorWidth / 2;

              return (
                <g key={`connector-${round}-${idx}`}>
                  {/* Line from top game to middle */}
                  <path
                    d={`M ${startX} ${y1} H ${midX} V ${midY}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />
                  {/* Line from bottom game to middle */}
                  <path
                    d={`M ${startX} ${y2} H ${midX} V ${midY}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />
                  {/* Line from middle to next round */}
                  <path
                    d={`M ${midX} ${midY} H ${endX}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />
                </g>
              );
            });
          })}

          {/* Final connector to champion */}
          {gamesByRound[maxRound]?.[0] && (() => {
            const finalsGame = gamesByRound[maxRound][0];
            const finalsX = (maxRound - 1) * (matchupWidth + connectorWidth);

            // Calculate finals Y position
            const spacingMultiplier = Math.pow(2, maxRound - 1);
            const baseSpacing = matchupHeight * 2;
            const roundSpacing = baseSpacing * spacingMultiplier;
            const finalsY = (roundSpacing - matchupHeight) / 2 + matchupHeight / 2;

            const startX = finalsX + matchupWidth;
            const endX = maxRound * (matchupWidth + connectorWidth);

            return (
              <path
                d={`M ${startX} ${finalsY} H ${endX}`}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="2"
              />
            );
          })()}
        </svg>

        {/* Games */}
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {rounds.map((round) => {
            const roundGames = gamesByRound[round] || [];

            // Calculate vertical spacing for this round
            const spacingMultiplier = Math.pow(2, round - 1);
            const baseSpacing = matchupHeight * 2;
            const roundSpacing = baseSpacing * spacingMultiplier;
            const roundStartY = (roundSpacing - matchupHeight) / 2;

            const roundX = (round - 1) * (matchupWidth + connectorWidth);

            return roundGames.map((game, idx) => {
              const y = roundStartY + idx * roundSpacing;
              const winner = getWinner(game);

              return (
                <div
                  key={game.id}
                  className="absolute"
                  style={{
                    left: `${roundX}px`,
                    top: `${y}px`,
                    width: `${matchupWidth}px`,
                    height: `${matchupHeight}px`,
                  }}
                >
                  <div className="h-full bg-white border border-gray-300 rounded shadow-sm overflow-hidden flex flex-col">
                    {/* Home team */}
                    <div
                      className={`flex-1 flex justify-between items-center border-b border-gray-200 cursor-pointer transition-colors ${
                        compact ? 'px-2 text-xs' : 'px-3 text-sm'
                      } ${
                        winner?.id === game.homeTeam?.id
                          ? 'bg-green-100 font-semibold'
                          : winner && game.homeTeam ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleTeamClick(game, game.homeTeam)}
                    >
                      <span className="truncate flex-1">
                        {game.homeTeam?.name || 'TBD'}
                      </span>
                      <span className={`font-bold ml-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {game.homeScore ?? ''}
                      </span>
                    </div>

                    {/* Away team */}
                    <div
                      className={`flex-1 flex justify-between items-center cursor-pointer transition-colors ${
                        compact ? 'px-2 text-xs' : 'px-3 text-sm'
                      } ${
                        winner?.id === game.awayTeam?.id
                          ? 'bg-green-100 font-semibold'
                          : winner && game.awayTeam ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleTeamClick(game, game.awayTeam)}
                    >
                      <span className="truncate flex-1">
                        {game.awayTeam?.name || 'TBD'}
                      </span>
                      <span className={`font-bold ml-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {game.awayScore ?? ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            });
          })}

          {/* Champion box */}
          {(() => {
            const finalsGame = gamesByRound[maxRound]?.[0];
            const champion = finalsGame ? getWinner(finalsGame) : null;

            const spacingMultiplier = Math.pow(2, maxRound - 1);
            const baseSpacing = matchupHeight * 2;
            const roundSpacing = baseSpacing * spacingMultiplier;
            const championY = (roundSpacing - matchupHeight) / 2;
            const championX = maxRound * (matchupWidth + connectorWidth);

            return (
              <div
                className="absolute"
                style={{
                  left: `${championX}px`,
                  top: `${championY}px`,
                  width: `${matchupWidth}px`,
                  height: `${matchupHeight}px`,
                }}
              >
                <div className={`h-full flex items-center justify-center rounded shadow-sm ${
                  champion
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold'
                    : 'bg-gray-100 border border-gray-300 text-gray-400'
                }`}>
                  <div className="text-center px-2">
                    <div className={compact ? 'text-sm' : 'text-base'}>
                      {champion?.name || 'TBD'}
                    </div>
                    {champion && (
                      <div className={`text-yellow-100 ${compact ? 'text-xs' : 'text-xs'}`}>
                        Champion
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
