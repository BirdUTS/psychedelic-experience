# Hosting Flow with Mind at flow.birdview.hk

Stage 1 of the v4 plan (2026-11-01): put the app that exists today on a public link with JEV working, without changing
the app itself. The chain copies Story Stage (`story.birdview.hk`): a GitHub repo, one Render web service running the
stdlib Python server, secrets typed in the Render dashboard, one CNAME in the Wix DNS zone that holds `birdview.hk`.

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Static app (`/immersive/`) + `/api/decide` | Render web service `flow-with-mind`, `scripts/serve_worlds.py --bind 0.0.0.0` | one process, no database, no pip dependencies |
| JEV key | Render → Environment → `TYPESAFE_API_KEY` | never in the repo, never sent to the browser |
| Door | off: no `FLOW_PASSCODE` in Render → Environment (Bird's choice, 2026-11-02) | the address is enough; set `FLOW_PASSCODE` to put the door back (typed at `/`, or carried by `?k=<value>`) |
| Domain | Wix DNS: CNAME `flow` → `flow-with-mind.onrender.com` | TLS is issued by Render once the CNAME resolves |
| Static mirror without JEV | GitHub Pages, `https://birduts.github.io/psychedelic-experience/immersive/` | unchanged; shows `JEV OFFLINE` |
| Local run | `start-flow.command` or `scripts/start-flow.sh` | loopback, no gate, key from the AI Lab `.env` |

## JEV starts on when hosted

On an HTTPS page the app sends one empty `POST /api/decide` at load; the hosted server answers 400 (GitHub Pages
405, outside the gate 403, no server at all nothing), and only the 400 switches JEV on by itself, so a guest never
has to find the switch in the drawer. Locally (http) the switch stays off as before. Pushes that touch only `docs/`,
`tests/` or Markdown do not redeploy (`buildFilter` in `render.yaml`), because each deploy takes the free instance
down for a minute or two.

## What a guest sees

Since v3.7 the page is the quiet glass: one line to begin, captions, no buttons. The dashboard is at
`https://flow.birdview.hk/immersive/?dev` for checking the engine (same cookie). Notes in `docs/flow-with-mind-playtest.md`.

## The gate

`FLOW_PASSCODE` set → every request needs the cookie that one of two doors plants: the passcode door, or
`?k=<token>` on the URL. Anything without it answers 403 with the door page (`Flow with Mind`, one field `密碼`,
one button `進入`, nothing else); `/api/decide` answers 403 JSON. The door POSTs the code to `/enter`; a correct code
answers 302 to `/immersive/`, a wrong one the door again with `密碼不對。`. A correct `?k=` answers 302 to the same
path without the token (or to `/immersive/` from `/`). Both set `flow_invite` (HttpOnly, SameSite=Lax, Secure
behind the TLS proxy, one year). The cookie value is an HMAC of the token, not the token, so a leaked cookie does
not hand out the passcode. The door brakes: five wrong tries from one address (first `X-Forwarded-For` behind
Render's proxy) or thirty from everyone together lock it for a minute, with `試得太多，稍後再試。` even for the right
code. That makes a four-digit code a latch against passers-by and crawlers, not a lock against someone patient.
`FLOW_PASSCODE` unset → no door at all; anyone with the address is in. That is the live state since the evening of
2026-11-02: Bird first asked for a four-digit code instead of the long invite token (typing it on a headset keyboard
is not workable), then, when his Render edit did not take, for no passcode at all. The variable was renamed from
`FLOW_INVITE` at that point so the site opened on deploy without another dashboard edit; a leftover `FLOW_INVITE` in
Render is ignored and can be deleted. A guest's phone or laptop
therefore opens the link once and is remembered for a year; the token never has to be typed.

`ALLOWED_HOSTS` set → requests whose `Host` is not listed (plus Render's own `RENDER_EXTERNAL_HOSTNAME`) answer 403.
Without `PORT`/`--bind 0.0.0.0` the server listens on loopback only and refuses to start on a public interface unless
both variables are present. All responses carry `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`,
and `Strict-Transport-Security` behind HTTPS.

## Setting it up (once, about fifteen minutes)

1. Merge this change into `main` (the Blueprint is read from the default branch).
2. Render dashboard → **New → Blueprint** → connect GitHub if asked → pick `BirdUTS/psychedelic-experience`.
   Render shows the service from `render.yaml` and asks for `TYPESAFE_API_KEY`: paste the TypeSafe key. Apply.
   The plan is `free` for now (sleeps after 15 min idle, wakes in 20–60 s). Once a card is on the Render account,
   change `plan: free` to `plan: starter` in `render.yaml` and push; the Blueprint syncs it and the service stays warm.
3. When the first deploy is live, open the service → **Settings → Custom Domains → Add** `flow.birdview.hk`.
   Render shows the CNAME target (`flow-with-mind.onrender.com`; if Render had to suffix the name, use what it shows
   and add that hostname to `ALLOWED_HOSTS` in Environment).
4. Wix → Domains → `birdview.hk` → DNS records → add **CNAME**, host `flow`, value from step 3, TTL default.
   Same as the existing `story` record. Render verifies and issues the certificate within minutes.
5. Nothing else: the site is open. To put a door up, Service → **Environment** → add `FLOW_PASSCODE` (four digits
   is what Bird wanted), then tell guests the code or send `https://flow.birdview.hk/?k=<the code>`.
6. Open the site once yourself: the HUD should show `JEV` (not `JEV OFFLINE`) after the first decision.

To change or drop the passcode: Environment → `FLOW_PASSCODE` → edit or delete → save (Render redeploys, a minute
or two down). Every cookie stops working at once, so every device meets the door again, including your own. To take the site down: suspend the service in Render; the GitHub Pages mirror keeps working without JEV.

## Done on 2026-11-01

Live: `https://flow.birdview.hk/` answers the 403 gate page (the door since 2026-11-02) with `nosniff`, `no-referrer` and HSTS from
`SimpleHTTP/0.6 Python/3.14.8` on Render; certificate issued by Google Trust Services (valid to 2027-01-30);
`https://flow-with-mind.onrender.com/` answers the same. Service `flow-with-mind` (srv-dbjhehu7bikc73ffgfb0), free plan,
Blueprint synced from `main`. The Hobby workspace includes two custom domains and `story.birdview.hk` and
`kuji.birdview.hk` held both, so `kuji.birdview.hk` was removed from the `kuji` service (which stays reachable at
`kuji-vn4l.onrender.com`; its Wix CNAME was left in place). Adding it back, or moving to Starter, needs a card on the
Render account.

## Checks

`python3 -m unittest scripts/test_serve_worlds.py` covers the gate, the host check, the cookie flags and the
start-up refusal. A local rehearsal of the hosted mode:

```bash
ALLOWED_HOSTS=localhost:8766 FLOW_PASSCODE=rehearsal python3 scripts/serve_worlds.py --bind 0.0.0.0
```

then `http://localhost:8766/?k=rehearsal` opens the app and `http://localhost:8766/immersive/` in a private window
answers the door; type `rehearsal` there. `.claude/launch.json` has a `door` entry (port 8767, code `1111`) for the
browser pane. A stale service worker from an earlier local run on the same port will serve the cached app and never
show the door; unregister it (DevTools → Application) if the door does not appear.

`https://flow.birdview.hk/api/decide` opened in a browser (same cookie) is a status page, added 2026-11-02 after a
GET there showed a bare 404: it says whether the key is set, asks JEV one real question (「慢一點，太快了」) and shows the
answer and the time taken; 200 when healthy, 503 otherwise. The app itself only ever POSTs to that path.

## Not in Stage 1

The phone page (`/genie`), rooms and pairing, the caption-only glass, and `/api/wish` belong to Stage 2 of
`docs/superpowers/specs/2026-11-01-flow-v4-voice-first-proposal.md`. Wrong `?k=` links are not throttled (a wrong
token only costs a 403); the door is, see above.
