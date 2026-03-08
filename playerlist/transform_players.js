const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('parsed_players_raw.json', 'utf8'));

const playersData = [];
let idCounter = 1;

for (let row of rawData) {
    if (row[0] === 'List Sr. No.' || !row[3]) continue; // Skip header and empty rows

    const firstName = row[3];
    const surname = row[4];
    const country = row[5];
    const name = `${firstName} ${surname}`.trim();

    const setCode = row[2]; // e.g., 'BA1', 'AL1', 'FA1', 'UBA1', 'UAL1'

    // Map Specialism
    let role = "Batsman";
    const rawRole = row[9];
    if (rawRole === "WICKETKEEPER") role = "Wicketkeeper";
    if (rawRole === "ALL-ROUNDER") role = "All-Rounder";
    if (rawRole === "BOWLER") role = "Bowler";

    // Map Price
    const priceLakhs = parseInt(row[19]) || 20; // Default 20 Lakhs if empty
    const basePrice = priceLakhs * 100000;

    // Determine random rating based on Capped status
    const isCapped = row[18] === "Capped";
    const ratingList = isCapped ? [85, 87, 89, 91, 93, 95] : [70, 75, 78, 80, 82];
    const rating = ratingList[Math.floor(Math.random() * ratingList.length)];

    // Map friendly Set Category
    let setCategory = "General";
    if (setCode.startsWith("BA")) setCategory = "Batsman " + setCode.replace("BA", "");
    if (setCode.startsWith("AL")) setCategory = "All-Rounder " + setCode.replace("AL", "");
    if (setCode.startsWith("WK")) setCategory = "Wicketkeeper " + setCode.replace("WK", "");
    if (setCode.startsWith("FA")) setCategory = "Fast Bowler " + setCode.replace("FA", "");
    if (setCode.startsWith("SP")) setCategory = "Spinner " + setCode.replace("SP", "");

    if (setCode.startsWith("UBA")) setCategory = "Uncapped Batsman " + setCode.replace("UBA", "");
    if (setCode.startsWith("UAL")) setCategory = "Uncapped All-Rounder " + setCode.replace("UAL", "");
    if (setCode.startsWith("UFA")) setCategory = "Uncapped Fast Bowler " + setCode.replace("UFA", "");
    if (setCode.startsWith("USP")) setCategory = "Uncapped Spinner " + setCode.replace("USP", "");

    if (setCode.includes("M")) setCategory = "Marquee " + setCode.replace("M", "");

    playersData.push({
        id: `p${idCounter++}`,
        name: name,
        role: role,
        country: country,
        basePrice: basePrice,
        rating: rating,
        set: setCode,
        setCategory: setCategory,
        status: "Available"
    });
}

const fileOutput = `// Player Data parsed from Official Registered Playerlist PDF
const playersData = ${JSON.stringify(playersData, null, 4)};

module.exports = { teamsData, playersData };
`;

fs.writeFileSync('players_output.js', fileOutput);
console.log(`Successfully mapped ${playersData.length} players with nationalities!`);
