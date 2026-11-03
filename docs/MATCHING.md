# Matching

How Discover reads neighbors lives in [`FLOW.md`](FLOW.md) §3. This file is the hybrid score and its persistence on the write path.

1. Visible attendees at the same event, with consent (joined, consented, discoverable participation plus live presence).
2. Global and event-context embeddings when ready. Inline `after()` processing after confirm/join is the writer; the worker scripts are backfill/retry tools only.
3. Retrieve at most 24 by global embedding similarity (`1 - (embedding <=> query)` in pgvector; dot product if the vector is already normalized).
4. If both sides have a context embedding, it enters the semantic blend: 35% global and 65% contextual.
5. Initial final score is 40% semantic, 25% goal, 20% skill complement, 10% shared interests, and 5% event relevance.
6. If a component is missing, its weights are redistributed among those that exist. Missing context is not punished.
7. At most 8 recommendations per viewer are stored in `event_match_recommendations`, with evidence labels (shared goals/interests/skills, complements) persisted on the row.

Complementarity can sustain a recommendation even without shared interests. Semantic similarity is not treated as compatibility alone: it is one more term.

Changing identity clears recommendations where that person is viewer or candidate. Changing event context only clears that event’s rows. The other side recalculates when that person’s embedding completes in the worker.

Discovery and affinity never read vectors: discovery serves the persisted rows at deterministic layout positions, and affinity explains one persisted row after grounding its stored labels.
