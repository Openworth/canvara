---
name: Visual Notes Stress Tests
overview: Create a comprehensive collection of stress test notes for the Visual Notes feature, including realistic messy student notes alongside structured technical content to verify the AI visualization handles diverse, unorganized input correctly.
todos:
  - id: copy-tests
    content: Copy all stress test notes to test-visual-notes.txt for easy access
    status: pending
  - id: test-messy
    content: Test unorganized student notes in Visual Notes modal
    status: pending
  - id: test-structured
    content: Test structured technical notes for comparison
    status: pending
---

# Visual Notes Stress Test Content

After reviewing the Visual Notes feature implementation in [`VisualNotesModal.vue`](client/src/components/modals/VisualNotesModal.vue) and [`visualize.ts`](server/src/routes/visualize.ts), here are comprehensive stress test notes including realistic unorganized student notes.

---

## Unorganized Student Notes

### 1. Messy Lecture Notes - Psychology 101

```
psych 101 - oct 15

memory types
- sensory (super short like <1 sec)
- short term / working memory - 7 +/- 2 items (miller's law??)
- long term
  - explicit (declarative) - facts & events
    - semantic = general knowledge
    - episodic = personal experiences
  - implicit (procedural) - how to do stuff, riding bike etc

encoding strategies
  - chunking!! (phone numbers)
  - elaborative rehearsal > maintenance rehearsal
  - method of loci - memory palace thing
  - spacing effect - dont cram lol

forgetting
  decay theory vs interference theory
  proactive = old stuff messes w new
  retroactive = new messes w old
  
*EXAM QUESTION* - what's the difference between anterograde and retrograde amnesia??
  antero = cant form NEW memories (like memento guy)
  retro = lose OLD memories

hippocampus = super important for memory consolidation
  - HM patient - removed hippocampus, couldnt make new memories but remembered old stuff

TODO: reread ch 7, do practice quiz
```

---

### 2. Chaotic Biology Study Notes

```
BIO 201 FINAL REVIEW omg

DNA replication
  - semiconservative (meselson-stahl proved it)
  - 5' to 3' direction ONLY
  - leading strand = continuous
  - lagging strand = okazaki fragments, needs ligase
  - helicase unwinds, primase makes RNA primer, DNA pol III extends
  - topoisomerase prevents supercoiling

wait is it pol I or pol III that does the main synthesis?? 
  → pol III does main, pol I replaces primers

TRANSCRIPTION
  promoter → TATA box (eukaryotes)
  RNA polymerase
  template strand read 3'→5'
  mRNA made 5'→3'

mRNA processing (eukaryotes only!!!)
  - 5' cap (7-methylguanosine)
  - 3' poly-A tail
  - splicing - introns OUT, exons stay
  - "exons are expressed"

translation
  ribosomes (80S eukaryotes, 70S prokaryotes)
  tRNA brings amino acids
  anticodon pairs w codon
  A site P site E site
  start codon = AUG (methionine)
  stop codons = UAA UAG UGA ("U Are Annoying" "U Are Gone" "U Go Away")

gene regulation
  lac operon - 
    - repressor normally blocks
    - lactose → allolactose binds repressor → falls off → transcription happens
    - glucose present = no cAMP = CAP doesnt bind = low transcription
  
  eukaryotes way more complicated
    - enhancers, silencers, transcription factors
    - chromatin remodeling
    - methylation = usually OFF
    - acetylation = usually ON

DONT FORGET: central dogma = DNA → RNA → protein
  (except retroviruses go backwards RNA→DNA)
```

---

### 3. Rushed Econ Notes

