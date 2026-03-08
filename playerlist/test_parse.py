import pdfplumber
import json
import sys

def parse_pdf_tables(pdf_path):
    all_players = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                table = page.extract_table()
                if table:
                    # Often the first page has headers, skip row 0 if it contains 'List Sr. No.'
                    start_idx = 1 if 'List Sr. No.' in str(table[0]) else 0
                    
                    for row in table[start_idx:]:
                        if not row or not row[0]: continue
                        
                        # Clean up newlines in cells
                        clean_row = [str(cell).replace('\n', ' ').strip() if cell else "" for cell in row]
                        all_players.append(clean_row)
        
        print(f"Total players found: {len(all_players)}")
        print(json.dumps(all_players[:5], indent=2))
        
        # Save to a json to inspect
        with open('parsed_players_raw.json', 'w') as f:
            json.dump(all_players, f, indent=4)
            
    except Exception as e:
        print(f"Error parsing PDF: {e}")

if __name__ == "__main__":
    parse_pdf_tables("registered playerlist.pdf")
