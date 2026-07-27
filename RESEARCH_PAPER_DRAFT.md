# AI-Powered Natural Language Reporting with Secure SQL Generation

## Abstract

Natural language interfaces are increasingly used to make data systems more accessible to non-technical users. However, allowing a large language model (LLM) to generate raw SQL directly introduces security, correctness, and governance risks. This project presents an AI-powered reporting system that converts a user's natural-language report request into a structured Report Plan, then uses a deterministic backend SQL Builder to generate parameterized PostgreSQL queries. The system relies on a controlled dictionary of entities, fields, metrics, synonyms, and relationships to constrain interpretation. It also applies role-based access control and user scope filters before query execution. The implemented prototype includes a Next.js and Material UI frontend, a Node.js and Express backend, PostgreSQL storage, OpenAI-based structured output generation, query logs, request history, voice input, and an admin dashboard for dictionary management and analytics. The results show that the Report Plan pattern can balance the flexibility of LLM-based interpretation with the safety of traditional backend validation and parameterized SQL generation.

## Keywords

Natural language reporting, large language models, structured outputs, SQL builder, parameterized queries, role-based access control, report plan, PostgreSQL, educational data systems.

## Introduction

Organizations often store operational and analytical data in relational databases, but many end users cannot write SQL or understand the database schema. This creates a dependency on technical staff for routine reports such as attendance summaries, student counts, course-level analysis, or grade-level comparisons. Natural language reporting can reduce this barrier by allowing users to describe what they need in everyday language.

At the same time, database reporting systems must be designed carefully. A direct natural-language-to-SQL approach can produce invalid queries, reference unauthorized fields, expose sensitive data, or create SQL injection risks. These risks are especially important in educational reporting, where users may have different access rights based on school, grade level, course, or teacher assignment.

This project addresses the problem by separating AI interpretation from SQL generation. The LLM does not generate raw SQL. Instead, it generates a schema-constrained Report Plan. The Report Plan describes the user's intent, selected columns, metrics, filters, granularity, sort order, confidence, and possible clarification questions. The backend then validates the plan, applies user scope, and generates SQL through a controlled SQL Builder. This design follows a guarded architecture: the LLM helps understand the request, while deterministic backend code controls the final database query.

OpenAI Structured Outputs support this approach by requiring model responses to follow a developer-provided JSON Schema [1]. OWASP also recommends parameterized queries as a primary defense against SQL injection [2]. The project combines these ideas with role-based authorization principles, which have long been used to manage access through organizational roles [4].

## Methodology

The system was implemented as a full-stack web application. The frontend uses Next.js, React, and Material UI. The backend uses Node.js with Express. PostgreSQL stores authentication data, dictionary records, report plans, query logs, and domain data such as schools, students, teachers, courses, sections, enrollments, and attendance.

The reporting workflow has six main stages.

1. Natural-language input: The user enters or speaks a report request, such as "Show attendance rate by course for grade 9 between 2026-03-01 and 2026-03-31."

2. Dictionary-based planning: The backend sends the user's prompt, dictionary metadata, and user context to the LLM. The dictionary includes allowed entities, fields, metrics, synonyms, and relationships. This helps the model map informal language such as "campus" or "class" to controlled system concepts.

3. Structured Report Plan generation: The LLM returns a JSON object that must match the Report Plan schema. The schema defines fields such as `intent`, `granularity`, `entities`, `columns`, `metrics`, `filters`, `sort`, `limit`, `clarificationQuestion`, and `confidence`. Structured Outputs reduce formatting risk by ensuring that the model response follows the expected schema [1].

4. Validation and normalization: The backend validates the plan with schema rules and checks whether requested columns, filters, metrics, and sort fields are allowed by the dictionary. If a request is unclear, the plan may include a clarification question instead of proceeding directly.

5. User scope enforcement: The system applies role-based access control and scope filters. For example, a teacher can be restricted to a specific school, grade, course, or teacher assignment. This follows the RBAC idea that access should be mediated through defined roles and permissions rather than arbitrary user discretion [4], [5].

6. Deterministic SQL generation and execution: The SQL Builder translates the validated and scoped plan into a PostgreSQL query. The builder uses whitelisted column mappings and parameterized values. PostgreSQL prepared statements and positional parameters such as `$1` and `$2` are standard mechanisms for separating query structure from input values [3]. This project follows the same principle by keeping user-derived values outside the SQL string.

