---
id: demo_use_key
bg: hallway_dim.jpg
music: spooky.mp3
remove_items:
  - Secret Key
---

**Secret Key Used!**

You insert the Secret Key into a hidden panel. It clicks open!

The key crumbles to dust after use (removed from inventory).

---

This demonstrates **require_items** (choice only appeared because you had the key) and **remove_items** (scene removes item on entry).

### Choices

- Interesting! [sfx: click.ogg] → demo_inventory
