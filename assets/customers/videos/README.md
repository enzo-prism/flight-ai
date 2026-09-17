# Customer story videos — provenance

Web derivatives for the `#customers` section on index.html. Raw GB-sized
interview masters are NEVER embedded; only these files ship with the site.

## Sources (Mach 1 content engine library, PortableSSD)

- S1 = `/Volumes/PortableSSD/00_RAW/Mach 1 AI/Customer Interviews/2026-07-09-session-1/`
- S2 = `/Volumes/PortableSSD/00_RAW/Mach 1 AI/Customer Interviews/2026-07-27-session-01/`
- S3 = `/Volumes/PortableSSD/00_RAW/Mach 1 AI/imported-2026-09-16-downloads/`
- Gould transcript: `/Volumes/PortableSSD/01_CLIENTS/Mach 1 AI/Workspaces/hyperframes/2026-09-16-mach1-interview/transcript.md`

## Derivatives

| File | Source | Range (source tc) |
|---|---|---|
| byrd-managing-myra-full.mp4 | S1 `…stu_0037.mp4` (4:16, 113 MB) | full |
| byrd-love-mach1-highlight.mp4 | S1 `…stu_0037.mp4` | 81–115s |
| byrd-bottleneck-highlight.mp4 | S1 `…stu_0039.mp4` (18:38, 610 MB) | 236–262s |
| gould-four-minutes-highlight.mp4 | S3 `…stu_0049.mp4` (41:30, 1.3 GB) | 1525–1612s |
| mcgowan-sales-team-highlight.mp4 | S2 `craig-camera-original.mp4` (37:50, 700 MB) | 1768–1800s |

- Video: 1280x720 H.264 (`-preset fast -crf 27`), AAC 96k, `+faststart`.
- Posters: 1280x720 JPEG `-q:v 3` at 130s (0037), 95s (0037 love clip),
  550s (0039), 1572s (0049), 1782s (craig). Eyes-open verified.
- Captions: `.vtt` from Riverside `words.json` (Byrd), word-level JSON
  (craig), verbatim transcript block with coarse timing (Gould).
  Only normalization: ASR brand-name fixes (Mac One→Mach 1, MIRA→Myra,
  Practica→Praktika). Generator: `/tmp/work/gen_vtt.py`.

## Omitted from the section (deliberate)

- 0038 (Rob Meinhardt track): interviewer only, no customer voice.
- 0036 (Sam ISO): silent track, no speech.
- 0050 / backup / rob-clean / 0197 / 0202 / 0246: GB-scale, no transcripts;
  duplicates of the Gould session or untranscribed — no raw embeds.

## SHA-256

```
ee7ca61011c558559c8472feb1950e2f775dbbc37093b5a49270fa6ae1f51659  byrd-bottleneck-highlight.mp4
449c15539d6bd8bb2c5804e599e953d133592d652d80b3cdd27745c3721b177e  byrd-bottleneck-highlight.vtt
0c1dc6581ea7840fb5c57a19000f6265930d34d817ef01bdefaf94d7b715caad  byrd-bottleneck.jpg
b9a0830ce9ef764ef6cf2065cb2cb8db485d991c0e7379096f2e1b7dbfe33d59  byrd-love-mach1-highlight.mp4
e86e029bdd7427cd754883621e34f0d52c988e589035adbe8b800c25dbe38117  byrd-love-mach1-highlight.vtt
2d9d18bc41537bc665ad4f94dea67b4c6e8fcd71473f8d50c043ab3aa18420cf  byrd-love-mach1.jpg
f052cfecd942a2f8d2a1b7041485230e26b28b00f0051fc70fe4864f281088d8  byrd-managing-myra-full.mp4
5b6704abbb86f54343f9eb0871b655995e14c40125759130435c47b9f583c178  byrd-managing-myra-full.vtt
4fd0c8a534eac111d015517837becccc2a7bddad60b0f43301df18275e552ec4  byrd-managing-myra.jpg
9c9f40066435499c5284848f3cff82cf3e556d7528280fc03fdf32776a2951ab  gould-four-minutes-highlight.mp4
2b20e584820f283901122a8b8ec49308c0d3ef9fd2076bbdaf9a7e5bad66bcbd  gould-four-minutes-highlight.vtt
95597f8864e511c7277cd3f7160e8ae92923974da77be37ba89dbba6c496d198  gould-four-minutes.jpg
89601870c5cf31d8a67da43e60b1f953a0fcc9cfb8c0ef6ae2547ef5399c9342  mcgowan-sales-team-highlight.mp4
35af22668a651f04a9a1b1161f1532328381a8e814c2b504821942ce409342a9  mcgowan-sales-team-highlight.vtt
0b2c3a0ac68a2c3e614602985d532d5a07bae86d9b0daf81c163cae3a872a911  mcgowan-sales-team.jpg
```