```
econ 102 supply demand stuff

P↑ → Qd↓ (law of demand)
P↑ → Qs↑ (law of supply)

equilibrium where curves cross

shifts vs movements
  - price change = MOVEMENT along curve
  - other factors = SHIFT the whole curve

demand shifters (TRIBE? idk)
  - tastes/preferences
  - related goods (subs & complements)
  - income (normal vs inferior goods)
  - buyers (# of)
  - expectations

supply shifters
  - input costs
  - technology
  - # of sellers
  - expectations
  - govt policies (taxes, subsidies)

elasticity
  Ed = %ΔQd / %ΔP
  if |Ed| > 1 → elastic
  if |Ed| < 1 → inelastic
  if |Ed| = 1 → unit elastic

perfectly inelastic = vertical line (like insulin)
perfectly elastic = horizontal line

total revenue test
  - P↑ and TR↑ → inelastic
  - P↑ and TR↓ → elastic

price ceiling below eq → shortage (rent control)
price floor above eq → surplus (min wage)

consumer surplus = area below demand above price
producer surplus = area above supply below price

deadweight loss = inefficiency, triangle of sadness lol

market failures next week - externalities, public goods, etc
```

---

### 4. Late Night CS Cramming Notes

```
CS 201 - data structures final

BIG O CHEAT SHEET

arrays
  - access O(1)
  - search O(n)
  - insert O(n) bc shifting
  - delete O(n)

linked list
  - access O(n) 
  - search O(n)
  - insert O(1) if at head
  - delete O(1) if have reference

hash table
  - everything O(1) average
  - O(n) worst case (collisions)
  - collision handling: chaining vs open addressing

binary search tree
  - balanced: O(log n) everything
  - unbalanced/degenerate: O(n) basically a linked list

heap
  - insert O(log n)
  - extract min/max O(log n)
  - peek O(1)
  - heapify O(n) not O(n log n)!!!!

graphs
  - adjacency list vs matrix
  - list better for sparse, matrix for dense
  - BFS = queue, level by level (shortest path unweighted)
  - DFS = stack/recursion, go deep first

sorting
  bubble O(n²) - just no
  insertion O(n²) - ok for small/nearly sorted
  merge O(n log n) - stable, extra space
  quick O(n log n) avg, O(n²) worst - in place tho
  heap O(n log n) - in place, not stable

STABLE = equal elements keep relative order

trees
  - binary tree: max 2 children
  - BST: left < root < right
  - AVL: self balancing BST, rotations
  - B-tree: for databases, many keys per node

when to use what??
  - fast lookup by key → hash table
  - sorted order needed → BST or sorted array
  - priority queue → heap
  - FIFO → queue
  - LIFO → stack

recursion vs iteration
  - recursion uses call stack
  - can cause stack overflow
  - tail recursion can be optimized
```

---

### 5. Philosophy Class Braindump

```
PHIL 220 - ethics midterm review

3 main ethical theories

1) CONSEQUENTIALISM (utilitarianism)
   - actions judged by outcomes/consequences
   - bentham & mill
   - "greatest good for greatest number"
   - act vs rule utilitarianism
   
   problems:
   - cant predict all consequences
   - what about rights? could justify bad things for "greater good"
   - hard to measure happiness/utility
   - ignores intentions

2) DEONTOLOGY (kant)
   - duty-based ethics
   - categorical imperative:
     1. universalizability - could everyone do this?
     2. treat people as ends, never merely as means
   - intentions matter, not just outcomes
   
   problems:
   - what if duties conflict?
   - too rigid? lying to save someone's life still wrong??
   - how do we know our duties?

3) VIRTUE ETHICS (aristotle)
   - character-based
   - develop virtues through practice/habit
   - eudaimonia = flourishing/happiness as goal
   - virtues: courage, temperance, justice, wisdom
   - "what would a virtuous person do?"
   
   problems:
   - vague, doesn't give specific answers
   - cultural differences in virtues
   - how to handle moral dilemmas?

trolley problem
  - pull lever to save 5, kill 1?
  - utilitarians say yes (5>1)
  - kant maybe says no (using person as means)
  
  fat man variant - push someone to stop trolley?
  - why does this feel different if numbers same?
  - intention vs foresight (doctrine of double effect)

moral relativism vs objectivism
  - are morals just cultural? or universal truths?
  - problems with relativism: cant criticize other cultures, inconsistent

ESSAY QUESTION PREP: compare kant and mill on lying
  - kant: never lie, even to murderer asking where friend is
  - mill: lie if consequences are better
  - my take: rule util maybe? "generally dont lie" as a rule
```

