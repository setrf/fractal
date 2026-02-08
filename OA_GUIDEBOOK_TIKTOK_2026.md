# TikTok OA Guidebook (AI Product Manager Intern, Summer 2026)

This guide is tailored to your OA prompt: a **single-attempt** submission with a **5-minute screen recording** that presents an AI project you built.

## 1) OA Constraints (from invite)

- Role: `AI Product Manager Intern (TikTok-Product-Social and Creation) - 2026 Summer (BS/MS)`
- Assessment link is unique and single-use.
- Video submission format: **Google Drive link**.
- Drive permission must be: **Anyone with the link can view**.
- You are expected to present a project built by you.
- If upload issues occur, contact `luobinyan@bytedance.com` before deadline with:
  - Position name
  - Exact applicant name used in application
  - Problem description
  - OA video attached

Important date clarity:
- Your invite email timestamp shows **February 5, 2026, 12:35 AM**.
- With a 5-day window, the likely cutoff is around **February 10, 2026, 12:35 AM** (in your mailbox/account timezone).
- Target submission by **February 9, 2026** to avoid last-hour upload risk.

## 2) Demo Positioning (What interviewers should remember)

Your one-line positioning:

- "Fractal is a question-first AI exploration system that uses online evals to self-improve generation quality over time."

PM framing:

- User problem: people get answers fast but ask shallow questions.
- Product thesis: quality of inquiry is a leverage point for creativity and decision quality.
- AI moat: eval loop + prompt policy memory + model-by-seed performance learning + cost guardrails.

## 3) What this branch now demonstrates (AI-heavy)

Core upgrades implemented for this OA:

- Eval telemetry panel (prompt leaderboard, recent runs, model memory, token usage)
- LLM-judge outputs beyond score: confidence, uncertainty, strengths, weaknesses
- Prompt variant adaptive selection with persistence across restarts
- Model performance memory by seed type (causal, mechanistic, counterfactual, etc.)
- Token budget warning + hard-stop guardrails
- A/B compare generation mode (left/right variants/models, winner reason)
- Best branch highlighting in tree (based on cumulative quality)
- Replay timeline for narrating user journey and product instrumentation
- Probe brief export (`.md`) for PM-ready output
- Probe auto-suggested next experiments
- Golden regression eval runner (`server/scripts/run-evals.ts`)

## 4) Technical Readiness Checklist (before recording)

## 4.1 Environment

Run in two terminals from project root:

```bash
# terminal 1
cd /Users/mertgulsun/Desktop/fractal/server
cp .env.example .env   # if not done yet
# add WANDB_API_KEY in .env
npm install
npm run dev
```

```bash
# terminal 2
cd /Users/mertgulsun/Desktop/fractal
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/health`

## 4.2 Pre-demo sanity checks

- Confirm model list loads in UI.
- Submit one seed question and verify children generate.
- Confirm score + confidence + uncertainty appears in metadata line.
- Open Eval Telemetry and confirm data populates.
- Run A/B compare once and apply one side.
- Open Probe, synthesize once, then click Export Brief.
- Verify Replay Timeline appears and contains events.

## 4.3 (Optional) quick eval report for credibility

```bash
cd /Users/mertgulsun/Desktop/fractal/server
npm run evals:golden
```

Mention in demo: "We also run fixed-question regression evals and store reports."

## 5) Your 5-Minute Recording Script (high-signal version)

## 0:00-0:25 — Problem + Product Thesis

Say:

- "I built Fractal to optimize for better questions, not just faster answers."
- "For AI PM work, this is useful because exploration quality drives experiment quality."

Show:

- Empty app landing state.

## 0:25-1:10 — Seed and first Deep Dive

Action:

1. Enter seed: `How should social platforms optimize for learning over engagement?`
2. Let AI generate branch questions.

Say:

- "Each generation uses prompt variants and is evaluated by an LLM judge."

Point out on screen:

- Score
- Prompt variant
- Confidence / uncertainty
- Judge strengths / weaknesses

## 1:10-2:00 — Eval Telemetry (self-improvement core)

Action:

1. Open/point at Eval Telemetry panel.
2. Show Prompt Variant Leaderboard.
3. Show Recent Runs.
4. Show Model Memory by Seed Type.
5. Show Token Budget usage line.

Say:

