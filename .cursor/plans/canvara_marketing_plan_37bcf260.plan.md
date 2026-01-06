---
name: Canvara Marketing Plan
overview: A guerrilla marketing strategy to acquire users for Canvara through community engagement, viral mechanics, content marketing, and strategic positioning - all with minimal to zero budget.
todos:
  - id: watermark
    content: Add 'Made with Canvara' watermark to free PNG/SVG exports
    status: pending
  - id: templates
    content: Create 5-10 viral-worthy templates (Lean Canvas, Sprint Retro, etc.)
    status: pending
  - id: product-hunt
    content: Prepare Product Hunt launch assets (GIFs, description, maker story)
    status: pending
  - id: share-message
    content: Add 'Copy invite message' feature to share modal
    status: pending
  - id: landing-seo
    content: Create SEO landing pages targeting 'Excalidraw alternative' keywords
    status: pending
---

# Canvara Guerrilla Marketing Plan

## Product Overview

Canvara is a collaborative whiteboard with real-time collaboration, infinite canvas, and hand-drawn style graphics. The freemium model offers local storage for free, with Pro tier ($5/month) for cloud sync.---

## Phase 1: Launch Amplification (Week 1-2)

### Product Hunt Launch (FREE)

**Tagline:** "Real-time collaborative whiteboard with that hand-drawn feel"**Description:**

```javascript
Canvara is a free collaborative whiteboard for teams who think visually.

Why I built this:
I got tired of paying $10+/month just to sketch ideas with my team. Existing tools were either too complex or too expensive for quick brainstorming.

What makes Canvara different:
- Real-time collaboration - see cursors and edits live
- No signup required - just share a link and start drawing
- Hand-drawn aesthetic - makes diagrams feel human
- Works offline - your data stays in your browser
- Pro tier ($5/mo) adds cloud sync if you need it

Built with Vue 3, WebSockets, and rough.js. Would love your feedback!
```

**First Comment (post immediately):**

```javascript
Hey everyone! Maker here. Happy to answer any questions about the tech stack or roadmap. A few things I'm working on next:
- More export formats
- Template library
- Mobile improvements

What features would you find most useful?
```

---

### Hacker News "Show HN" (FREE)

**Title:** `Show HN: Canvara - Real-time collaborative whiteboard I built with Vue and WebSockets`**Post body:**

```javascript
I built Canvara because I wanted an Excalidraw-like experience with proper real-time collaboration built in from the start.

Tech stack:
- Frontend: Vue 3 + TypeScript + Pinia
- Backend: Node.js + Express + WebSocket (ws library)
- Graphics: HTML5 Canvas + rough.js for the sketchy look
- Database: SQLite (yes, really - it handles the load fine)
- Auth: Google OAuth + JWT
- Payments: Stripe

The real-time sync was the hardest part. I'm using operational transforms for conflict resolution when multiple people edit simultaneously.

Free tier stores everything locally in IndexedDB. Pro ($5/mo) adds cloud sync.

Try it: [URL]
Code walkthrough if anyone's interested in the WebSocket architecture.
```

---

### Reddit Posts (Ready to Use)

**r/SideProject Post:***Title:* `After 3 months of nights and weekends, I launched my collaborative whiteboard app`

```javascript
Hey everyone,

I just launched Canvara - a real-time collaborative whiteboard with that hand-drawn sketch style.

The idea came from frustration with existing tools. Miro is great but expensive. Excalidraw is awesome but collaboration feels bolted on. I wanted something in between.

What I built:
- Infinite canvas with pan/zoom
- Real-time collaboration (see everyone's cursors)
- Hand-drawn aesthetic using rough.js
- No account needed for free tier
- Export to PNG/SVG/JSON

Tech: Vue 3, Node.js, WebSockets, SQLite

Free to use with local storage. $5/mo if you want cloud sync.

Would love feedback from this community - you all have been super helpful during development.

[LINK]
```

