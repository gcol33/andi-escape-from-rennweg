---
id: wake_up
bg: black.svg
music: lost.mp3
actions:
  - type: reset
  - type: wake_sequence
    target: start
    fade_duration: 2500
    wait_duration: 1500
random_flavor:
  # Battle defeats
  - text: "You dreamt of timesheets. Endless timesheets. Each cell demanding justification for your existence."
    requires: agnes
  - text: "You dreamt of giant rodents offering you tea. You politely declined this time."
    requires: anna
  - text: "You dreamt of rolling nothing but natural 1s. Critical failures, all the way down."
    requires: dnd
  - text: "You dreamt of p-values. They were all above 0.05. Your entire existence was not statistically significant."
    requires: johannes
  - text: "You dreamt of regression lines. They all pointed downward. Your R-squared was embarrassingly low."
    requires: karl
  - text: "You dreamt of indentation errors. So many indentation errors. The tabs and spaces were fighting."
    requires: manu
  - text: "You dreamt of flowcharts. Aggressive flowcharts. The arrows were pointing at you accusingly."
    requires: michi
  - text: "You dreamt of server rooms. The blinking lights spelled out 'HELP ME' in binary."
    requires: stefan
  # Other deaths
  - text: "You dreamt you could see in four dimensions. And taste colors. The new color was called 'Regret.'"
    requires: coffee
  - text: "You dreamt of coordinate systems. WGS84 and MGI were having a territorial dispute over your soul."
    requires: gis
  - text: "You dreamt of tiny handcuffs. The squirrel was reading you your rights. You had the right to remain silent about nuts."
    requires: squirrel
  - text: "You dreamt of cats. So many cats. They were blocking every exit. One of them had a clipboard."
    requires: early_exit
  # BBQ endings
  - text: "You dreamt of a desert. An endless, beerless desert. The mirages were all empty bottles."
    requires: bbq_nobeer
  - text: "You dreamt of rubbing sticks together. For hours. The charcoal was laughing at you."
    requires: bbq_nolighter
  - text: "You dreamt of squinting at tiny plant features. Everything was slightly out of focus."
    requires: bbq_nomagglass
  - text: "You dreamt of a plant encyclopedia. It was written in a language you didn't speak. The pictures were blurry."
    requires: bbq_noknowledge
  - text: "You dreamt of empty grills. Cold, judgmental grills. The sausages were weeping."
    requires: bbq_nocharcoal
  - text: "You dreamt of Wolfgang asking about plants. You knew none of their names. They knew yours though."
    requires: bbq_noflora
  - text: "You dreamt of forced smiles. Yours wouldn't cooperate. Your face muscles had filed for resignation."
    requires: bbq_nosmile
  # Quiz endings
  - text: "You dreamt of Latin plant names. They were laughing at you. *Quercus robur* was particularly smug."
    requires: quiz_moritz
  - text: "You dreamt of field equipment. The GPS was mocking you. Even the compass looked disappointed."
    requires: quiz_siegrun
  # Generic fallbacks (no death_flag required)
  - "Was that... a premonition? A warning from the universe?"
  - "What a strange dream. It felt so real..."
  - "Note to self: never eat Leberkäse before bed again."
  - "The alarm clock shows 7:42. Your last day starts now."
  - "You dreamt of bureaucracy. The worst kind of nightmare."
---

