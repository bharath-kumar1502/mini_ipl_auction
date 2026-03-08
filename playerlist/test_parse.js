const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('./playerlist/registered playerlist.pdf');

pdf(dataBuffer).then(function (data) {
    // Print first 5000 characters to understand structure
    console.log(data.text.substring(0, 5000));
}).catch(err => {
    console.error("Error parsing PDF:", err);
});