---**r/webdev Post:***Title:* `Built a real-time collaborative canvas app - here's what I learned about WebSocket sync`

```javascript
Just shipped a side project I've been working on - a collaborative whiteboard called Canvara.

Some technical challenges I solved that might help others:

1. **Cursor presence** - Broadcasting cursor positions at 60fps kills your server. I throttle to 20fps and interpolate on the client.

2. **Conflict resolution** - When two people move the same shape, last-write-wins is jarring. I ended up with a simple lock system where shapes get "claimed" during drag.

3. **Canvas performance** - Rendering 1000+ rough.js shapes was slow. Solution: dirty rectangle rendering + offscreen canvas caching.

4. **State sync on join** - New collaborators need the full canvas state. I debounce state snapshots and send compressed JSON.

Stack: Vue 3, TypeScript, Node/Express, ws library, rough.js, SQLite.

Happy to dive deeper into any of these if anyone's curious. Link in comments.
```

---**r/productivity Post:***Title:* `Free tool for visual brainstorming with remote teams`

```javascript
Made something that might help folks here who do a lot of remote collaboration.

Canvara is a whiteboard app where you can:
- Draw diagrams, flowcharts, mind maps
- Collaborate in real-time (like Google Docs but for drawing)
- Share a link - no signup required for collaborators
- Works offline, saves to your browser

I use it for:
- Sprint planning with my team
- System design interviews (as interviewer)
- Quick explanations instead of walls of text

It's free. There's a $5/mo tier if you want cloud backup but honestly the free tier does everything.

[LINK]

Not trying to spam - genuinely curious if this solves a problem for anyone else.
```

---**r/RemoteWork Post:***Title:* `Built a free whiteboard for async/sync remote collaboration`

```javascript
Remote worker here. One thing I miss from office life is grabbing a whiteboard to sketch out ideas.

So I built Canvara - a collaborative whiteboard that works like this:
1. Create a board
2. Share the link
3. Everyone can draw together in real-time

No accounts, no downloads, works in browser.

It has that hand-drawn sketch style which I find makes diagrams feel less "corporate" and more approachable.

Been using it with my distributed team for retros and brainstorming. Figured others might find it useful.

[LINK]

Free to use. Feedback welcome.
```

---**r/startups Post:***Title:* `Launched my first SaaS - a collaborative whiteboard. Here's my honest take on the journey.`

```javascript
After 3 months of building, I launched Canvara - a real-time collaborative whiteboard.

Some honest reflections:

**What went well:**
- Solving my own problem (I actually use this daily)
- Keeping scope tiny (it's just a whiteboard, not a project management suite)
- Freemium model feels right - free tier is genuinely useful

**What I underestimated:**
- Real-time sync is HARD
- Marketing a free tool is paradoxically harder than a paid one
- Stripe integration took 3x longer than expected

**Numbers (week 1):**
- ~200 signups
- 3 paid conversions
- $15 MRR lol

Not quitting my day job but it feels good to ship something.

Link if curious: [URL]

Happy to answer questions about the technical or business side.
```

---**r/InterviewPrep Post:***Title:* `Free whiteboard for practicing system design interviews`

```javascript
If you're prepping for system design interviews, having a good whiteboard helps.

I built Canvara for this exact use case. You can:
- Draw architecture diagrams with boxes, arrows, text
- Share a link with your mock interview partner
- See each other's cursors in real-time
- No signup needed

The hand-drawn style actually works well for interviews - feels more like sketching on a real whiteboard.

[LINK]

Totally free. I use it to run mock interviews for friends prepping for FAANG.
```

---

## Phase 2: Viral Mechanics (Ongoing)

### "Made with Canvara" Watermark Strategy

- Add subtle "Made with Canvara" link on free PNG/SVG exports
- Every shared diagram becomes an ad
- Remove watermark for Pro users as an upsell incentive

### Shareable Room Links

The existing share feature is powerful. Amplify it:

