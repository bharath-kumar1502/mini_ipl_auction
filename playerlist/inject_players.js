const fs = require('fs');

const path = '../js/data.js';
let content = fs.readFileSync(path, 'utf8');
const newPlayersFileContent = fs.readFileSync('players_output.js', 'utf8');

// Find where "const playersData =" starts
const startIndex = content.indexOf('const playersData =');

if (startIndex !== -1) {
    // Keep everything before playersData (which is the teamsData)
    const teamsPart = content.substring(0, startIndex);

    // We want to keep the final CommonJS export if it exists
    const exportIndex = content.indexOf('if (typeof module !== \'undefined\')', startIndex);

    let footer = "";
    if (exportIndex !== -1) {
        footer = content.substring(exportIndex);
    } else {
        footer = "if (typeof module !== 'undefined') {\n    module.exports = { teamsData, playersData };\n}\n";
    }

    // Extract the new playersData declaration exactly as outputted
    let newDeclaration = newPlayersFileContent;
    // Strip the last line from players_output.js (which added module.exports)
    newDeclaration = newDeclaration.split('module.exports')[0].trim();

    const finalFile = teamsPart + newDeclaration + '\n\n' + footer;
    fs.writeFileSync(path, finalFile);
    console.log("Successfully injected 369 real players into data.js!");
}
