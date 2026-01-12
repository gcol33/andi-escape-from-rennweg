# Game Flow - Simplified

```mermaid
flowchart TD
    classDef startNode fill:#4CAF50,stroke:#2E7D32,color:#fff
    classDef endNode fill:#f44336,stroke:#c62828,color:#fff
    classDef hubNode fill:#9C27B0,stroke:#6A1B9A,color:#fff
    classDef battleNode fill:#FF9800,stroke:#EF6C00,color:#fff

    start([START]):::startNode

    start --> cat1[Cat Scene 1]
    cat1 --> charlie[Charlie]

    charlie --> |"Side quest"| gis[GIS Scene]
    gis --> gis_end([GIS Ending]):::endNode

    charlie --> |"Main path"| jk_r1[Floor 4]

    jk_r1 --> lisa[LISA]
    lisa --> adrian[ADRIAN]
    adrian --> |"🎓 Smile"| didi[DIDI]

    lisa --> hallway[Hallway]
    hallway --> |"📦 Kitchen items"| hallway_ws[Whitespace]
    hallway --> hallway_ws
    hallway --> hallway_bug["🐛 Bug (beetle)"] --> adrian
    hallway_ws --> joni[JONI]
    joni --> |"📦 Lighter"| smoking[Smokers' Corner] --> jen
    joni --> anna{{ANNA}}

    lisa --> moritz[MORITZ]
    moritz --> quiz1{Quiz}
    quiz1 --> |Fail| quiz_fail1([Quiz Fail]):::endNode
    quiz1 --> |"Pass<br>📦 Flora Book"| jen[JEN]

    jen --> squirrel{Squirrel?}
    squirrel --> |"Bad"| squirrel_end([Police End]):::endNode
    squirrel --> |"Good<br>🔒 Snacks<br>🎓 Rooftop Discovery"| agnes_path[To AGNES]

    didi --> agnes_path
    agnes_path --> agnes{{AGNES}}:::battleNode
    agnes --> |Lose| agnes_defeat([Defeat]):::endNode
    agnes --> |Win| stairs1

    stairs1[Stairs 1]:::hubNode

    stairs1 --> stefan{{STEFAN}}:::battleNode
    stefan --> |Lose| stefan_defeat([Defeat]):::endNode
    stefan --> |Win| cat3[Cat Scene 3]

    stairs1 --> wolfgang[WOLFGANG]
    wolfgang --> cellar[Cellar]
    cellar --> dnd{{D&D Group}}:::battleNode
    dnd --> |Lose| dnd_defeat([Defeat]):::endNode
    dnd --> |"Win 📦 Beer"| stairs0

    stairs1 --> franz[FRANZ]
    franz --> tarot[Tarot]
    tarot --> stairs0

    cat3 --> billa[Billa]
    billa --> |"📦 Charcoal"| siegrun[SIEGRUN]
    siegrun --> quiz2{Quiz}
    quiz2 --> |Fail| quiz_fail2([Quiz Fail]):::endNode
    quiz2 --> |"Pass<br>🎓 Floristic Knowledge"| elevator

    stairs0[Stairs 0]:::hubNode

    stairs0 --> jacq[JACQUELINE]
    jacq --> |"Leave"| early_exit([Early Exit]):::endNode
    jacq --> elevator

    elevator[Elevator]

    anna:::battleNode
    anna --> |Lose| anna_defeat([Defeat]):::endNode
    anna --> |"Win<br>📦 Snacks"| stairs0

    elevator --> michi{{MICHI}}:::battleNode
    michi --> |Lose| michi_defeat([Defeat]):::endNode
    michi --> |"Win<br>📦 Magnifying Glass"| emma[EMMA]
    emma --> elevator

    elevator --> |"🔒 Rooftop Discovery"| cat4[Cat Scene 4]
    cat4 --> rooftop[Rooftop]

    rooftop --> |"🔒 !Smile"| nosmile([No Smile]):::endNode
    rooftop --> |"🔒 Smile"| bbq1[BBQ]

    bbq1 --> |"Missing items"| bbq_fail([BBQ Fail x7]):::endNode
    bbq1 --> |"All items"| win([WIN!]):::startNode
```

## Legend

📦 = Item | 🎓 = Skill | 🔒 = Requires

## BBQ Requirements

**Items:** Flora Book, Charcoal, Lighter, Beer, Magnifying Glass

**Skills:** Smile, Floristic Knowledge, Rooftop Discovery

**Key Chains (multi-run):**
- Lighter: LISA → Hallway → JONI → Smokers' Corner
- Snacks: LISA → Hallway → JONI → ANNA (win) → use at JEN for 🎓 Rooftop Discovery