- Create a "Copy link + invite message" button that generates text like: "Join my Canvara board: [link] - free collaborative whiteboard"
- Each collab session = organic word-of-mouth

### Template Gallery (FREE to build)

Create viral-worthy templates:

- "Startup Lean Canvas"
- "Weekly Sprint Retrospective"
- "Product Roadmap"
- "User Story Mapping"
- "Interview Whiteboard Problems"

These get shared, bookmarked, and linked to.---

## Phase 3: Content Marketing (FREE)

### Twitter/X Launch Thread

```javascript
I spent 3 months building a real-time collaborative whiteboard.

Today I'm launching Canvara.

Here's why I built it and what I learned (thread)
```
```javascript
1/ The problem:

I needed to sketch ideas with my remote team.

Miro = $10/user/month
FigJam = requires Figma
Excalidraw = great but collab feels limited

I wanted: free, real-time, no friction.

So I built it.
```
```javascript
2/ The stack:

- Vue 3 + TypeScript (fast, typed, enjoyable)
- Node.js + WebSocket for real-time sync
- rough.js for the hand-drawn look
- SQLite (yes, it scales fine for this)
- Stripe for payments

Total infra cost: $5/month on Fly.io
```
```javascript
3/ Hardest problem: real-time sync

When 5 people drag shapes at once, chaos ensues.

My solution:
- Optimistic updates locally
- Shape "locking" during drag
- 20fps cursor broadcast (not 60)
- Compressed state snapshots

It's not perfect but it works.
```
```javascript
4/ The business model:

Free tier: unlimited boards, local storage
Pro ($5/mo): cloud sync across devices

Why freemium? I want people to actually use it.
The free tier is genuinely useful, not crippled.
```
```javascript
5/ What I'd do differently:

- Start with auth earlier (bolted it on late)
- Write more tests (real-time bugs are brutal)
- Launch smaller and iterate

But honestly? Just shipping something felt amazing.
```
```javascript
6/ Try it yourself:

[LINK]

- No signup needed
- Shareable collab links
- Export to PNG/SVG

Would love your feedback. What features would make this useful for you?
```

---

### Twitter/X Daily Posts (Rotation)

**Monday - Feature highlight:**

```javascript
Canvara tip: Hold Space to pan around the canvas without switching tools.

Small detail, big time saver.

[GIF of panning]
```

**Tuesday - Use case:**

```javascript
Used Canvara for a system design mock interview today.

The hand-drawn style makes it feel like a real whiteboard, not a corporate diagram tool.

Free, no signup: [LINK]
```

**Wednesday - Technical insight:**

```javascript
TIL: Broadcasting cursor positions at 60fps to 10 users = 600 messages/second.

Throttle to 20fps + interpolate on client = 200 messages/second and smoother visuals.

Real-time is full of these tradeoffs.
```

**Thursday - Social proof:**

```javascript
Someone used Canvara to run a retro with their team of 8 today.

Watching the cursors all move around in real-time was oddly satisfying.

This is why I built this.
```

**Friday - Diagram of the day:**

```javascript
How JWT authentication actually works:

[Diagram made in Canvara]

Made with Canvara - free collaborative whiteboard: [LINK]
```

---

### Dev.to Article #1

**Title:** `Building Real-Time Collaboration from Scratch with Vue 3 and WebSockets`**Intro:**

```markdown
# Building Real-Time Collaboration from Scratch with Vue 3 and WebSockets

I recently built [Canvara](link), a collaborative whiteboard app. The real-time sync was by far the hardest part.

In this post, I'll share the architecture and gotchas I discovered building multi-user collaboration from scratch.

## The Challenge

When multiple users edit a shared canvas simultaneously, you need to solve:
1. **Presence** - Who's online? Where are their cursors?
2. **Sync** - How do edits propagate to everyone?
3. **Conflicts** - What happens when two people edit the same thing?

Let's tackle each one.

## Architecture Overview

[Include diagram made in Canvara]

...

## Code Walkthrough

Here's the WebSocket handler on the server:

\`\`\`typescript
// Show actual code from your websocket/handler.ts
\`\`\`

...

## Lessons Learned

1. Throttle cursor updates (20fps is plenty)
2. Use optimistic updates for responsiveness
3. Compress state payloads
4. Test with simulated latency

## Try It Yourself

Canvara is free to use: [LINK]

The collaboration features described here power the "Live Session" feature.
```

