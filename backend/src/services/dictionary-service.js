const { query } = require("../db");

async function getDictionary() {
  const [entities, synonyms, metrics, relationships, fields] = await Promise.all([
    query("SELECT id, key, label, description FROM entity_definitions ORDER BY id"),
    query(
      `
      SELECT es.id, ed.key AS entity_key, es.synonym_text
      FROM entity_synonyms es
      JOIN entity_definitions ed ON ed.id = es.entity_id
      ORDER BY es.id
      `
    ),
    query(
      `
      SELECT key, label, formula_type, numerator_field, denominator_field, aggregation_default
      FROM metric_definitions
      ORDER BY id
      `
    ),
    query(
      `
      SELECT from_entity, to_entity, join_path, cardinality
      FROM relationship_definitions
      ORDER BY id
      `
    ),
    query(
      `
      SELECT field_key, entity_key, data_type, is_groupable, is_filterable, is_aggregatable
      FROM field_definitions
      ORDER BY id
      `
    )
  ]);

  return {
    entities: entities.rows,
    synonyms: synonyms.rows,
    metrics: metrics.rows,
    relationships: relationships.rows,
    fields: fields.rows
  };
}

module.exports = {
  getDictionary
};
