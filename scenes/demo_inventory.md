---
id: demo_inventory
bg: office_kitchen.jpg
music: coffee.mp3
---

**Inventory Demo**

You're in the break room. Your current items are shown in the top-left.

Let's test the inventory system:

- **require_items**: Some choices only appear if you have specific items
- **uses**: Some choices consume items when selected

---

Try the options below. Notice how some choices appear or disappear based on your inventory!

### Choices

- Drink the coffee (uses: Coffee Mug) [sfx: gulp.ogg] → demo_drink_coffee
- Eat the snack (uses: Snack Bar) [sfx: gulp.ogg] → demo_eat_snack
- Use the Secret Key (require_items: Secret Key) [sfx: click.ogg] → demo_use_key
- Find more items [sfx: footstep.ogg] → demo_find_items
- Go back [sfx: footstep.ogg] → demo_start