---

### Dev.to Article #2

**Title:** `From Side Project to SaaS: Shipping a Product in 3 Months`**Intro:**

```markdown
# From Side Project to SaaS: Shipping a Product in 3 Months

I launched my first SaaS product last week. It's a collaborative whiteboard called Canvara.

This isn't a "how I made $10k in week one" post. It's an honest breakdown of building and shipping something real.

## The Idea

I wanted an Excalidraw-style whiteboard with better real-time collaboration. Instead of waiting for someone else to build it, I built it myself.

## The Timeline

- **Month 1:** Core canvas (drawing, selection, zoom)
- **Month 2:** Collaboration (WebSocket sync, presence, rooms)
- **Month 3:** Polish (auth, payments, export, dark mode)

Total: ~200 hours of work

## Tech Decisions I Made

| Decision | Why |
|----------|-----|
| Vue 3 | Composition API is a joy |
| SQLite | Simple, no DevOps |
| Stripe | Industry standard |
| Fly.io | Cheap, easy deploys |

## What I Spent

- Domain: $12
- Fly.io: $5/month
- Stripe: 2.9% + $0.30 per transaction
- **Total first year: ~$72**

## Launch Results (Week 1)

- 200 signups
- 3 paying customers
- $15 MRR

Not life-changing, but real people paying for something I made.

## What I Learned

1. Scope creep is real - I cut 50% of planned features
2. Authentication is never "quick"
3. Marketing is harder than building

## What's Next

- Template gallery
- Mobile improvements
- Maybe open-source the canvas engine

---

Try Canvara: [LINK]
```

---

### YouTube Video Script (5 min)

**Title:** `I Built a Collaborative Whiteboard in 3 Months - Here's How`

```javascript
[HOOK - 0:00]
"What if you could build your own Miro in 3 months? I did exactly that. Let me show you."

[DEMO - 0:15]
[Screen recording: create board, draw shapes, share link, show second browser joining]
"This is Canvara. Real-time collaboration, infinite canvas, that hand-drawn look. And I built the whole thing myself."

[WHY - 0:45]
"I got frustrated with existing tools. Miro is expensive. Excalidraw is great but collaboration felt limited. So I built my own."

[TECH STACK - 1:15]
"Here's what powers it:
- Vue 3 for the frontend
- WebSockets for real-time sync
- rough.js for the sketchy style
- SQLite - yes really
- Hosted on Fly.io for $5/month"

[HARDEST PART - 2:00]
"The hardest part? Real-time sync. When 5 people drag shapes at once..."
[Show code snippets of WebSocket handler]

[BUSINESS MODEL - 3:00]
"It's freemium. Free tier saves locally. $5/month for cloud sync. I'm not trying to get rich - I just want people to use it."

[CALL TO ACTION - 4:00]
"Link in description. It's free, no signup required. Let me know in the comments what features you'd want to see."

[OUTRO - 4:30]
"If you're thinking about building a side project - just start. The tech is the easy part. Shipping is what matters."
```

---

## Phase 4: Community Infiltration (FREE)

### Discord Communities

