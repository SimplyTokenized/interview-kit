# @simplytokenized/interview-kit

The rules that decide **what a generated contract actually contains**.

## Why this exists

The same decision is made twice in the pipeline. The network manager runs it so
a lawyer can proofread a template; the backend runs it when a tenant generates
the document. If those two ever disagree, a lawyer approves one document and a
client receives a different one — and nothing reports it, because both sides
produce a complete, plausible-looking contract.

That is not a risk you manage with care. It is one you remove by having a single
implementation, which is this package.

## Plain JavaScript, hand-written types

Deliberate, and copied from `@simplytokenized/document-editor` for the same
reason: the two consumers are a TypeScript/Vite frontend and a plain-ESM Node
backend bundled by esbuild. A TypeScript source package would need a build step
before the backend could import it, which means a compiled artefact that can be
stale — exactly the drift this package exists to prevent. JS + `index.d.ts`
means both consumers read the same file, with no step in between.

## No DOM

The transforms are string scanners. A DOM implementation on one side and a regex
implementation on the other eventually disagree about nesting, and they disagree
silently. Keeping to strings means both sides can run the same code, and it runs
in plain `node --test` with no DOM library.

## Conformance

`src/fixtures/golden.json` is the shared truth: definition + facts + expected
output. Both repositories run it. A change to the rules that is not reflected
there is a change one side has made alone.
