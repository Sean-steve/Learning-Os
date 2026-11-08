export type LearningMode = 'listen' | 'read' | 'watch' | 'practice';
export type ResourceKind = 'video' | 'playlist' | 'pdf' | 'book' | 'audio' | 'website';
export type EvidenceType = 'completion' | 'self_report' | 'assessment' | 'independent_verification';
export interface LearningGoal { id: string; title: string; durationDays: number; minutesPerDay: number; preferredMode: LearningMode; createdAt: string; }
export interface LearningResource { id: string; name: string; kind: ResourceKind; url?: string; status: 'queued' | 'reviewed'; }
export interface LearningSession { id: string; title: string; date: string; time: string; minutes: number; mode: LearningMode; done?: boolean; }
export interface LearningEvidence { id: string; goalId: string; type: EvidenceType; sourceId?: string; notes?: string; createdAt: string; }