**Vue.js Discord (#showcase channel):**

```javascript
Hey everyone! Just launched a side project built with Vue 3 + Composition API.

It's a real-time collaborative whiteboard called Canvara. Think Excalidraw but with proper multi-user sync.

Some Vue-specific things I'm proud of:
- Pinia for state management (canvas state + collab state)
- Composables for keyboard shortcuts and touch handling
- TypeScript throughout

Would love feedback from this community - you all helped me learn Vue in the first place.

[LINK]
```

**Indie Hackers Discord:**

```javascript
Launched my first SaaS this week!

Canvara - a collaborative whiteboard app.
- Free tier: local storage
- Pro: $5/mo for cloud sync

Week 1 results: 200 signups, 3 paying users, $15 MRR

Not quitting my job but it feels real. Happy to share what I learned about launching if anyone's curious.

[LINK]
```

---

### Niche Subreddit Posts

**r/DnD or r/battlemaps Post:***Title:* `Free tool for drawing battle maps collaboratively with your party`

```javascript
Hey folks,

I built a collaborative whiteboard that might be useful for DMs and players.

You can:
- Draw maps together in real-time
- No signup - just share a link
- Hand-drawn aesthetic (feels more fantasy than sterile grids)
- Works on any device with a browser

I've been using it to sketch encounter maps with my players during session zero.

[LINK]

It's free. Originally built it for work stuff but realized it works great for TTRPG.
```

---**r/Teachers or r/education Post:***Title:* `Free online whiteboard for classroom use - no student logins required`

```javascript
Fellow teachers,

I built a whiteboard app that might help with remote/hybrid teaching.

Key features for classroom use:
- Share a link - students can join without creating accounts
- See everyone's cursors in real-time
- Works on Chromebooks and tablets
- Hand-drawn style (students seem to like it more than formal diagrams)

I've seen teachers use it for:
- Collaborative brainstorming
- Math problem solving
- Group mind maps

[LINK]

Completely free. I'm a developer, not a teacher, so I'd love feedback on what would make it more useful for classrooms.
```

---**r/Twitch Post:***Title:* `Free collaborative whiteboard for stream interaction`

```javascript
Built something that might be fun for interactive streams.

Canvara is a real-time collaborative whiteboard. You could:
- Let chat join and draw together
- Do collaborative art with viewers
- Play Pictionary-style games
- Brainstorm with your community

Just share the link - no accounts needed to join.

[LINK]

Curious if any streamers find this useful. Would love to see it in action!
```

---**r/cscareerquestions Post:***Title:* `Free whiteboard tool for system design interview practice`

```javascript
For those prepping for system design rounds:

I built Canvara, a collaborative whiteboard specifically good for interview practice.

Why it works for interviews:
- Share a link with your mock partner
- See each other's cursors (like a real interview)
- Hand-drawn style (mimics whiteboard sketching)
- No signup, no download
- Export your diagrams as images for notes

I use it to run mock interviews for friends. The real-time aspect makes it feel closer to an actual interview than async tools.

[LINK]

Free to use. Good luck with your prep!
```

---**LinkedIn Post:**

```javascript
I built and launched my first SaaS product.

It's called Canvara - a real-time collaborative whiteboard.

What I learned:
- Shipping beats perfection
- Real-time sync is harder than it looks
- Marketing a free product is paradoxically harder than a paid one

The tech: Vue 3, Node.js, WebSockets, SQLite
The cost: ~$5/month to run
The result: Something I actually use daily

Try it free: [LINK]

What side project are you working on?
```

---

## Phase 5: SEO & Discoverability (FREE)

### Alternative Positioning

Create landing pages/content targeting:

- "Excalidraw alternative"
- "Free Miro alternative"
- "Collaborative whiteboard free"
- "Online whiteboard no signup"

### GitHub Presence

- Open-source a component or the rough.js integration
- Star and contribute to related projects
- Link to Canvara in your profile

---

## Phase 6: Guerrilla Tactics (Creative/FREE)

### Meme Diagrams for r/ProgrammerHumor

Create these diagrams in Canvara with subtle branding:**Meme 1: "How I explain my job to..."**

```javascript
[Diagram showing:]
- To my mom: "I work with computers"
- To my friends: "I make websites"  
- To recruiters: "Full-stack engineer with 5+ years..."
- To myself at 3am: [chaotic scribbles and question marks]

Made with Canvara
```

**Meme 2: "The senior dev debugging process"**

```javascript
[Flowchart:]
Start -> Check Stack Overflow -> Doesn't work -> Check Stack Overflow again -> Still doesn't work -> Console.log everything -> Find typo -> End

Made with Canvara
```

**Meme 3: "Estimating tickets"**

```javascript
[Chart showing:]
X-axis: Actual complexity
Y-axis: My estimate
[Wildly scattered dots with no correlation]

Made with Canvara
```

---

### Diagram of the Day Templates

**System Design:**

```javascript
Twitter post:
"How Netflix handles 200M+ users streaming at once:

[Diagram showing CDN, microservices, adaptive bitrate]

Made with Canvara - free collaborative whiteboard: [LINK]"
```

**Startup Frameworks:**

```javascript
Twitter post:
"The Lean Canvas in 60 seconds:

[Lean Canvas diagram]

Template available in Canvara: [LINK]"
```

**Architecture Patterns:**

```javascript
Twitter post:
"Event-driven architecture explained simply:

[Diagram: producers -> event bus -> consumers]

Drew this in Canvara - free, no signup: [LINK]"
```

---

### Influencer Outreach Templates

**Email to YouTuber (< 50k subs):**

```javascript
Subject: Free tool for your productivity content

Hi [Name],

I loved your video on [specific video about whiteboard/productivity tools].

I built Canvara, a free collaborative whiteboard with real-time sync. Think Excalidraw meets Google Docs.

Would you be interested in trying it out? Happy to give you lifetime Pro access (cloud sync) in exchange for your honest thoughts - no pressure for a review unless you genuinely find it useful.

Here's a quick demo: [LINK]

Either way, keep making great content.

[Your name]
```

**DM to Twitter creator:**

```javascript
Hey [Name]! Big fan of your threads on [topic].

I built a free collaborative whiteboard called Canvara. Given your content, thought you might find it useful for diagrams/explainers.

No ask - just wanted to share in case it's helpful: [LINK]

Happy to give you Pro access if you want to try cloud sync.
```

---

### Guerrilla Forum Tactics

**Stack Overflow:**When answering questions about system design, architecture, or diagramming, include:

```javascript
Here's a diagram to explain:
[Image made with Canvara]

(Made with Canvara - free whiteboard tool if anyone wants to recreate/modify)
```

**GitHub Discussions:**For repos related to diagramming, collaboration, or Vue:

```javascript
Cool project! I built something similar for collaborative whiteboards: [LINK]

Would love to chat about how you handled [specific technical challenge].
```

---

### Viral Bait Content Ideas

1. **"Draw your startup in 60 seconds" challenge** - Post your own, invite others
2. **"Explain your codebase" trend** - Architecture diagrams as a meme format
3. **"System design any product" series** - Twitter, Uber, Spotify explained in diagrams
4. **"Interview question of the day"** - Draw the solution, share template

---

## Quick Wins Checklist

| Action | Cost | Impact ||--------|------|--------|| Product Hunt launch | Free | High || Hacker News post | Free | High || Add export watermarks | Dev time | Ongoing || 5 Reddit posts | Free | Medium || 3 Dev.to articles | Free | Medium-High || Template gallery | Dev time | High || Twitter thread | Free | Medium || Join 5 Discord servers | Free | Low-Medium |---

## Metrics to Track

- Daily active users (free vs Pro)
- Room creation rate (collaboration adoption)
- Export count (viral potential)
- Referral source (which channels work)
- Free-to-Pro conversion rate

---

## Key Differentiators to Emphasize

1. **Real-time collaboration** - not all competitors have this for free
2. **No account required** for free tier - zero friction
3. **Hand-drawn aesthetic** - appeals to developers and designers
4. **Open shareable links** - anyone can join without signup
5. **Local-first** - privacy-conscious users love this

---