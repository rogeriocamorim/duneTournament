// Script to set up a 28-player tournament with Round 1 complete

const testTournament = {
  phase: "qualifying",
  metadata: {
    tournamentName: "Test Tournament - Share Feature",
    dateCreated: new Date().toISOString(),
    jsonbinId: "",
    jsonbinKey: ""
  },
  players: [
    { id: "p1", name: "Paul Atreides", gamesPlayed: 1, totalPoints: 3, totalVP: 12, isActive: true },
    { id: "p2", name: "Duncan Idaho", gamesPlayed: 1, totalPoints: 3, totalVP: 11, isActive: true },
    { id: "p3", name: "Gurney Halleck", gamesPlayed: 1, totalPoints: 3, totalVP: 10, isActive: true },
    { id: "p4", name: "Thufir Hawat", gamesPlayed: 1, totalPoints: 3, totalVP: 9, isActive: true },
    { id: "p5", name: "Lady Jessica", gamesPlayed: 1, totalPoints: 2, totalVP: 11, isActive: true },
    { id: "p6", name: "Chani Kynes", gamesPlayed: 1, totalPoints: 2, totalVP: 10, isActive: true },
    { id: "p7", name: "Stilgar", gamesPlayed: 1, totalPoints: 2, totalVP: 9, isActive: true },
    { id: "p8", name: "Baron Harkonnen", gamesPlayed: 1, totalPoints: 1, totalVP: 10, isActive: true },
    { id: "p9", name: "Feyd-Rautha", gamesPlayed: 1, totalPoints: 1, totalVP: 9, isActive: true },
    { id: "p10", name: "Beast Rabban", gamesPlayed: 1, totalPoints: 1, totalVP: 8, isActive: true },
    { id: "p11", name: "Piter de Vries", gamesPlayed: 1, totalPoints: 0, totalVP: 9, isActive: true },
    { id: "p12", name: "Count Fenring", gamesPlayed: 1, totalPoints: 3, totalVP: 12, isActive: true },
    { id: "p13", name: "Princess Irulan", gamesPlayed: 1, totalPoints: 3, totalVP: 11, isActive: true },
    { id: "p14", name: "Reverend Mother", gamesPlayed: 1, totalPoints: 3, totalVP: 10, isActive: true },
    { id: "p15", name: "Shaddam IV", gamesPlayed: 1, totalPoints: 2, totalVP: 10, isActive: true },
    { id: "p16", name: "Liet Kynes", gamesPlayed: 1, totalPoints: 2, totalVP: 9, isActive: true },
    { id: "p17", name: "Dr. Yueh", gamesPlayed: 1, totalPoints: 2, totalVP: 8, isActive: true },
    { id: "p18", name: "Glossu Rabban", gamesPlayed: 1, totalPoints: 1, totalVP: 9, isActive: true },
    { id: "p19", name: "Hasimir Fenring", gamesPlayed: 1, totalPoints: 1, totalVP: 8, isActive: true },
    { id: "p20", name: "Alia Atreides", gamesPlayed: 1, totalPoints: 1, totalVP: 7, isActive: true },
    { id: "p21", name: "Leto Atreides", gamesPlayed: 1, totalPoints: 0, totalVP: 8, isActive: true },
    { id: "p22", name: "Esmar Tuek", gamesPlayed: 1, totalPoints: 3, totalVP: 11, isActive: true },
    { id: "p23", name: "Staban Tuek", gamesPlayed: 1, totalPoints: 3, totalVP: 10, isActive: true },
    { id: "p24", name: "Jamis", gamesPlayed: 1, totalPoints: 2, totalVP: 9, isActive: true },
    { id: "p25", name: "Harah", gamesPlayed: 1, totalPoints: 2, totalVP: 8, isActive: true },
    { id: "p26", name: "Otheym", gamesPlayed: 1, totalPoints: 1, totalVP: 8, isActive: true },
    { id: "p27", name: "Korba", gamesPlayed: 1, totalPoints: 1, totalVP: 7, isActive: true },
    { id: "p28", name: "Farok", gamesPlayed: 1, totalPoints: 0, totalVP: 7, isActive: true }
  ],
  rounds: [
    {
      roundNumber: 1,
      tables: [
        {
          tableNumber: 1,
          playerIds: ["p1", "p2", "p3", "p4"],
          results: [
            { playerId: "p1", points: 3, vp: 12, leaderUsed: "Paul Atreides" },
            { playerId: "p2", points: 2, vp: 11, leaderUsed: "Duncan Idaho" },
            { playerId: "p3", points: 1, vp: 10, leaderUsed: "Gurney Halleck" },
            { playerId: "p4", points: 0, vp: 9, leaderUsed: "Thufir Hawat" }
          ]
        },
        {
          tableNumber: 2,
          playerIds: ["p5", "p6", "p7", "p8"],
          results: [
            { playerId: "p5", points: 3, vp: 11, leaderUsed: "Lady Jessica" },
            { playerId: "p6", points: 2, vp: 10, leaderUsed: "Chani Kynes" },
            { playerId: "p7", points: 1, vp: 9, leaderUsed: "Stilgar" },
            { playerId: "p8", points: 0, vp: 10, leaderUsed: "Baron Harkonnen" }
          ]
        },
        {
          tableNumber: 3,
          playerIds: ["p9", "p10", "p11", "p12"],
          results: [
            { playerId: "p12", points: 3, vp: 12, leaderUsed: "Count Fenring" },
            { playerId: "p9", points: 2, vp: 9, leaderUsed: "Feyd-Rautha" },
            { playerId: "p10", points: 1, vp: 8, leaderUsed: "Beast Rabban" },
            { playerId: "p11", points: 0, vp: 9, leaderUsed: "Piter de Vries" }
          ]
        },
        {
          tableNumber: 4,
          playerIds: ["p13", "p14", "p15", "p16"],
          results: [
            { playerId: "p13", points: 3, vp: 11, leaderUsed: "Princess Irulan" },
            { playerId: "p14", points: 2, vp: 10, leaderUsed: "Reverend Mother" },
            { playerId: "p15", points: 1, vp: 10, leaderUsed: "Shaddam IV" },
            { playerId: "p16", points: 0, vp: 9, leaderUsed: "Liet Kynes" }
          ]
        },
        {
          tableNumber: 5,
          playerIds: ["p17", "p18", "p19", "p20"],
          results: [
            { playerId: "p17", points: 3, vp: 8, leaderUsed: "Dr. Yueh" },
            { playerId: "p18", points: 2, vp: 9, leaderUsed: "Glossu Rabban" },
            { playerId: "p19", points: 1, vp: 8, leaderUsed: "Hasimir Fenring" },
            { playerId: "p20", points: 0, vp: 7, leaderUsed: "Alia Atreides" }
          ]
        },
        {
          tableNumber: 6,
          playerIds: ["p21", "p22", "p23", "p24"],
          results: [
            { playerId: "p22", points: 3, vp: 11, leaderUsed: "Esmar Tuek" },
            { playerId: "p23", points: 2, vp: 10, leaderUsed: "Staban Tuek" },
            { playerId: "p24", points: 1, vp: 9, leaderUsed: "Jamis" },
            { playerId: "p21", points: 0, vp: 8, leaderUsed: "Leto Atreides" }
          ]
        },
        {
          tableNumber: 7,
          playerIds: ["p25", "p26", "p27", "p28"],
          results: [
            { playerId: "p25", points: 3, vp: 8, leaderUsed: "Harah" },
            { playerId: "p26", points: 2, vp: 8, leaderUsed: "Otheym" },
            { playerId: "p27", points: 1, vp: 7, leaderUsed: "Korba" },
            { playerId: "p28", points: 0, vp: 7, leaderUsed: "Farok" }
          ]
        }
      ]
    }
  ],
  top16Bracket: null,
  finalStandings: null
};

console.log(JSON.stringify(testTournament, null, 2));
