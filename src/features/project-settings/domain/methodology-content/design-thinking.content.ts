import type { MethodologyContent } from "./types";

/**
 * Design Thinking (IDEO / Stanford d.school — 1990s–2000s).
 * 5 fases: Empatizar, Definir, Idear, Prototipar, Probar.
 */
export const DESIGN_THINKING_CONTENT: MethodologyContent = {
  key: "design_thinking",
  name: "Design Thinking",
  emoji: "🎨",
  tagline: "Proceso de innovación centrado en el humano.",
  source: "IDEO / Stanford d.school — 1990s–2000s",
  sections: [
    {
      kind: "phase",
      title: "Fase 1 — Empatizar",
      order: 1,
      items: [
        {
          key: "empathy_map",
          name: "Mapa de Empatía",
          description:
            "Comprende al usuario desde 4 cuadrantes + dolores y ganancias.",
          prompts: [
            "¿Qué piensa y siente?",
            "¿Qué escucha?",
            "¿Qué ve?",
            "¿Qué dice y hace?",
            "Dolores",
            "Ganancias",
          ],
        },
        {
          key: "csd_matrix",
          name: "Matriz CSD",
          description: "Separa certezas, suposiciones y dudas del proyecto.",
          prompts: ["Certezas", "Suposiciones", "Dudas"],
        },
        {
          key: "buyer_persona",
          name: "Buyer Persona / Perfil de Usuario",
          description: "Representación semi-ficticia de tu usuario ideal.",
        },
        {
          key: "customer_journey",
          name: "Mapa de Viaje del Cliente",
          description: "Visualiza la experiencia end-to-end del usuario.",
        },
        { key: "moodboard", name: "Moodboard", description: "Collage visual de referencias y tono." },
        {
          key: "interview_guide",
          name: "Guía de Entrevista de Usuario",
          description: "Script estructurado para entrevistas cualitativas.",
        },
        {
          key: "contextual_inquiry",
          name: "Observación Contextual (Contextual Inquiry)",
          description: "Observar al usuario en su entorno real.",
        },
        {
          key: "five_whys",
          name: "Los 5 Por Qués (5 Whys)",
          description: "Llega a la causa raíz preguntando '¿por qué?' 5 veces.",
        },
      ],
    },
    {
      kind: "phase",
      title: "Fase 2 — Definir",
      order: 2,
      items: [
        {
          key: "pov_statement",
          name: "Declaración POV",
          description: "Sintetiza el problema del usuario en una frase accionable.",
          prompts: [
            "[Usuario] necesita [necesidad] porque [insight]",
          ],
        },
        {
          key: "hmw_questions",
          name: "Preguntas HMW (How Might We)",
          description: "Reformula problemas en oportunidades de diseño.",
        },
        {
          key: "statement_starters",
          name: "Iniciadores de Declaración (Statement Starters)",
          description: "Arranca frases con foco en el usuario.",
        },
        {
          key: "stakeholder_map",
          name: "Mapa de Stakeholders",
          description: "Identifica y prioriza actores clave del ecosistema.",
        },
        {
          key: "refined_journey_map",
          name: "Mapa de Viaje Refinado (Journey Map)",
          description: "Versión consolidada del journey con insights.",
        },
        {
          key: "abstract_laddering",
          name: "Escalera Abstracta (Abstract Laddering)",
          description: "Sube y baja entre lo abstracto y lo concreto.",
        },
        {
          key: "affinity_clustering",
          name: "Clustering de Afinidad (Affinity Clustering)",
          description: "Agrupa notas/insights por temas emergentes.",
        },
        {
          key: "said_did_thought_felt",
          name: "Dijo, Hizo, Pensó, Sintió",
          description: "Decodifica el comportamiento observado.",
        },
      ],
    },
    {
      kind: "phase",
      title: "Fase 3 — Idear",
      order: 3,
      items: [
        {
          key: "crazy_8s",
          name: "Crazy 8s",
          description: "8 ideas en 8 minutos: divergencia rápida.",
        },
        {
          key: "round_robin",
          name: "Round Robin",
          description: "Cada persona aporta una idea en ronda, sin filtros.",
        },
        {
          key: "creative_matrix",
          name: "Matriz Creativa (Creative Matrix)",
          description: "Cruza categorías para generar soluciones híbridas.",
        },
        {
          key: "importance_difficulty_matrix",
          name: "Matriz de Importancia / Dificultad",
          description: "Prioriza ideas por valor vs. esfuerzo.",
        },
        {
          key: "concept_poster",
          name: "Póster de Concepto (Concept Poster)",
          description: "Comunica una idea en un formato visual único.",
        },
        {
          key: "dot_voting",
          name: "Votación por Puntos (Dot Voting)",
          description: "El equipo vota las ideas más prometedoras.",
        },
      ],
    },
    {
      kind: "phase",
      title: "Fase 4 — Prototipar",
      order: 4,
      items: [
        {
          key: "storyboard",
          name: "Storyboard",
          description: "Secuencia de paneles narrando la experiencia.",
        },
        {
          key: "cover_mockup_story",
          name: "Cover Mockup Story",
          description: "Pantalla clave que cuenta la historia del producto.",
        },
        {
          key: "schematic_diagramming",
          name: "Diagrama Esquemático (Schematic Diagramming)",
          description: "Wireframe de flujos y estructura.",
        },
        {
          key: "paper_prototype",
          name: "Prototipo en Papel (Paper Prototype)",
          description: "Prototipo de bajo costo para validar rápido.",
        },
        {
          key: "business_model_canvas",
          name: "Canvas de Modelo de Negocio (Business Model Canvas)",
          description: "Modela propuesta, segmentos, ingresos y costos.",
        },
        {
          key: "value_proposition_canvas",
          name: "Canvas de Propuesta de Valor (Value Proposition Canvas)",
          description: "Ajusta la propuesta al dolor del cliente.",
        },
        {
          key: "rose_thorn_bud_proto",
          name: "Rosa, Espina, Capullo (Rose, Thorn, Bud)",
          description: "Feedback estructurado sobre el prototipo.",
        },
      ],
    },
    {
      kind: "phase",
      title: "Fase 5 — Probar",
      order: 5,
      items: [
        {
          key: "user_test_script",
          name: "Guión de Prueba de Usuario (User Test Script — 5 Actos)",
          description: "Estructura la sesión de test en 5 momentos.",
        },
        {
          key: "note_vote_grid",
          name: "Cuadrícula de Notas (Note-and-Vote Grid)",
          description: "Captura observaciones y decisiones de la sesión.",
        },
        {
          key: "i_like_wish_whatif",
          name: "Me Gusta / Desearía / ¿Qué tal si? (I Like, I Wish, What If?)",
          description: "Feedback constructivo en tres categorías.",
        },
        {
          key: "rose_thorn_bud_test",
          name: "Rosa, Espina, Capullo (Rose, Thorn, Bud)",
          description: "Positivo, negativo y potencial de los resultados.",
        },
        {
          key: "usability_scorecard",
          name: "Scorecard de Usabilidad",
          description: "Mide usabilidad con criterios estandarizados.",
        },
      ],
    },
  ],
};
