'use client';

import { useState } from 'react';

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
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

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
    return null; // Tie - shouldn't happen in elimination
  };

  const handleTeamClick = (game: BracketGame, team: Team | null) => {
    if (!team || !onSelectWinner || !showControls) return;

    const winner = getWinner(game);

    // If clicking the current winner, clear it
    if (winner?.id === team.id && onClearWinner) {
      onClearWinner(game.id);
    } else {
      // Select this team as winner
      onSelectWinner(game.id, team.id);
    }
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {rounds.map((round) => {
          const roundGames = gamesByRound[round] || [];
          // Calculate spacing - later rounds have fewer games, need more vertical spacing
          const gamesInRound = roundGames.length;
          const spacingMultiplier = Math.pow(2, round - 1);

          return (
            <div key={round} className="flex-shrink-0" style={{ minWidth: compact ? '200px' : '280px' }}>
              <h3 className={`font-semibold text-foreground mb-3 text-center ${compact ? 'text-sm' : 'text-lg'}`}>
                {getRoundName(round)}
              </h3>
              <div
                className="flex flex-col justify-around"
                style={{
                  gap: `${spacingMultiplier * (compact ? 8 : 16)}px`,
                  minHeight: `${gamesInRound * (compact ? 80 : 120) + (gamesInRound - 1) * spacingMultiplier * (compact ? 8 : 16)}px`
                }}
              >
                {roundGames.map((game) => {
                  const winner = getWinner(game);
                  const isSelected = selectedGame === game.id;

                  return (
                    <div
                      key={game.id}
                      className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => showControls && setSelectedGame(isSelected ? null : game.id)}
                    >
                      {/* Game info header */}
                      {(game.court || game.timeSlot) && (
                        <div className={`bg-gray-50 border-b flex justify-between items-center ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}>
                          <span className="font-medium text-foreground">
                            {game.court?.name || 'TBD'}
                          </span>
                          {game.timeSlot && (
                            <span className="text-muted">
                              {game.timeSlot.startTime}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Home team */}
                      <div
                        className={`flex justify-between items-center border-b cursor-pointer transition-colors ${
                          compact ? 'px-2 py-1.5' : 'px-3 py-2'
                        } ${
                          winner?.id === game.homeTeam?.id
                            ? 'bg-green-50'
                            : winner && game.homeTeam ? 'bg-gray-50 text-muted' : 'hover:bg-gray-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTeamClick(game, game.homeTeam);
                        }}
                      >
                        <span className={`font-medium truncate ${compact ? 'text-sm' : ''} ${
                          winner?.id === game.homeTeam?.id ? 'text-green-700 font-semibold' : 'text-foreground'
                        }`}>
                          {game.homeTeam?.name || 'TBD'}
                        </span>
                        <span className={`font-bold ml-2 ${compact ? 'text-sm' : 'text-lg'}`}>
                          {game.homeScore ?? '-'}
                        </span>
                      </div>

                      {/* Away team */}
                      <div
                        className={`flex justify-between items-center cursor-pointer transition-colors ${
                          compact ? 'px-2 py-1.5' : 'px-3 py-2'
                        } ${
                          winner?.id === game.awayTeam?.id
                            ? 'bg-green-50'
                            : winner && game.awayTeam ? 'bg-gray-50 text-muted' : 'hover:bg-gray-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTeamClick(game, game.awayTeam);
                        }}
                      >
                        <span className={`font-medium truncate ${compact ? 'text-sm' : ''} ${
                          winner?.id === game.awayTeam?.id ? 'text-green-700 font-semibold' : 'text-foreground'
                        }`}>
                          {game.awayTeam?.name || 'TBD'}
                        </span>
                        <span className={`font-bold ml-2 ${compact ? 'text-sm' : 'text-lg'}`}>
                          {game.awayScore ?? '-'}
                        </span>
                      </div>

                      {/* Status indicator */}
                      {game.status === 'completed' && winner && (
                        <div className={`bg-green-500 text-white text-center font-medium ${compact ? 'text-xs py-0.5' : 'text-sm py-1'}`}>
                          {winner.name} Wins
                        </div>
                      )}
                      {game.status === 'in_progress' && (
                        <div className={`bg-yellow-500 text-black text-center font-medium animate-pulse ${compact ? 'text-xs py-0.5' : 'text-sm py-1'}`}>
                          In Progress
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Champion display */}
        {maxRound > 0 && (
          <div className="flex-shrink-0 flex items-center" style={{ minWidth: compact ? '150px' : '200px' }}>
            <div className="w-full">
              <h3 className={`font-semibold text-foreground mb-3 text-center ${compact ? 'text-sm' : 'text-lg'}`}>
                Champion
              </h3>
              <div className={`bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-lg text-center ${compact ? 'p-3' : 'p-6'}`}>
                {(() => {
                  const finalsGame = gamesByRound[maxRound]?.[0];
                  const champion = finalsGame ? getWinner(finalsGame) : null;
                  return champion ? (
                    <>
                      <div className={`text-white font-bold ${compact ? 'text-lg' : 'text-2xl'}`}>
                        {champion.name}
                      </div>
                      <div className={`text-yellow-100 ${compact ? 'text-xs' : 'text-sm'}`}>
                        Tournament Champion
                      </div>
                    </>
                  ) : (
                    <div className={`text-yellow-100 ${compact ? 'text-sm' : ''}`}>
                      TBD
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
