/**
 * Catálogos estáticos del módulo "Configuración del Proyecto".
 * Reflejan los catálogos sembrados en la migración SQL, pero viven en código
 * para que la UI no dependa de la base de datos para renderizar opciones.
 */

export interface MethodologyDefinition {
  key: string;
  name: string;
  emoji: string;
  description: string;
  benefits: string[];
  useCases: string[];
  aiHint: string;
}

export const METHODOLOGIES: MethodologyDefinition[] = [
  {
    key: "agile",
    name: "Agile",
    emoji: "🔁",
    description:
      "Filosofía iterativa e incremental centrada en entrega continua y adaptación al cambio.",
    benefits: ["Adaptabilidad rápida", "Feedback continuo", "Entrega de valor temprana"],
    useCases: ["Productos en validación", "Entornos inciertos", "Equipos multidisciplinarios"],
    aiHint:
      "La IA recomienda sprints cortos (1-2 semanas) y ceremonias ligeras para mantener ritmo.",
  },
  {
    key: "scrum",
    name: "Scrum",
    emoji: "🏃",
    description:
      "Framework ágil con roles, eventos y artefactos definidos orientado a entregas en sprints.",
    benefits: ["Roles claros", "Predicción de capacidad", "Mejora continua vía retrospectivas"],
    useCases: ["Equipos de producto 5-9 personas", "Roadmaps con dependencias moderadas"],
    aiHint:
      "La IA sugierevelocity tracking y burndown como KPIs centrales, y alerta sobre scope creep.",
  },
  {
    key: "lean_ux",
    name: "Lean UX",
    emoji: "🪶",
    description:
      "Enfoque centrado en hipótesis, experimentos rápidos y aprendizaje validado.",
    benefits: ["Reducción de desperdicio", "Validación con usuarios real", "Colaboración cross-funcional"],
    useCases: ["Discovery de producto", "Rediseños con riesgo", "Startups en búsqueda de fit"],
    aiHint:
      "La IA prioriza Research Score y Customer Satisfaction y propone experimentos semanales.",
  },
  {
    key: "design_thinking",
    name: "Design Thinking",
    emoji: "🎨",
    description:
      "Proceso de innovación centrado en el humano: empatizar, definir, idear, prototipar, testear.",
    benefits: ["Profundidad en el problema", "Ideación divergente", "Prototipos de bajo costo"],
    useCases: ["Problemas complejos (wicked)", "Nuevas líneas de producto", "Investigación exploratoria"],
    aiHint:
      "La IA recomienda fases explícitas y checkpoints de validación con usuarios.",
  },
  {
    key: "kanban",
    name: "Kanban",
    emoji: "📋",
    description:
      "Sistema visual de flujo continuo con límites de WIP para optimizar el lead time.",
    benefits: ["Flujo continuo", "Visualización del trabajo", "Reducción de cuellos de botella"],
    useCases: ["Soporte / mantenimiento", "Equipos de operaciones", "Trabajo con demanda variable"],
    aiHint:
      "La IA monitorea Cycle Time y Lead Time y propone ajustes de WIP cuando hay congestión.",
  },
];

export const METHODOLOGY_KEYS = METHODOLOGIES.map((m) => m.key);

export interface RoleDefinition {
  key: string;
  name: string;
  category: string;
  isLeadership: boolean;
}

export const PROJECT_ROLES: RoleDefinition[] = [
  { key: "project_manager", name: "Project Manager", category: "leadership", isLeadership: true },
  { key: "product_owner", name: "Product Owner", category: "product", isLeadership: true },
  { key: "scrum_master", name: "Scrum Master", category: "leadership", isLeadership: true },
  { key: "ux_designer", name: "UX Designer", category: "design", isLeadership: false },
  { key: "ui_designer", name: "UI Designer", category: "design", isLeadership: false },
  { key: "backend_developer", name: "Backend Developer", category: "engineering", isLeadership: false },
  { key: "frontend_developer", name: "Frontend Developer", category: "engineering", isLeadership: false },
  { key: "full_stack_developer", name: "Full Stack Developer", category: "engineering", isLeadership: false },
  { key: "qa_engineer", name: "QA Engineer", category: "quality", isLeadership: false },
  { key: "data_analyst", name: "Data Analyst", category: "data", isLeadership: false },
  { key: "business_analyst", name: "Business Analyst", category: "data", isLeadership: false },
  { key: "stakeholder", name: "Stakeholder", category: "stakeholder", isLeadership: false },
];

export const PROJECT_ROLE_KEYS = PROJECT_ROLES.map((r) => r.key);

