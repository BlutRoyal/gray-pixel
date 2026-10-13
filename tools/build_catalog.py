"""Builds src/data.js (the Ballerz + Sneakerz catalog) from the BBL Season 9 roster CSVs.
Usage: python3 tools/build_catalog.py <ballerz.csv> <sneakerz.csv> > src/data.js
Baller row: [BallerID, Dunk, Playmaking, Shooting, Defense, bodyIdx, teamIdx, hairIdx, accessoryIdx+1 (0 = none), flags (1 armband, 2 headband), role (0 player, 1 captain, 2 all-star)]
Sneaker row: [SneakerID, Jump, enhancementIdx, rarityIdx, designIdx, dripFactor]
Rows without stats (225 unrevealed Ballerz) are skipped. Column 13 of the Sneakerz CSV is Jump."""
import sys, json, pandas as pd
b = pd.read_csv(sys.argv[1], skiprows=1).dropna(subset=['Dunks'])
bodies = sorted(b.Body.dropna().unique()); teams = sorted(b.Team.dropna().unique())
hairs = sorted(b.Hair.dropna().unique()); accs = sorted(b.Accessory.dropna().unique())
B = []
for _, r in b.iterrows():
    acc = r.Accessory if isinstance(r.Accessory, str) else ''
    B.append([int(r.BallerID), int(r.Dunks), int(r.Playmaking), int(r.Shooting), int(r.Defense),
              bodies.index(r.Body), teams.index(r.Team), hairs.index(r.Hair) if isinstance(r.Hair, str) else 0,
              (accs.index(acc) + 1) if acc else 0,
              (1 if str(r['Armband?']) == 'True' else 0) + (2 if str(r['Headband?']) == 'True' else 0),
              {'Player': 0, 'Captain': 1, 'All-Star': 2}.get(r.Role, 0)])
s = pd.read_csv(sys.argv[2], skiprows=1).rename(columns={'Unnamed: 13': 'J'}).drop_duplicates('SneakerID')
enh = ['', 'Ankle Breaker', 'Drive the Lane', 'Stopping on a Dime', 'Bullseye']
rar = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Iconic', 'Custom']
des = sorted(s.Design.dropna().unique())
S = [[int(r.SneakerID), int(r.J), enh.index(r.Enhancement) if isinstance(r.Enhancement, str) else 0,
      rar.index(r.Rarity), des.index(r.Design) if isinstance(r.Design, str) else 0, int(r.DripFactor)] for r in s.itertuples()]
print('const DATA=' + json.dumps({'bodies': bodies, 'teams': teams, 'hairs': hairs, 'accs': accs, 'enh': enh, 'rar': rar, 'des': des, 'B': B, 'S': S}, separators=(',', ':')) + ';')
