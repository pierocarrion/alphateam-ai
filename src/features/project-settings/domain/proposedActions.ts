/**
 * Acciones estructuradas que la IA propone y el usuario puede aplicar
 * directamente desde la sección "Configuración inteligente IA".
 *
 * Cada acción es autocontenida y ejecutable: viaja desde el bundle de IA
 * hasta el caso de uso `ApplyAiInsights`, que aplica los cambios sobre los
 * repositorios existentes (SMART, metodología, KPIs, miembros).
 *
 * El `id` es determinista (kind + clave de entidad) para que el cliente pueda
 * marcar/desmarcar acciones entre renderizados sin depender de un backend
 * que las persista.
 */

export type ProposedActionKind = "smart_goal" | "methodology" | "kpi" | "role";

export interface ProposedActionBase {
  id: string;
  kind: ProposedActionKind;
  /** Título corto que se muestra en la tarjeta de la acción. */
  label: string;
  /** Una frase que explica por qué la IA lo recomienda. */
  rationale: string;
  /** Confianza 0-100 calculada por la IA. */
  confidence: number;
}

/** Parche parcial sobre el objetivo SMART. Sólo los campos presentes se sobrescriben. */
export interface SmartGoalProposedAction extends ProposedActionBase {
  kind: "smart_goal";
  goal: {
    title?: string;
    specific?: string;
    measurable?: string;
    achievable?: string;
    relevant?: string;
    timeBound?: string;
  };
}

/**
 * Cambios sobre el stack metodológico. La metodología principal es inmutable
 * una vez creado el proyecto, por lo que la IA sólo propone añadir o quitar
 * metodologías secundarias.
 */
export interface MethodologyProposedAction extends ProposedActionBase {
  kind: "methodology";
  addSecondary: string[];
  removeSecondary: string[];
}

/** Activa o desactiva un KPI del catálogo y opcionalmente fija su meta. */
export interface KpiProposedAction extends ProposedActionBase {
  kind: "kpi";
  kpiKey: string;
  kpiName: string;
  enabled: boolean;
  target?: number | null;
  alertThreshold?: number | null;
}

/**
 * Reasigna el rol de proyecto de un miembro concreto. Es el mecanismo que la
 * IA usa para "redistribuir la carga de trabajo": mueve personas entre roles
 * según la distribución sugerida.
 */
export interface RoleProposedAction extends ProposedActionBase {
  kind: "role";
  memberName: string;
  projectRole: string;
  roleName: string;
}

export type ProposedAction =
  | SmartGoalProposedAction
  | MethodologyProposedAction
  | KpiProposedAction
  | RoleProposedAction;

/**
 * Snapshot del estado del proyecto *antes* de aplicar acciones. Se devuelve al
 * cliente para que pueda ofrecer "Deshacer" y se reenvía al endpoint de
 * revert para restaurar el estado previo sin mantener sesiones en el server.
 */
export interface BeforeSnapshot {
  smartGoal: {
    title: string;
    specific: string | null;
    measurable: string | null;
    achievable: string | null;
    relevant: string | null;
    timeBound: string | null;
  } | null;
  methodologies: {
    primary: string | null;
    secondary: string[];
  };
  kpis: Array<{
    kpiKey: string;
    enabled: boolean;
    target: number | null;
    alertThreshold: number | null;
  }>;
  /** Sólo los miembros cuya operación tocó el apply (para no clobber cambios ajenos). */
  members: Array<{
    memberId: string;
    projectRole: string | null;
  }>;
}

export interface AppliedAction {
  id: string;
  kind: ProposedActionKind;
  label: string;
  ok: boolean;
  /** Mensaje de error友好 si la acción falló (p.ej. violations de líderes). */
  error?: string;
}
