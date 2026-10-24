# Are.na Merge

![Are.na logos, merging](../docs/arena-merge.png)

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-merge.html)**

Add every block from one channel into another in one go. For tidying up your own channels.

**What it does:**
- Walks you through connecting, picking a source channel, picking a destination, and setting options
- Optional dry run, so you can see what would happen first
- Optional **Remove blocks from source after merging**, to make it a move rather than a copy. Blocks that were already in the destination are removed from the source too, so the source ends up empty
- Optional **Quiet mode**, which sets the destination to private while a full merge runs, then puts its status back. A dry run never changes it
- Needs a personal access token with **write** access. The token stays in your browser

The tool has a "How the merge works" panel that explains exactly what each option does.

**Worth knowing:** quiet mode is new. After a full merge, check that the destination's privacy is back to what it was. See `NOTES.md` for the open question about restoring it reliably.

## Building

Built from `src/` by the same small Node script as the other newer tools, into a single HTML file.

```bash
npm install                            # once
node arena-merge/build.js --docs       # src/ → arena-merge/dist/arena-merge.html, and copies it to docs/
npm test
```

Agent notes, open work and decisions are in [`NOTES.md`](NOTES.md).
