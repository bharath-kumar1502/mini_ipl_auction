const https = require('https');
const fs = require('fs');
const path = require('path');

const logos = {
    "csk.svg": "https://upload.wikimedia.org/wikipedia/en/2/2b/Chennai_Super_Kings_Logo.svg",
    "mi.svg": "https://upload.wikimedia.org/wikipedia/en/c/cd/Mumbai_Indians_Logo.svg",
    "rcb.png": "https://upload.wikimedia.org/wikipedia/en/1/1c/Royal_Challengers_Bengaluru_logo.png",
    "kkr.svg": "https://upload.wikimedia.org/wikipedia/en/4/4c/Kolkata_Knight_Riders_Logo.svg",
    "rr.svg": "https://upload.wikimedia.org/wikipedia/en/6/60/Rajasthan_Royals_Logo.svg",
    "srh.svg": "https://upload.wikimedia.org/wikipedia/en/8/81/Sunrisers_Hyderabad.svg",
    "lsg.svg": "https://upload.wikimedia.org/wikipedia/en/a/a9/Lucknow_Super_Giants_IPL_Logo.svg",
    "gt.svg": "https://upload.wikimedia.org/wikipedia/en/0/09/Gujarat_Titans_Logo.svg",
    "dc.svg": "https://upload.wikimedia.org/wikipedia/en/f/f5/Delhi_Capitals_Logo.svg",
    "pbks.svg": "https://upload.wikimedia.org/wikipedia/en/d/d4/Punjab_Kings_Logo.svg"
};

const dir = path.join(__dirname, 'images');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // handle redirect
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    redirectUrl = 'https://upload.wikimedia.org' + redirectUrl;
                }
                download(redirectUrl, dest).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

async function downloadAll() {
    for (const [filename, url] of Object.entries(logos)) {
        console.log(`Downloading ${filename}...`);
        try {
            await download(url, path.join(dir, filename));
            console.log(`Successfully downloaded ${filename}`);
        } catch (e) {
            console.error(`Error downloading ${filename}: ${e.message}`);
        }
    }
}

downloadAll();
