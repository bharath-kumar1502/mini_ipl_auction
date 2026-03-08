import urllib.request
import urllib.parse
import json

queries = [
    "Royal Challengers Bengaluru logo",
    "Rajasthan Royals Logo",
    "Sunrisers Hyderabad Logo",
    "Lucknow Super Giants IPL Logo",
    "Delhi Capitals Logo"
]

headers = {'User-Agent': 'Mozilla/5.0'}

for q in queries:
    api_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=File:{urllib.parse.quote(q)}&utf8=&format=json"
    req = urllib.request.Request(api_url, headers=headers)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data['query']['search']:
            print(f"{q}: {data['query']['search'][0]['title']}")
        else:
            print(f"{q}: Not found")