Several supporting features were also implemented. The system stores plan confidence, validation errors, and audit logs for observability. Query logs record execution status, generated SQL, parameters, row counts, and execution time. A request history feature allows users to review and rerun previous report requests. Voice command support transcribes spoken input and places the text into the report request workflow. An admin dashboard supports dictionary management, usage analytics, success metrics, and query log monitoring.

## Results and Discussion

The implemented prototype demonstrates that natural-language reporting can be made safer by inserting a structured planning layer between the LLM and the database. In this architecture, the LLM is used for interpretation, not execution. It identifies intent, entities, fields, filters, metrics, and ambiguity, but the backend remains responsible for validation, authorization, and SQL generation.

One important result is the improved transparency of the reporting process. The Report Plan Panel displays the raw plan, scoped plan, generated SQL, SQL parameters, confidence, validation errors, and audit log. This helps administrators and developers understand how a natural-language request became a query. It also supports debugging when the LLM selects an unsupported field or when a user's scope changes the final result.

Another result is stronger security compared with direct SQL generation. The SQL Builder only accepts known fields and metrics. Unsupported entities, fields, or metrics are rejected instead of being passed to the database. Parameterized query construction also reduces SQL injection risk, aligning with OWASP guidance that parameterized queries are the preferred defense for SQL injection prevention [2]. This is particularly important because LLM outputs may contain unexpected or malformed values even when the JSON structure is valid.

The project also highlights the importance of access control design. User scope is applied after the draft plan is produced and before SQL is executed. This ensures that a user cannot bypass access limits by asking for unauthorized schools, courses, or teachers. During development, multi-scope behavior required careful handling. A simple union of requested and allowed values could broaden access unintentionally, so the scope logic was adjusted to intersect requested filters with allowed scope values. This observation shows that authorization is not only a login problem; it must also be enforced at the query planning and execution level.

The admin dashboard improves maintainability by exposing dictionary records and operational metrics. Because the dictionary controls what the LLM and SQL Builder can understand, dictionary management becomes a central governance function. Adding a new metric such as attendance rate requires not only a label but also a definition and backend SQL mapping. This prevents the system from treating vague or unsupported terms as valid queries.

There are still limitations. First, the prototype depends on the quality of dictionary coverage. If users request fields such as bus route, parent engagement score, or discipline referral rate, the system cannot answer unless those concepts exist in the dictionary and SQL mapping. Second, the LLM can still misunderstand user intent even when the output follows the schema. Structured Outputs improve format reliability, but they do not guarantee semantic correctness [1]. Third, production readiness requires stronger login protection, stronger secret management, OpenAI timeout and retry handling, and more complete audit policies.

Overall, the project shows a practical pattern for enterprise reporting systems: use AI to transform ambiguous human language into a controlled intermediate representation, then use deterministic software to enforce policy and execute queries. This approach preserves the user experience benefit of natural language while reducing the risks of unmanaged AI-generated SQL.

## Conclusion

This project designed and implemented an AI-powered reporting system for educational data workflows. The main contribution is the use of a Report Plan as a secure intermediate layer between natural-language input and SQL execution. The LLM generates a schema-compliant plan, while the backend validates the plan, applies user scope, and produces parameterized SQL through a whitelist-based SQL Builder.

The prototype confirms that this architecture can support natural-language report requests, role-based access restrictions, query observability, and admin-managed dictionary governance. It also demonstrates that security controls must be applied across the full workflow, from authentication and scope enforcement to SQL generation and query logging. Future work should focus on production hardening, stronger authentication protections, export and scheduling features, improved analytics, and broader dictionary coverage.

## References

[1] OpenAI. "Structured model outputs." OpenAI API Documentation. https://platform.openai.com/docs/guides/structured-outputs

[2] OWASP Foundation. "Query Parameterization Cheat Sheet." OWASP Cheat Sheet Series. https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html

[3] PostgreSQL Global Development Group. "PREPARE - prepare a statement for execution." PostgreSQL Documentation. https://www.postgresql.org/docs/current/sql-prepare.html

[4] D. F. Ferraiolo and D. R. Kuhn. "Role-Based Access Controls." National Institute of Standards and Technology, 1992. https://www.nist.gov/publications/role-based-access-controls

[5] R. Sandhu, D. F. Ferraiolo, and D. R. Kuhn. "The NIST Model for Role-Based Access Control: Towards a Unified Standard." National Institute of Standards and Technology, 2000. https://www.nist.gov/publications/nist-model-role-based-access-control-towards-unified-standard
