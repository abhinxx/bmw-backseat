"""D5: example-record spot checks for the report (source framing shares, shared-text IDs)."""
import pickle
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "research" / "data"
df = pickle.load(open(OUT / "D_rows.pkl", "rb"))

for s in ["A", "B", "C", "D"]:
    g = df[df["Source"] == f"Source {s}"].drop_duplicates("ID")
    t = g["Customer Feedback"].astype(str)
    print(s, "ex:", g["ID"].iloc[0], "|", t.iloc[0][:90].replace("\n", " "))
    print("   'Customer ' prefix:", round(t.str.match("Customer ").mean(), 3),
          " 'I had a':", round(t.str.match("I had a").mean(), 3),
          " 'one thing I love most':", round(t.str.contains("one thing I love most", case=False).mean(), 3))
print(df[df["ID"].isin(["G60-1674", "G60-2202"])][["ID", "Source", "Country", "Feedback Type", "Vfc level2 Name"]].to_string())
print(df[df["ID"].isin(["F70-0837", "F70-1507"])][["ID", "Source", "Country", "Feedback Type"]].drop_duplicates().to_string())
print(df[df["ID"].isin(["G70-0326"])][["ID", "Source", "Vfc level2 3 Name"]].to_string())
# one G60xG70 shared text example IDs
def norm(x):
    import re
    if not isinstance(x, str): return ""
    x = x.lower().replace("\u2019", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", x)).strip()
g6 = df[df.Model == "G60"].drop_duplicates("ID"); g7 = df[df.Model == "G70"].drop_duplicates("ID")
g6["n"] = g6["Customer Feedback"].map(norm); g7["n"] = g7["Customer Feedback"].map(norm)
sh = set(g6.n) & set(g7.n)
t0 = [x for x in sh if "touchscreen" in x][0]
print("shared G60/G70 text:", t0[:80])
print("G60 IDs:", sorted(g6[g6.n == t0].ID.tolist()), "G70 IDs:", sorted(g7[g7.n == t0].ID.tolist()))