---

### 6. History Lecture Scribbles

```
HIST 150 - french revolution stuff

ancien regime problems
  - 3 estates
    1st = clergy (0.5%, no taxes, tons of land)
    2nd = nobles (1.5%, barely taxed)  
    3rd = everyone else (98%, paid all the taxes)
  - king louis XVI - weak, indecisive
  - marie antoinette - austrian, hated, "let them eat cake" (prob never said it)
  - DEBT from american revolution + wars + versailles spending

1789 big year
  - estates general called (first time since 1614!)
  - 3rd estate locked out → tennis court oath
  - national assembly formed
  - july 14 - BASTILLE stormed (only like 7 prisoners lol but symbolic)
  - great fear - peasants attack chateaux
  - aug 4 - feudal privileges abolished
  - declaration of rights of man (liberté égalité fraternité)
  - women's march to versailles - brought king back to paris

phases
  1. constitutional monarchy (1789-92)
     - flight to varennes (king tried to escape, caught)
  2. radical phase (1792-94)
     - republic declared
     - king executed jan 1793
     - committee of public safety
     - REIGN OF TERROR - robespierre
       - 17,000 guillotined officially, maybe 40k total
     - thermidorian reaction - robespierre executed
  3. directory (1795-99) 
     - corrupt, weak
  4. napoleon takes over 1799

legacy
  - end of absolute monarchy (eventually)
  - nationalism
  - spread of revolutionary ideals
  - but also: shows revolution can go wrong (terror)

compare to american rev next class
```

---

## Structured Technical Notes (Previously Included)

### 7. System Architecture - Microservices

```
E-Commerce Platform Architecture

API Gateway
  - Authentication
  - Rate limiting
  - Request routing

User Service → connects to: Auth Service, Notification Service
Order Service → connects to: Inventory, Payment, User Service
Inventory Service → connects to: Notification Service

Message Queue (RabbitMQ): Async communication
Databases: PostgreSQL (Users/Orders), MongoDB (Products), Redis (Cache)
```

---

### 8. Biology - Cellular Respiration

```
Cellular Respiration: Glucose → ATP

Glycolysis (Cytoplasm): 1 Glucose → 2 Pyruvate + 2 ATP + 2 NADH
Pyruvate Oxidation: 2 Pyruvate → 2 Acetyl-CoA + 2 NADH
Krebs Cycle: 2 Acetyl-CoA → 6 NADH + 2 FADH2 + 2 ATP
Electron Transport Chain: NADH/FADH2 → 34 ATP

Total: ~36-38 ATP per glucose
```

---

### 9. Edge Case - Special Characters

```
International Catalog
日本語: 抹茶ラテ ¥450
Français: Café crème €3.50
Deutsch: Würstchen €8.90

Math: E=mc², ∫f(x)dx, Σ(1/n²)=π²/6, √(a²+b²)
Emojis: 🍕→Italian 🌮→Mexican 🍜→Japanese
```

---

### 10. Edge Case - Minimal Input

```
Speed vs Quality vs Cost
Pick two.
```

---

## Testing Recommendations

1. **Prioritize messy notes** - These are the most realistic use case
2. **Check abbreviation handling** - Can AI interpret "bc", "w/", "→", etc.?
3. **Verify incomplete thought handling** - Notes with "??" and trailing ideas
4. **Test mixed formatting** - Bullets, dashes, arrows, indentation chaos
5. **Compare outputs** - Same content in messy vs organized format