export function isLeadershipRole(roleKey: string | null | undefined): boolean {
  if (!roleKey) return false;
  return PROJECT_ROLES.find((r) => r.key === roleKey)?.isLeadership ?? false;
}

export function roleName(roleKey: string | null | undefined): string {
  if (!roleKey) return "Sin rol";
  return PROJECT_ROLES.find((r) => r.key === roleKey)?.name ?? roleKey;
}

export type KpiUnit =
  | "percent"
  | "points"
  | "minutes"
  | "hours"
  | "days"
  | "count";

export interface KpiCatalogItem {
  key: string;
  name: string;
  description: string;
  formula: string;
  dataSource: string;
  frequency: "daily" | "weekly" | "sprint" | "monthly";
  /**
   * Si `true`, el valor actual se calcula a partir de los datos del proyecto
   * (snapshots) y el usuario SOLO configura Meta y Umbral de alerta.
   */
  automatic: boolean;
  /** Unidad de medida para formatear el valor mostrado. */
  unit: KpiUnit;
}

export const KPI_CATALOG: KpiCatalogItem[] = [
  {
    key: "task_completion_rate",
    name: "Task Completion Rate",
    description: "% de tareas completadas sobre las planificadas en el periodo.",
    formula: "completedTasks / plannedTasks * 100",
    dataSource: "Task tracker",
    frequency: "sprint",
    automatic: true,
    unit: "percent",
  },
  {
    key: "team_velocity",
    name: "Team Velocity",
    description: "Suma de puntos de historia completados por sprint.",
    formula: "sum(completedStoryPoints)",
    dataSource: "Sprint backlog",
    frequency: "sprint",
    automatic: true,
    unit: "points",
  },
  {
    key: "response_time",
    name: "Response Time",
    description: "Tiempo medio de respuesta en canales del equipo.",
    formula: "avg(firstResponseTimestamp - messageTimestamp)",
    dataSource: "Chat / messaging",
    frequency: "weekly",
    automatic: true,
    unit: "minutes",
  },
  {
    key: "collaboration_score",
    name: "Collaboration Score",
    description: "Índice de interacción y co-creación entre miembros.",
    formula: "weighted(messages + pairSessions + reviews)",
    dataSource: "Activity graph",
    frequency: "weekly",
    automatic: true,
    unit: "points",
  },
  {
    key: "screen_time",
    name: "Screen Time",
    description: "Tiempo activo promedio en herramientas del proyecto.",
    formula: "avg(activeMinutes)",
    dataSource: "Productivity tools",
    frequency: "weekly",
    automatic: true,
    unit: "minutes",
  },
  {
    key: "research_score",
    name: "Research Score",
    description: "Cobertura y calidad de la investigación de usuario.",
    formula: "(interviews + tests + insights) / planned",
    dataSource: "Research log",
    frequency: "sprint",
    automatic: true,
    unit: "points",
  },
  {
    key: "sprint_burndown",
    name: "Sprint Burndown",
    description: "Desviación del trabajo restante frente al ideal del sprint.",
    formula: "remaining - idealRemaining",
    dataSource: "Sprint backlog",
    frequency: "sprint",
    automatic: true,
    unit: "points",
  },
  {
    key: "customer_satisfaction",
    name: "Customer Satisfaction",
    description: "Satisfacción reportada por clientes/usuarios.",
    formula: "avg(csatScore) * 20",
    dataSource: "CSAT surveys",
    frequency: "monthly",
    automatic: true,
    unit: "percent",
  },
  {
    key: "defect_density",
    name: "Defect Density",
    description: "Defects por unidad de tamaño entregada.",
    formula: "defects / kloc",
    dataSource: "Issue tracker",
    frequency: "sprint",
    automatic: true,
    unit: "count",
  },
  {
    key: "lead_time",
    name: "Lead Time",
    description: "Tiempo desde la creación hasta la entrega de un item.",
    formula: "avg(deliveredAt - createdAt)",
    dataSource: "Issue tracker",
    frequency: "weekly",
    automatic: true,
    unit: "days",
  },
  {
    key: "cycle_time",
    name: "Cycle Time",
    description: "Tiempo desde que el trabajo inicia hasta que se entrega.",
    formula: "avg(deliveredAt - startedAt)",
    dataSource: "Issue tracker",
    frequency: "weekly",
    automatic: true,
    unit: "days",
  },
];

export const KPI_KEYS = KPI_CATALOG.map((k) => k.key);

export const INSIGHT_TYPES = [
  "risk",
  "recommendation",
  "alert",
  "action",
  "metric",
  "workload",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];