- "This is the online eval loop: we record quality over time and adapt prompt selection."
- "Memory persists, so strategy improves across sessions."
- "We also include token guardrails for production-safe cost behavior."

## 2:00-2:45 — A/B Compare (PM experimentation workflow)

Action:

1. Select a right-side model (or keep same model, different variant implicitly).
2. Click `Run Compare`.
3. Show left/right outputs and winner reason.
4. Click `Apply Left` or `Apply Right`.

Say:

- "This is a built-in experiment harness: compare candidates, choose winner, apply to product state."
- "It maps directly to AI PM experimentation loops."

## 2:45-3:20 — Best Branch + Replay Timeline

Action:

1. Click a few nodes.
2. Point to best-branch indicator.
3. Show Replay Timeline and hit Play.

Say:

- "Best branch surfaces highest cumulative quality path."
- "Replay gives an auditable narrative of user and model actions."

## 3:20-4:20 — Probe Synthesis to PM Artifacts

Action:

1. Add 2-3 items to Stash.
2. Open Probe and synthesize direction.
3. Click `Export Brief`.
4. Mention auto-generated experiment suggestions in chat.

Say:

- "This converts exploratory AI outputs into PM artifacts: problem statement, hypotheses, metrics, risks, and next experiments."

## 4:20-5:00 — Close with PM Lens

Say:

- "This project shows an AI product loop end-to-end: generation, evaluation, adaptation, decisioning, and experiment planning."
- "The focus is not just model output, but measurable quality improvement and operator control."

## 6) Suggested Narration Snippets (use naturally)

- "Confidence and uncertainty are exposed so we can make risk-aware product decisions."
- "Model performance memory is segmented by seed type, which lets us reason about when a model is strong."
- "Cost guardrails are first-class, because AI PM is also about economics and reliability."
- "A/B compare plus replay gives us a lightweight but practical experimentation framework."

## 7) Recording Quality Checklist

Before pressing record:

- Do Not Disturb on
- Notifications off
- Mic level checked (audible, no clipping)
- Browser zoom at 100%
- Font size readable
- Quiet room
- Keep terminal pre-opened only if needed (avoid distracting logs)

During recording:

- Keep cursor intentional
- Do not over-scroll
- Pause 1-2 seconds after each key action
- If something fails, narrate fallback calmly and continue

## 8) Failure/Fallback Plan (if API/model hiccups happen live)

If generation fails:

- Use existing generated nodes and continue with Eval panel + compare history.
- State: "Transient provider error; architecture still demonstrates eval loop and memory."

If model list fails:

- Continue with default model path and focus on compare, scoring, telemetry, and probe export.

If Probe call fails:

- Show existing probe messages and explain exported brief flow conceptually.

## 9) Submission Workflow (Google Drive + OA form)

1. Record and export video locally (`.mp4`).
2. Upload to Google Drive.
3. Right click video -> Share -> set access to `Anyone with the link can view`.
4. Copy link and test in incognito window.
5. Open OA link and paste video URL.
6. Submit once after final verification.

Final check before submit:

- Link opens without login requirement.
- Audio is clear from first 20 seconds.
- Screen text is readable at normal playback.

## 10) Email fallback template (if OA upload/link breaks)

To: `luobinyan@bytedance.com`

Subject:

`AI Product Manager Intern (TikTok-Product-Social and Creation) - OA Upload Issue - Mert Gulsun`

Body template:

- Applied Name: Mert Gulsun
- Position: AI Product Manager Intern (TikTok-Product-Social and Creation) - 2026 Summer (BS/MS)
- Issue: [brief description]
- Assessment Link Access Time: [time/date]
- Attached: OA video file
- Drive Link Attempted: [URL]

## 11) Last 24-Hour Execution Plan

- T-24h: Dry run once, record once, review clarity.
- T-18h: Improve pacing, trim dead time, record final take.
- T-12h: Upload + permission verify.
- T-6h: Fill OA form but do final review before submit.
- T-3h: Submit.

## 12) Optional Add-on if time remains

- Include a 15-second cut to W&B Weave trace page showing one generation + score trace.
- Mention golden regression reports in `server/reports/` as ongoing quality process.

---

If you want, you can follow this guide verbatim and keep the demo under 5 minutes while still signaling strong AI PM judgment (quality metrics, experimentation, reliability, and cost discipline).
