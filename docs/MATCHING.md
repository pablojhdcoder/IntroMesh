# Matching

1. Visible attendees at the same event, with consent.
2. Global and event-context embeddings when ready.
3. Retrieve at most 24 by global embedding similarity (`1 - (embedding <=> query)` in pgvector; dot product if the vector is already normalized).
4. If both sides have a context embedding, it enters the semantic blend: 35% global and 65% contextual.
5. Initial final score is 40% semantic, 25% goal, 20% skill complement, 10% shared interests, and 5% event relevance.
6. If a component is missing, its weights are redistributed among those that exist. Missing context is not punished.
7. At most 8 recommendations for the viewer are stored in `event_match_recommendations`.

Complementarity can sustain a recommendation even without shared interests. Semantic similarity is not treated as compatibility alone: it is one more term.

Changing identity clears recommendations where that person is viewer or candidate. Changing event context only clears that event’s rows. The other side recalculates when that person opens theirs.

Signal Field receives the same object as before. If both multilingual embeddings are ready, the edge weight is the hybrid score. If not, the previous score is kept so the demo room does not change appearance.
