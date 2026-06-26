import type { MethodologyContent } from "./types";

/**
 * Scrum (Ken Schwaber & Jeff Sutherland — 1995).
 * Roles, Artefactos, 5 pasos del sprint y Métricas.
 */
export const SCRUM_CONTENT: MethodologyContent = {
  key: "scrum",
  name: "Scrum",
  emoji: "🏃",
  tagline: "Framework ágil con roles, eventos y artefactos definidos.",
  source: "Ken Schwaber & Jeff Sutherland — 1995",
  sections: [
    {
      kind: "roles",
      title: "Roles",
      order: 1,
      items: [
        {
          key: "product_owner",
          name: "Product Owner",
          description: "Maximiza el valor del producto y gestiona el Product Backlog.",
        },
        {
          key: "scrum_master",
          name: "Scrum Master",
          description: "Facilita el framework y elimina impedimentos del equipo.",
        },
        {
          key: "development_team",
          name: "Equipo de Desarrollo",
          description: "Profesionales autoorganizados que entregan el incremento.",
        },
      ],
    },
    {
      kind: "artifacts",
      title: "Artefactos",
      order: 2,
      items: [
        {
          key: "product_backlog",
          name: "Product Backlog (Lista del Producto)",
          description: "Lista ordenada y dinámica de todo lo que se necesita en el producto.",
        },
        {
          key: "sprint_backlog",
          name: "Sprint Backlog (Lista del Sprint)",
          description: "Ítems del Product Backlog seleccionados para el Sprint + un plan.",
        },
        {
          key: "definition_of_done",
          name: "Definición de Hecho (Definition of Done)",
          description: "Criterios compartidos que determinan cuándo un ítem está completo.",
        },
      ],
    },
    {
      kind: "steps",
      title: "Paso 1 — Refinamiento del Backlog",
      order: 3,
      items: [
        {
          key: "user_story",
          name: "Historia de Usuario",
          description: "Describe una necesidad desde la perspectiva del usuario.",
          prompts: ["Como [rol], quiero [función] para [beneficio]"],
        },
        {
          key: "acceptance_criteria",
          name: "Criterios de Aceptación (Acceptance Criteria)",
          description: "Condiciones que una historia debe cumplir para aceptarse.",
        },
        {
          key: "story_points",
          name: "Estimación con Puntos de Historia (Story Points)",
          description: "Estimación relativa de esfuerzo/complejidad.",
        },
        {
          key: "planning_poker",
          name: "Póker de Planificación (Planning Poker)",
          description: "Técnica colaborativa de estimación con cartas.",
        },
      ],
    },
    {
      kind: "steps",
      title: "Paso 2 — Planificación del Sprint",
      order: 4,
      items: [
        {
          key: "sprint_goal",
          name: "Meta del Sprint (Sprint Goal)",
          description: "Objetivo único que guía el Sprint.",
        },
        {
          key: "selected_sprint_backlog",
          name: "Sprint Backlog Seleccionado",
          description: "Conjunto de ítems comprometidos para el Sprint.",
        },
        {
          key: "team_capacity_sheet",
          name: "Hoja de Capacidad del Equipo (Team Capacity Sheet)",
          description: "Calcula cuántas horas/puntos disponibles hay en el Sprint.",
        },
      ],
    },
    {
      kind: "steps",
      title: "Paso 3 — Scrum Diario (15 min)",
      order: 5,
      items: [
        {
          key: "blocker_log",
          name: "Registro de Bloqueos (Blocker Log)",
          description: "Lista visible de impedimentos y su responsable.",
        },
        {
          key: "sprint_board",
          name: "Tablero de Sprint (Por Hacer / En Progreso / Hecho)",
          description: "Visualización del flujo de trabajo del Sprint.",
        },
      ],
    },
    {
      kind: "steps",
      title: "Paso 4 — Revisión del Sprint",
      order: 6,
      items: [
        {
          key: "increment_demo",
          name: "Demo del Incremento",
          description: "Presentación del incremento funcional a stakeholders.",
        },
        {
          key: "stakeholder_feedback",
          name: "Lista de Retroalimentación de Stakeholders",
          description: "Captura el feedback recibido durante la revisión.",
        },
      ],
    },
    {
      kind: "steps",
      title: "Paso 5 — Retrospectiva del Sprint",
      order: 7,
      items: [
        {
          key: "went_well_improve_action",
          name: "¿Qué salió bien? / ¿Qué mejorar? / ¿Qué accionamos?",
          description: "Retrospectiva clásica de tres columnas con acciones concretas.",
        },
        {
          key: "starfish_retro",
          name: "Estrella de Mar (Starfish Retrospective)",
          description: "Cinco áreas: empezar, hacer más, continuar, hacer menos, dejar.",
        },
        {
          key: "four_ls",
          name: "4Ls (Le Gustó / Aprendió / Le Faltó / Deseó)",
          description: "Cuatro categorías para reflexionar sobre el Sprint.",
        },
      ],
    },
    {
      kind: "metrics",
      title: "Métricas",
      order: 8,
      items: [
        {
          key: "burndown_chart",
          name: "Gráfico de Quemado (Burndown Chart)",
          description: "Trabajo restante vs. tiempo ideal del Sprint.",
        },
        {
          key: "team_velocity",
          name: "Velocidad del Equipo (Team Velocity Chart)",
          description: "Puntos de historia completados por Sprint.",
        },
      ],
    },
  ],
};
