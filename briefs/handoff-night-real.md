# Handoff: night-real — READY (live v5.11.5.2)
Branch feat/night-real, commit 61f4888 (stamp "v5.11.5.2 · 95d5c9c"), rebased onto 883107c (v5.11.5.1).
Netlify deploy 6ae5828fb9c243c5c0a79635 (ready 15:54 AEST 31 Oct 2026), from git-archive export/nr5152 (private_edm and the 126/127 shots excluded).
Files: nightsky.js (new), night.js, ext3.js (night nr1), tags main/ext/ext2/ext3 n3, night_real_test.mjs, docs/night-real.md.
Tests (local, run one at a time): night_real 21/0, night 36/0, showroom 165/0, phone 87/0, desk 25/0, dock 35/0, start 38/0, ddtracks 89/0.
ddrun 70/1 (desk motor stall did not reach stall inside 20 s under box load 30; passes with a 60 s wait). The live baseline 883107c also fails ddrun 70/1 every run (cold start). So both are load timing, pre-existing.
showroom3d: rig card overlap fails on the baseline too (pre-existing).
Phone FPS (Low, 4x throttle): day 3.3 / night 3.7. That is within 10%.
Shots: shots_live/180_before_*.png, 180_after_*.png.
Pending: once Showroom B v5.11.6 is live, rebase onto it so the night work is kept.
