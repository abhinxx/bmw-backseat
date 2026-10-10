#!/usr/bin/env python
"""A_explore.py — quick structural check of the G60 Feedback_Explorer CSV."""
import pandas as pd

df = pd.read_csv("research/data/A_g60_feedback_explorer.csv", dtype=str)
print("shape:", df.shape)
print("columns:", list(df.columns))
print(df.head(3).to_string())
for c in df.columns:
    print(f"\n--- {c} --- nunique={df[c].nunique(dropna=True)} nulls={df[c].isna().sum()}")
    vc = df[c].value_counts(dropna=False).head(12)
    print(vc.to_string())
