import urllib.request
import urllib.parse
import json
import os

os.makedirs("images", exist_ok=True)

files = {
    "rcb.png": "File:Royal Challengers Bengaluru Logo.svg",
    "rr.png": "File:Rajasthan Royals Logo.png",
    "srh.png": "File:Sunrisers Hyderabad Logo.svg",
    "lsg.png": "File:Lucknow Super Giants Logo.svg",
    "dc.png": "File:Delhi Capitals.png"
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}

for name, filename in files.items():
    encoded_filename = urllib.parse.quote(filename)
    api_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={encoded_filename}&prop=imageinfo&iiprop=url&iiurlwidth=512&format=json"
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            pages = data['query']['pages']
            page = list(pages.values())[0]
            if 'imageinfo' in page:
                imageinfo = page['imageinfo'][0]
                image_url = imageinfo.get('thumburl') or imageinfo.get('url')
                # Download image
                img_req = urllib.request.Request(image_url, headers=headers)
                with urllib.request.urlopen(img_req) as img_resp, open(f"images/{name}", 'wb') as f:
                    f.write(img_resp.read())
                print(f"Success: {name} downloaded from {image_url}")
            else:
                print(f"Failed to find image info for {name}")
    except Exception as e:
        print(f"Error for {name}: {e}")
